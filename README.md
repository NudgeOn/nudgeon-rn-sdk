# @nudgeon/react-native

NudgeOn iOS/Android 코어의 이벤트 수집, 사용자 식별, 푸시 구독과 알림 콜백을
React Native에서 연결합니다.

**0.1.3 배포 후보이며 npm 게시 전입니다.** 네이티브 코어 0.2.2는 공개
SPM/Git 태그와 Maven Central에 배포되어 있습니다. CocoaPods trunk는 등록
대기 중이므로 아래 고정 podspec 설정이 필요합니다.


## 기본 이벤트 (Standard events — 다음 릴리스)

`NudgeOnEvents`로 콘솔과 같은 이벤트 이름을 사용할 수 있습니다. 아래 상수는 이 소스에 추가된 API이며 기존 게시 버전에는 포함되어 있지 않습니다.
SDK를 초기화한 뒤 해당 행동이 성공한 시점에 호출하세요. 예시는 서로 다른 호출 시점을 보여주며, 회원가입·로그인·구입을 한 번에 자동 수집하는 코드는 아닙니다.

```typescript
import NudgeOn, { NudgeOnEvents } from '@nudgeon/react-native';

// After SDK initialization and your app's authentication succeeds:
await NudgeOn.identify('user-123');
await NudgeOn.track(NudgeOnEvents.signUp, { method: 'email' });
await NudgeOn.track(NudgeOnEvents.login, { method: 'email' });
// After order/payment confirmation:
await NudgeOn.track(NudgeOnEvents.purchaseCompleted, {
  order_id: 'order-123', total_amount: 29000, currency: 'KRW', item_count: 1,
});
```

| 상수 | 전송 이름 | 의미 | 권장 속성 |
|---|---|---|---|
| `NudgeOnEvents.signUp` | `sign_up` | 회원가입 | method |
| `NudgeOnEvents.login` | `login` | 로그인 | method |
| `NudgeOnEvents.purchaseCompleted` | `purchase_completed` | 구입 | order_id, total_amount, currency, item_count |
| `NudgeOnEvents.productViewed` | `product_viewed` | 상품 조회 | product_id, price, currency |
| `NudgeOnEvents.addToCart` | `add_to_cart` | 장바구니 담기 | product_id, quantity, price, currency |
| `NudgeOnEvents.checkoutStarted` | `checkout_started` | 결제 시작 | cart_id, item_count, total_amount, currency |

금액은 통화의 기본 단위(원·달러 등) 숫자, 통화는 ISO 4217 코드(`KRW`, `USD` 등)를 사용합니다. 속성은 권장 예시이며 서비스별 속성도 추가할 수 있습니다.
기존 `track("custom_event", ...)`는 그대로 지원하며 `purchase` 같은 기존 이름을 자동 변환하지 않습니다.
이름은 대소문자까지 콘솔 설정과 같아야 합니다. 상수 참조 자체는 이벤트를 만들지 않고, `login` 이벤트는 사용자 식별을 대신하지 않습니다.
`track` 이후 오프라인 저장·배치·재시도는 기존 전송 경로를 사용합니다.


## 설치

게시 전에는 저장소에서 `npm ci && npm pack`을 실행하고 생성된 `.tgz`를
앱에서 `npm install /path/to/nudgeon-react-native-0.1.3.tgz`로 설치하세요.

지원 기준은 **React Native 0.81 이상**, Java 17, Android minSdk **26 이상**,
Kotlin **2.1.20 이상**입니다. CI는 RN 0.81.5의 기본 New Architecture 설정으로
실제 앱을 빌드합니다. RN 0.76은 Kotlin/Gradle 플러그인 충돌로 지원하지 않습니다.
iOS deployment target은 RN 0.81이 요구하는 **15.1 이상**을 사용하세요.

`ios/Podfile`의 앱 target 안에 다음 의존성을 추가한 뒤 `pod install` 하세요.
이 podspec은 공개 코어 **0.2.2 Git 태그**를 내려받습니다.

```ruby
target 'YourApp' do
  pod 'NudgeOnSDK', :podspec => 'https://raw.githubusercontent.com/NudgeOn/nudgeon-ios-sdk/87da4258f7b8cbf27041d6b096815158cc0febee/NudgeOnSDK.podspec'
  # 기존 React Native 설정 유지
end
```

## 빠른 시작

```typescript
import NudgeOn from '@nudgeon/react-native';

const opened = NudgeOn.addListener('pushOpened', payload => {
  // payload.deepLink를 앱 라우터에서 검증 후 처리합니다.
});
await NudgeOn.initialize({
  sdkKey: 'pk_...',
  apiHost: 'https://ingest.example.com',
  autoRegisterPushToken: false,
});
await NudgeOn.identify('user-123');
await NudgeOn.track('product_viewed', { product_id: 'P-1' });
// 화면/서비스를 해제할 때:
opened.remove();
```

`flushInterval`은 양의 정수 초, `flushBatchSize`는 양의 정수 건수입니다.
`appGroup`은 iOS 알림 확장과 공유할 App Group입니다.
`logLevel`/`setLogLevel`은 iOS 전용입니다. Android 코어 0.2.2는 해당 API가
없어 `E_UNSUPPORTED`를 반환하므로 공통 초기화 설정에서는 생략하세요.

등록 전 콜백은 네이티브 메모리 버퍼(최대 20건)에서 이벤트별로 재생됩니다.
프로세스 종료·버퍼 초과에 대한 무손실 보장은 아닙니다.
`getInitialPushPayload()`와 리스너를 함께 쓸 때는 `messageId`로 중복 이동을
막으세요. 같은 이벤트를 여러 번 구독해도 각 구독은 독립적으로 해제됩니다.

## 푸시 연결

APNs/FCM 공급자·앱 권한 설정은 별도로 필요합니다. 네이티브 가이드에 따라
iOS APNs 토큰/알림 delegate와 Android Firebase 서비스/notification intent를
연결한 후 앱 화면에서 `registerForPush()`를 호출하세요.

- [iOS 코어 설치](https://github.com/NudgeOn/nudgeon-ios-sdk/tree/0.2.2)
- [Android 코어 설치](https://github.com/NudgeOn/nudgeon-android-sdk/tree/0.2.2)

구현은 `RCTEventEmitter`와 `ReactContextBaseJavaModule`이며 New Architecture의
호환 계층을 사용합니다. codegen TurboModule 구현은 아닙니다. 인앱 WebView
캠페인 UI는 현재 JS API에 노출하지 않습니다. 단말 푸시 발송은 이번 배포 후보
검증에서 제외합니다.

## 검증과 배포 준비

`npm run typecheck`, `npm test`, `swift test`, `npm pack --dry-run`과
[새 iOS/Android 앱 빌드](tests/consumer/README.md)를 검증합니다.

로그인 전에는 배포 태그나 publish 워크플로를 실행하지 않습니다. 로그인 후
최종 main의 CI와 `.tgz` 파일 목록을 확인하고 npm 게시 권한을 설정합니다.
`0.1.3` 태그를 푸시하면 publish 워크플로가 버전을 검증한 후 게시합니다.
게시 후에는 tarball/podspec override를 제거한 새 앱에서 npm·CocoaPods·Maven
다운로드와 빌드를 다시 확인해야 합니다.

Apache License 2.0. See [LICENSE](LICENSE).

현재 로컬 Xcode 27에서는 RN 0.81.5의 `fmt` C++ 의존성 컴파일 문제가 남아
있습니다. CI는 macOS 15의 Xcode로 검증하며, Xcode 27 지원 완료를 의미하지
않습니다. 자세한 결과는 [consumer 기록](tests/consumer/README.md)을 참고하세요.
