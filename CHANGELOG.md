# Changelog

## 0.1.3 — publication candidate

- Pin public native cores to 0.2.2; add explicit CocoaPods distribution instructions.
- Encode scalar native responses as JSON, including identifiers and permission results.
- Forward initialization options and iOS App Group/log level. Android's unavailable log-level API rejects with `E_UNSUPPORTED` instead of silently succeeding.
- Attach each native event after its JS listener exists, retry attachment after initialization, and detach on final removal.
- Preserve JSON numbers 0/1 as numbers in Swift attribute conversion.
- Add native Swift contract tests and fresh consumer build validation. No physical-device push certification is included.
- Set RN 0.81 as the supported baseline and verify the actual npm tarball in fresh native consumers; RN 0.76's Kotlin toolchain is incompatible with core 0.2.2.
