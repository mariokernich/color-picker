{
  'targets': [
    {
      'target_name': 'sampler',
      'sources': [],
      'include_dirs': ["<!(node -p \"require('node-addon-api').include_dir\")"],
      'defines': ['NAPI_VERSION=8', 'NAPI_DISABLE_CPP_EXCEPTIONS'],
      'conditions': [
        ['OS=="win"', {
          'sources': ['src/sampler_win.cc'],
          'libraries': ['gdi32.lib', 'user32.lib']
        }],
        ['OS=="mac"', {
          'sources': ['src/sampler_mac.mm'],
          'xcode_settings': {
            'MACOSX_DEPLOYMENT_TARGET': '13.0',
            'CLANG_ENABLE_OBJC_ARC': 'YES',
            'OTHER_LDFLAGS': [
              '-framework AppKit',
              '-framework CoreGraphics',
              '-framework CoreMedia',
              '-framework CoreVideo',
              '-framework Foundation',
              '-framework ScreenCaptureKit'
            ]
          }
        }]
      ]
    }
  ]
}
