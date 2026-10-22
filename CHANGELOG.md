# Changelog

## 0.1.3 — publication candidate

- Align iOS and Android cores to 0.2.9 for transactional SQLite event persistence and one-time legacy JSON migration. Native core publication is required before installing this candidate.


- Add `NudgeOnAttributes` profile keys for names, contact details, birthday, gender, home city, country, language, time zone, and signup date. Use the existing `setUserAttributes` API after `identify`; custom keys and null/unset remain supported.

- Add public `NudgeOnEvents` constants for sign-up, login, purchase, product views, cart additions, and checkout starts, matching the console catalog.
- Document recommended properties and preserve custom event names and the existing track transport.

- Encode scalar native responses as JSON, including identifiers and permission results.
- Forward initialization options and iOS App Group/log level. Android's unavailable log-level API rejects with `E_UNSUPPORTED` instead of silently succeeding.
- Attach each native event after its JS listener exists, retry attachment after initialization, and detach on final removal.
- Preserve JSON numbers 0/1 as numbers in Swift attribute conversion.
- Add native Swift contract tests and fresh consumer build validation. No physical-device push certification is included.
- Set RN 0.81 as the supported baseline and verify the actual npm tarball in fresh native consumers; RN 0.76's Kotlin toolchain is incompatible with core 0.2.2.
