Pod::Spec.new do |s|
  s.name           = 'ReceiptText'
  s.version        = '0.1.0'
  s.summary        = 'On-device receipt text recognition with Apple Vision'
  s.author         = ''
  s.homepage       = 'https://github.com/ruddus11/osaka-pocket'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision'
  s.source_files   = '**/*.swift'
end
