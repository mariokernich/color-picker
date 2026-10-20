// Live screen sampling on Windows. Reads small regions of the composed desktop with GDI. The
// picker overlays are excluded from capture with `SetWindowDisplayAffinity` (Electron's
// `setContentProtection`), so the reads see what is underneath them.

#include <napi.h>
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <map>

namespace {

struct Display {
  // Origin in physical virtual-screen pixels and size in physical pixels.
  int x;
  int y;
  int width;
  int height;
};

std::map<int64_t, Display> displays;

int32_t IntProperty(const Napi::Object& object, const char* name) {
  return object.Get(name).As<Napi::Number>().Int32Value();
}

// start(displays: { id, x, y, width, height }[]): Promise<boolean>
Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  displays.clear();
  if (info.Length() > 0 && info[0].IsArray()) {
    Napi::Array list = info[0].As<Napi::Array>();
    for (uint32_t i = 0; i < list.Length(); i++) {
      Napi::Object item = list.Get(i).As<Napi::Object>();
      int64_t id = item.Get("id").As<Napi::Number>().Int64Value();
      displays[id] = {IntProperty(item, "x"), IntProperty(item, "y"), IntProperty(item, "width"),
                      IntProperty(item, "height")};
    }
  }
  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  deferred.Resolve(Napi::Boolean::New(env, !displays.empty()));
  return deferred.Promise();
}

// read(displayId, x, y, width, height): Buffer | null
// Returns BGRA pixels of the region in display pixels. Pixels outside the display stay
// transparent (alpha 0).
Napi::Value Read(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) return env.Null();
  auto entry = displays.find(info[0].As<Napi::Number>().Int64Value());
  int x = info[1].As<Napi::Number>().Int32Value();
  int y = info[2].As<Napi::Number>().Int32Value();
  int width = info[3].As<Napi::Number>().Int32Value();
  int height = info[4].As<Napi::Number>().Int32Value();
  if (entry == displays.end() || width <= 0 || height <= 0) return env.Null();
  const Display& display = entry->second;

  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(env, size_t(width) * height * 4);
  uint8_t* target = buffer.Data();
  std::memset(target, 0, buffer.Length());

  int left = std::max(x, 0);
  int top = std::max(y, 0);
  int right = std::min(x + width, display.width);
  int bottom = std::min(y + height, display.height);
  if (left >= right || top >= bottom) return buffer;
  int copyWidth = right - left;
  int copyHeight = bottom - top;

  BITMAPINFO bitmapInfo = {};
  bitmapInfo.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  bitmapInfo.bmiHeader.biWidth = copyWidth;
  bitmapInfo.bmiHeader.biHeight = -copyHeight;  // Top-down rows.
  bitmapInfo.bmiHeader.biPlanes = 1;
  bitmapInfo.bmiHeader.biBitCount = 32;
  bitmapInfo.bmiHeader.biCompression = BI_RGB;

  HDC screen = GetDC(nullptr);
  HDC memory = CreateCompatibleDC(screen);
  void* bits = nullptr;
  HBITMAP bitmap = CreateDIBSection(screen, &bitmapInfo, DIB_RGB_COLORS, &bits, nullptr, 0);
  bool copied = false;
  if (bitmap && memory) {
    HGDIOBJ previous = SelectObject(memory, bitmap);
    // CAPTUREBLT includes layered windows (e.g. menus and tooltips with transparency).
    copied = BitBlt(memory, 0, 0, copyWidth, copyHeight, screen, display.x + left,
                    display.y + top, SRCCOPY | CAPTUREBLT) != 0;
    GdiFlush();
    if (copied) {
      const uint8_t* source = static_cast<const uint8_t*>(bits);
      for (int row = 0; row < copyHeight; row++) {
        const uint8_t* from = source + size_t(row) * copyWidth * 4;
        uint8_t* to = target + (size_t(top - y + row) * width + (left - x)) * 4;
        std::memcpy(to, from, size_t(copyWidth) * 4);
        // GDI leaves the alpha byte undefined.
        for (int column = 0; column < copyWidth; column++) to[column * 4 + 3] = 255;
      }
    }
    SelectObject(memory, previous);
  }
  if (bitmap) DeleteObject(bitmap);
  if (memory) DeleteDC(memory);
  ReleaseDC(nullptr, screen);
  if (!copied) return env.Null();
  return buffer;
}

// Slowing down the cursor: a low-level mouse hook swallows each mouse movement and moves the
// cursor by a share of it instead. The hook runs on its own thread, so its calls never wait for
// the busy main thread (Windows drops hooks that answer too slowly), and it only exists while the
// picker slows the mouse down. Windows removes it on its own when the process ends.
std::atomic<double> cursorSpeed{1};
HANDLE hookThread = nullptr;
DWORD hookThreadId = 0;
// Position in physical pixels including the fractions the cursor cannot show; hook thread only.
double cursorX = 0;
double cursorY = 0;

// Like the local event monitor on macOS, only movements that go to this app's windows (the
// picker overlays) are slowed down.
bool OwnsForeground() {
  DWORD process = 0;
  GetWindowThreadProcessId(GetForegroundWindow(), &process);
  return process == GetCurrentProcessId();
}

LRESULT CALLBACK SlowDown(int code, WPARAM message, LPARAM data) {
  POINT cursor;
  if (code != HC_ACTION || message != WM_MOUSEMOVE || !OwnsForeground() || !GetCursorPos(&cursor))
    return CallNextHookEx(nullptr, code, message, data);
  // The event has not moved the cursor yet, so its point minus the cursor is the (accelerated)
  // movement. Points of low-level events are in physical pixels, as the sampler reads them.
  const POINT& point = reinterpret_cast<const MSLLHOOKSTRUCT*>(data)->pt;
  // Something else moved the cursor: continue from there.
  if (LONG(std::floor(cursorX)) != cursor.x || LONG(std::floor(cursorY)) != cursor.y) {
    cursorX = cursor.x + 0.5;
    cursorY = cursor.y + 0.5;
  }
  // The overlay covers one display, so the position stays on it.
  MONITORINFO monitor = {sizeof(MONITORINFO)};
  GetMonitorInfoW(MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST), &monitor);
  const RECT& frame = monitor.rcMonitor;
  double speed = cursorSpeed.load();
  cursorX = std::clamp(cursorX + (point.x - cursor.x) * speed, double(frame.left),
                       frame.right - 0.01);
  cursorY = std::clamp(cursorY + (point.y - cursor.y) * speed, double(frame.top),
                       frame.bottom - 0.01);
  LONG x = LONG(std::floor(cursorX));
  LONG y = LONG(std::floor(cursorY));
  if (x != cursor.x || y != cursor.y) SetCursorPos(x, y);
  return 1;
}

struct HookStart {
  HANDLE ready;
  bool installed;
};

DWORD WINAPI RunHook(LPVOID data) {
  HookStart* start = static_cast<HookStart*>(data);
  // Physical pixels on every display, independent of the DPI awareness this thread inherits.
  SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  POINT cursor = {};
  GetCursorPos(&cursor);
  cursorX = cursor.x + 0.5;
  cursorY = cursor.y + 0.5;
  MSG message;
  // Creates the message queue, so the WM_QUIT of StopHook cannot get lost.
  PeekMessageW(&message, nullptr, 0, 0, PM_NOREMOVE);
  HMODULE module = nullptr;
  GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                         GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                     reinterpret_cast<LPCWSTR>(&SlowDown), &module);
  HHOOK hook = SetWindowsHookExW(WH_MOUSE_LL, SlowDown, module, 0);
  start->installed = hook != nullptr;
  SetEvent(start->ready);
  if (!hook) return 1;
  // Windows calls the hook from within this loop.
  while (GetMessageW(&message, nullptr, 0, 0) > 0) DispatchMessageW(&message);
  UnhookWindowsHookEx(hook);
  return 0;
}

void StopHook() {
  if (!hookThread) return;
  PostThreadMessageW(hookThreadId, WM_QUIT, 0, 0);
  WaitForSingleObject(hookThread, 1000);
  CloseHandle(hookThread);
  hookThread = nullptr;
}

void StartHook() {
  HookStart start = {CreateEventW(nullptr, TRUE, FALSE, nullptr), false};
  if (!start.ready) return;
  hookThread = CreateThread(nullptr, 0, RunHook, &start, 0, &hookThreadId);
  if (hookThread) {
    WaitForSingleObject(start.ready, INFINITE);
    // Without the hook the thread has ended; the next call tries again.
    if (!start.installed) StopHook();
  }
  CloseHandle(start.ready);
}

// Applies this share (0-1] of the mouse movement while this app's windows get the events.
Napi::Value SetCursorSpeed(const Napi::CallbackInfo& info) {
  double speed = std::clamp(info[0].As<Napi::Number>().DoubleValue(), 0.05, 1.0);
  cursorSpeed = speed;
  if (speed >= 1) StopHook();
  else if (!hookThread) StartHook();
  return info.Env().Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  displays.clear();
  cursorSpeed = 1;
  StopHook();
  return info.Env().Undefined();
}

// Counts changes of the clipboard, so it only has to be read after something was copied.
Napi::Value ClipboardChangeCount(const Napi::CallbackInfo& info) {
  return Napi::Number::New(info.Env(), double(GetClipboardSequenceNumber()));
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("read", Napi::Function::New(env, Read));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("setCursorSpeed", Napi::Function::New(env, SetCursorSpeed));
  exports.Set("clipboardChangeCount", Napi::Function::New(env, ClipboardChangeCount));
  env.AddCleanupHook([] { StopHook(); });
  return exports;
}

}  // namespace

NODE_API_MODULE(sampler, Init)
