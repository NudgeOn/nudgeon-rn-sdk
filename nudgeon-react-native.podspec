require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "nudgeon-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = { :type => package["license"], :file => "LICENSE" }
  s.author       = { "NudgeOn" => "dev@nudgeon.io" }
  s.homepage     = "https://github.com/nudgeon/nudgeon-rn-sdk"
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/nudgeon/nudgeon-rn-sdk.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{swift,h,m,mm}"
  s.swift_version = "5.9"

  # 네이티브 코어 — API 완전 동형의 상태 보유자 (PRD-01A 1.1).
  s.dependency "NudgeOnSDK"
  # RN(New Architecture 포함) 표준 의존.
  install_modules_dependencies(s) if respond_to?(:install_modules_dependencies)
  s.dependency "React-Core"
end
