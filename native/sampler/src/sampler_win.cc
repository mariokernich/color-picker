// Live screen sampling on Windows. Reads small regions of the composed desktop with GDI. The
// picker overlays are excluded from capture with `SetWindowDisplayAffinity` (Electron's
// `setContentProtection`), so the reads see what is underneath them.

#include <napi.h>
#include <windows.h>

#include <algorithm>
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

Napi::Value Stop(const Napi::CallbackInfo& info) {
  displays.clear();
  return info.Env().Undefined();
}

// Moves the mouse cursor to a point on the virtual screen in physical pixels.
Napi::Value MoveCursor(const Napi::CallbackInfo& info) {
  SetCursorPos(info[0].As<Napi::Number>().Int32Value(), info[1].As<Napi::Number>().Int32Value());
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("read", Napi::Function::New(env, Read));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("moveCursor", Napi::Function::New(env, MoveCursor));
  return exports;
}

}  // namespace

NODE_API_MODULE(sampler, Init)
