# @onda/react-native

Onda 고객 인게이지먼트 플랫폼 React Native SDK — 네이티브 코어(iOS/Android) 브리지.

> 상태: **M3 골격**. 브리지는 코어 API 동결 후 착수한다 (순서 고정 — PRD-01A 6장).
> 공개 TS API 표면 확정, TurboModule 네이티브 배선은 구현 예정.

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
const initial = await Onda.getInitialPushPayload(); // 콜드 스타트 처리
```

## 아키텍처 (PRD-01A 1.1 · 4장)

- **무상태 브리지** — 오프라인 큐·식별자 영속·토큰 라이프사이클은 네이티브 코어에만.
  브리지는 `invoke(method, args)` + `emit(event, payload)` dispatch만 전달.
- New Architecture(TurboModule) 기준, 구 아키텍처 호환 레이어 제공.
- `onda-ios-sdk`·`onda-android-sdk`를 네이티브 의존으로 autolinking.

MIT License.
