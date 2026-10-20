// Live screen sampling on macOS. Runs one ScreenCaptureKit stream per display that leaves out
// this app's own windows (the picker overlays) and converts frames to sRGB. Reads copy small
// regions of the latest frame of a display.

#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

#include <napi.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <vector>

@interface CDFrameReceiver : NSObject <SCStreamOutput, SCStreamDelegate>
- (CVPixelBufferRef)retainedFrame CF_RETURNS_RETAINED;
@end

@implementation CDFrameReceiver {
  std::mutex _mutex;
  CVPixelBufferRef _frame;
}

- (void)dealloc {
  if (_frame) CVPixelBufferRelease(_frame);
}

- (void)stream:(SCStream *)stream
    didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
                   ofType:(SCStreamOutputType)type {
  if (type != SCStreamOutputTypeScreen || !CMSampleBufferIsValid(sampleBuffer)) return;
  // Unchanged screens deliver idle frames without an image; keep the last complete one.
  CFArrayRef attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, false);
  if (!attachments || CFArrayGetCount(attachments) == 0) return;
  NSDictionary *info = (__bridge NSDictionary *)CFArrayGetValueAtIndex(attachments, 0);
  NSNumber *status = info[SCStreamFrameInfoStatus];
  if (status == nil || status.integerValue != SCFrameStatusComplete) return;
  CVPixelBufferRef frame = CMSampleBufferGetImageBuffer(sampleBuffer);
  if (!frame) return;
  CVPixelBufferRetain(frame);
  CVPixelBufferRef previous;
  {
    std::lock_guard<std::mutex> lock(_mutex);
    previous = _frame;
    _frame = frame;
  }
  if (previous) CVPixelBufferRelease(previous);
}

- (void)stream:(SCStream *)stream didStopWithError:(NSError *)error {
  NSLog(@"ChipDeck sampler: stream stopped: %@", error);
}

- (CVPixelBufferRef)retainedFrame {
  std::lock_guard<std::mutex> lock(_mutex);
  if (_frame) CVPixelBufferRetain(_frame);
  return _frame;
}

@end

namespace {

struct DisplayStream {
  SCStream *stream;
  CDFrameReceiver *receiver;
};

struct Request {
  CGDirectDisplayID id;
  int width;
  int height;
};

std::mutex streamsMutex;
std::map<int64_t, DisplayStream> streams;
// Bumped by every start and stop so a slow start does not install streams after a stop.
uint64_t generation = 0;
dispatch_queue_t sampleQueue;

void StopStreams(std::map<int64_t, DisplayStream> &entries) {
  for (auto &entry : entries) [entry.second.stream stopCaptureWithCompletionHandler:nil];
  entries.clear();
}

int32_t IntProperty(const Napi::Object &object, const char *name) {
  return object.Get(name).As<Napi::Number>().Int32Value();
}

SCStream *CreateStream(SCDisplay *display, NSArray<SCRunningApplication *> *excluded,
                       const Request &request, CDFrameReceiver *receiver) {
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display
                                               excludingApplications:excluded
                                                    exceptingWindows:@[]];
  SCStreamConfiguration *config = [[SCStreamConfiguration alloc] init];
  config.width = request.width;
  config.height = request.height;
  config.pixelFormat = kCVPixelFormatType_32BGRA;
  // Report sRGB values, also on wide-gamut (P3) displays.
  config.colorSpaceName = kCGColorSpaceSRGB;
  config.showsCursor = NO;
  config.minimumFrameInterval = CMTimeMake(1, 60);
  config.queueDepth = 4;
  SCStream *stream = [[SCStream alloc] initWithFilter:filter
                                        configuration:config
                                             delegate:receiver];
  NSError *error = nil;
  if (![stream addStreamOutput:receiver
                          type:SCStreamOutputTypeScreen
            sampleHandlerQueue:sampleQueue
                         error:&error]) {
    NSLog(@"ChipDeck sampler: adding the stream output failed: %@", error);
    return nil;
  }
  return stream;
}

void StartStreams(SCShareableContent *content, const std::vector<Request> &requests,
                  uint64_t startGeneration, const std::function<void(bool)> &done) {
  // Without our own app in the filter the overlays would capture themselves, so that case
  // falls back to the frozen picker.
  NSMutableArray<SCRunningApplication *> *excluded = [NSMutableArray array];
  pid_t pid = getpid();
  for (SCRunningApplication *app in content.applications) {
    if (app.processID == pid) [excluded addObject:app];
  }
  if (excluded.count == 0) return done(false);

  std::map<int64_t, DisplayStream> created;
  for (const Request &request : requests) {
    if (request.width <= 0 || request.height <= 0) continue;
    for (SCDisplay *display in content.displays) {
      if (display.displayID != request.id) continue;
      CDFrameReceiver *receiver = [[CDFrameReceiver alloc] init];
      SCStream *stream = CreateStream(display, excluded, request, receiver);
      if (stream) created[request.id] = {stream, receiver};
    }
  }
  if (created.empty()) return done(false);

  {
    std::lock_guard<std::mutex> lock(streamsMutex);
    if (startGeneration != generation) return done(false);
    streams = created;
  }
  // Blocks would capture the `done` reference itself, so they get a copy.
  std::function<void(bool)> finish = done;
  auto pending = std::make_shared<std::atomic<int>>(int(created.size()));
  auto started = std::make_shared<std::atomic<bool>>(false);
  for (auto &entry : created) {
    [entry.second.stream startCaptureWithCompletionHandler:^(NSError *error) {
      if (error == nil) started->store(true);
      else NSLog(@"ChipDeck sampler: starting a stream failed: %@", error);
      if (--*pending == 0) finish(started->load());
    }];
  }
}

// start(displays: { id, x, y, width, height }[]): Promise<boolean>
// Resolves to false when screen recording is not allowed or no stream could be started.
Napi::Value Start(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  auto deferred = std::make_shared<Napi::Promise::Deferred>(Napi::Promise::Deferred::New(env));

  std::vector<Request> requests;
  if (info.Length() > 0 && info[0].IsArray()) {
    Napi::Array list = info[0].As<Napi::Array>();
    for (uint32_t i = 0; i < list.Length(); i++) {
      Napi::Object item = list.Get(i).As<Napi::Object>();
      requests.push_back({item.Get("id").As<Napi::Number>().Uint32Value(),
                          IntProperty(item, "width"), IntProperty(item, "height")});
    }
  }

  uint64_t startGeneration;
  {
    std::lock_guard<std::mutex> lock(streamsMutex);
    StopStreams(streams);
    startGeneration = ++generation;
  }

  // ScreenCaptureKit calls back on its own queues; the promise is resolved on the JS thread.
  auto callback = Napi::ThreadSafeFunction::New(
      env, Napi::Function::New(env, [](const Napi::CallbackInfo &) {}), "ChipDeckSampler", 0, 1);
  auto resolved = std::make_shared<std::atomic<bool>>(false);
  std::function<void(bool)> done = [callback, deferred, resolved](bool ok) mutable {
    if (resolved->exchange(true)) return;
    callback.BlockingCall([deferred, ok](Napi::Env env, Napi::Function) {
      deferred->Resolve(Napi::Boolean::New(env, ok));
    });
    callback.Release();
  };

  void (^handler)(SCShareableContent *, NSError *) = ^(SCShareableContent *content,
                                                        NSError *error) {
    if (error != nil || content == nil) {
      NSLog(@"ChipDeck sampler: screen content is not available: %@", error);
      return done(false);
    }
    StartStreams(content, requests, startGeneration, done);
  };
  [SCShareableContent getShareableContentExcludingDesktopWindows:NO
                                             onScreenWindowsOnly:NO
                                               completionHandler:handler];

  return deferred->Promise();
}

// read(displayId, x, y, width, height): Buffer | null
// Returns BGRA pixels of the region in display pixels, or null until the first frame arrived.
// Pixels outside the display stay transparent (alpha 0).
Napi::Value Read(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) return env.Null();
  int64_t id = info[0].As<Napi::Number>().Int64Value();
  int x = info[1].As<Napi::Number>().Int32Value();
  int y = info[2].As<Napi::Number>().Int32Value();
  int width = info[3].As<Napi::Number>().Int32Value();
  int height = info[4].As<Napi::Number>().Int32Value();
  if (width <= 0 || height <= 0) return env.Null();

  CDFrameReceiver *receiver = nil;
  {
    std::lock_guard<std::mutex> lock(streamsMutex);
    auto entry = streams.find(id);
    if (entry != streams.end()) receiver = entry->second.receiver;
  }
  CVPixelBufferRef frame = receiver ? [receiver retainedFrame] : nullptr;
  if (!frame) return env.Null();

  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(env, size_t(width) * height * 4);
  uint8_t *target = buffer.Data();
  std::memset(target, 0, buffer.Length());

  CVPixelBufferLockBaseAddress(frame, kCVPixelBufferLock_ReadOnly);
  const uint8_t *base = static_cast<const uint8_t *>(CVPixelBufferGetBaseAddress(frame));
  size_t stride = CVPixelBufferGetBytesPerRow(frame);
  int frameWidth = int(CVPixelBufferGetWidth(frame));
  int frameHeight = int(CVPixelBufferGetHeight(frame));
  int left = std::max(x, 0);
  int top = std::max(y, 0);
  int right = std::min(x + width, frameWidth);
  int bottom = std::min(y + height, frameHeight);
  if (base && left < right && top < bottom) {
    for (int row = top; row < bottom; row++) {
      const uint8_t *from = base + size_t(row) * stride + size_t(left) * 4;
      uint8_t *to = target + (size_t(row - y) * width + (left - x)) * 4;
      std::memcpy(to, from, size_t(right - left) * 4);
      for (int column = 0; column < right - left; column++) to[column * 4 + 3] = 255;
    }
  }
  CVPixelBufferUnlockBaseAddress(frame, kCVPixelBufferLock_ReadOnly);
  CVPixelBufferRelease(frame);
  return buffer;
}

Napi::Value Stop(const Napi::CallbackInfo &info) {
  std::lock_guard<std::mutex> lock(streamsMutex);
  StopStreams(streams);
  generation++;
  return info.Env().Undefined();
}

// Slowing down the cursor works like pointer lock: the cursor (hidden over the picker overlays)
// is detached from the mouse and stays put, while a local event monitor (no permission needed,
// it only sees events that go to this app's windows) applies a share of each mouse movement to
// its own position and hands the event on at that position. The cursor is moved there once, when
// the slowdown ends; moving it on every event would make macOS drop mouse input for a moment.
id cursorMonitor = nil;
double cursorSpeed = 1;
// Global position in Cocoa coordinates (origin bottom left of the main display).
NSPoint cursorPosition;

NSScreen *ScreenAt(NSPoint point) {
  for (NSScreen *screen in NSScreen.screens) {
    if (NSPointInRect(point, screen.frame)) return screen;
  }
  return NSScreen.mainScreen;
}

NSEvent *SlowDown(NSEvent *event) {
  // The overlay covers one display, so the position stays on it.
  NSRect frame = ScreenAt(cursorPosition).frame;
  double x = cursorPosition.x + event.deltaX * cursorSpeed;
  double y = cursorPosition.y - event.deltaY * cursorSpeed;
  cursorPosition.x = std::clamp(x, NSMinX(frame), NSMaxX(frame) - 0.01);
  cursorPosition.y = std::clamp(y, NSMinY(frame), NSMaxY(frame) - 0.01);
  if (!event.window) return event;
  return [NSEvent mouseEventWithType:event.type
                            location:[event.window convertPointFromScreen:cursorPosition]
                       modifierFlags:event.modifierFlags
                           timestamp:event.timestamp
                        windowNumber:event.windowNumber
                             context:nil
                         eventNumber:event.eventNumber
                          clickCount:event.clickCount
                            pressure:event.pressure];
}

// Applies this share (0-1] of the mouse movement while this app's windows get the events.
Napi::Value SetCursorSpeed(const Napi::CallbackInfo &info) {
  double speed = std::clamp(info[0].As<Napi::Number>().DoubleValue(), 0.05, 1.0);
  if (speed >= 1 && cursorMonitor) {
    [NSEvent removeMonitor:cursorMonitor];
    cursorMonitor = nil;
    CGFloat top = NSMaxY(NSScreen.screens.firstObject.frame);
    CGWarpMouseCursorPosition(CGPointMake(cursorPosition.x, top - cursorPosition.y));
    CGAssociateMouseAndMouseCursorPosition(true);
  } else if (speed < 1 && !cursorMonitor) {
    cursorPosition = NSEvent.mouseLocation;
    CGAssociateMouseAndMouseCursorPosition(false);
    cursorMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved
                                                          handler:^NSEvent *(NSEvent *event) {
                                                            return SlowDown(event);
                                                          }];
  }
  cursorSpeed = speed;
  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  sampleQueue = dispatch_queue_create("de.kernich.colorpicker.sampler", DISPATCH_QUEUE_SERIAL);
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("read", Napi::Function::New(env, Read));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("setCursorSpeed", Napi::Function::New(env, SetCursorSpeed));
  return exports;
}

}  // namespace

NODE_API_MODULE(sampler, Init)
