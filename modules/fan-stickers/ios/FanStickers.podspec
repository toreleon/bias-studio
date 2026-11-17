Pod::Spec.new do |s|
  s.name = 'FanStickers'
  s.version = '1.0.0'
  s.summary = 'Bias Studio native sticker tools'
  s.description = 'On-device person cutout and WhatsApp pack handoff.'
  s.license = 'MIT'
  s.author = 'Bias Studio'
  s.homepage = 'https://expo.dev'
  s.source = { :git => 'https://github.com/expo/expo.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'SDWebImageWebPCoder'
  s.frameworks = 'Vision', 'CoreImage', 'CoreVideo', 'UIKit'
  s.source_files = '**/*.{h,m,swift}'
end
