Pod::Spec.new do |s|
  s.name           = 'AppNotices'
  s.version        = '0.1.0'
  s.summary        = 'Reads legal notices bundled by native SDKs'
  s.author         = ''
  s.homepage       = 'https://github.com/ruddus11/osaka-pocket'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.libraries      = 'compression'
  s.source_files   = '**/*.swift'
end
