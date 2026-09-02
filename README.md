# @onda/react-native

Onda 고객 인게이지먼트 플랫폼 React Native SDK — 네이티브 코어(iOS/Android) 브리지.

> 상태: **M3 브리지 구현**. 무상태 TS 레이어(invoke/emit·리스너·콜드스타트 재생) + iOS/Android 네이티브 모듈.
> JS 경계 직렬화·리스너 재생은 Jest로 검증(node 부재로 이 환경 미실행 — CI 검증). 네이티브 배선은 RN 앱 통합 테스트 필요.

## 설치 (npm — 예정)

```bash
npm install @onda/react-native
```

## 빠른 시작

```typescript
import Onda from '@onda/react-native';

await Onda.initialize({ sdkKey: 'pk_...', apiHost: 'https://ingest.example.com' });
await Onda.identify('user-123');
Onda.track('product_viewed', { product_id: 'P-1', price: 12900 });

const result = await Onda.registerForPush();

// 리스너 — 콜드 스타트 유실 0 (등록 전 발생분은 네이티브 버퍼 재생)
const sub = Onda.addListener('pushOpened', (p) => navigate(p.deepLink));
const initial = await Onda.getInitialPushPayload(); // 이중 경로
// sub.remove() 로 해제
```

## 네이티브 배선

- iOS: `ios/OndaModule.swift`(RCTEventEmitter) — `OndaSDK` 코어 위임, podspec autolinking.
- Android: `android/.../OndaModule.kt`(+`OndaPackage`) — `io.onda:onda-android` 코어 위임.
- 브리지는 무상태: 단일 `invoke(method,args)` + `emit(onda_pushOpened/received)` 계약만 (PRD-01A 4장).

## 아키텍처 (PRD-01A 1.1 · 4장)

- **무상태 브리지** — 오프라인 큐·식별자 영속·토큰 라이프사이클은 네이티브 코어에만.
  브리지는 `invoke(method, args)` + `emit(event, payload)` dispatch만 전달.
- New Architecture(TurboModule) 기준, 구 아키텍처 호환 레이어 제공.
- `onda-ios-sdk`·`onda-android-sdk`를 네이티브 의존으로 autolinking.

Apache License 2.0. See [LICENSE](LICENSE).
