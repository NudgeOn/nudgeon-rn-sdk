# Fresh native consumer

Run `npm ci`, then
`python3 tests/consumer/prepare.py /tmp/nudgeon-rn-consumer-unique`.
The script refuses to overwrite existing paths, packs the real npm archive,
creates React Native 0.81.5 and installs that archive. Android minSdk is 26;
the template uses Kotlin 2.1.20. The iOS podspec resolves public core 0.2.2
through an immutable spec URL until CocoaPods trunk publication is complete.

CI builds Android arm64 debug and iOS arm64 simulator apps. Compile success
verifies native module linking; it is not a device push or provider send test.
`swift test` covers the Swift JSON/config contract, and Jest covers JS parsing
and listener lifecycle.

React Native 0.76's Kotlin 1.9.24 cannot read core 0.2.2's Kotlin metadata.
Overriding only Kotlin to 2.1.20 or 2.2.0 also fails because RN 0.76's Gradle
plugin expects a different Kotlin Gradle API. The supported baseline for this
candidate is RN 0.81; do not bypass Kotlin metadata checks.

Local Xcode 27 currently fails compiling RN 0.81.5's vendored fmt before
NudgeOn sources (`consteval` constant-expression errors). Defining
`FMT_USE_CONSTEVAL=0` does not fix fmt's unconditional macro detection. CI uses
macOS 15's supported Xcode toolchain; Xcode 27 compatibility remains unqualified.
The earlier RN 0.76 iOS build is not evidence for RN 0.81 Android compatibility.
