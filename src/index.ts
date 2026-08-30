/**
 * Onda React Native SDK (PRD-01A 3.3).
 * 무상태 브리지 — 네이티브 코어(iOS/Android)에 invoke/emit dispatch만 전달한다.
 * 오프라인 큐·식별자 영속·토큰 라이프사이클은 네이티브 코어에만 존재 (PRD-01A 1.1).
 *
 * 상태: M3 골격 (코어 API 동결 후 착수 — 브리지 순서 고정). TurboModule 배선은 구현 예정.
 */

export interface OndaConfig {
  sdkKey: string;
  apiHost: string;
  logLevel?: "none" | "error" | "warn" | "info" | "debug";
  flushInterval?: number;
  flushBatchSize?: number;
  autoTrackSessions?: boolean;
  autoRegisterPushToken?: boolean;
}

export type OndaValue = string | number | boolean | string[] | null;

export interface PushPayload {
  messageId: string;
  campaignId?: string;
  journeyId?: string;
  title: string;
  body: string;
  deepLink?: string;
  data: Record<string, string>;
}

export type PushPermissionResult = "granted" | "denied" | "provisional";

/**
 * 네이티브 브리지 계약 (PRD-01A 4장): invoke(method, args) + emit(event, payload).
 * TurboModule 구현체가 이 인터페이스를 만족한다 (M3).
 */
interface NativeBridge {
  invoke(method: string, argsJson: string): Promise<string>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

// TODO(M3): TurboModuleRegistry.getEnforcing<NativeBridge>('OndaModule')
let native: NativeBridge | null = null;

async function invoke(method: string, args: unknown): Promise<unknown> {
  if (!native) throw new Error("Onda 네이티브 모듈 미연결 (M3 구현 예정)");
  const res = await native.invoke(method, JSON.stringify(args ?? {}));
  return res ? JSON.parse(res) : null;
}

/** 공개 API — iOS/Android와 완전 동형 (PRD-01A 2장) */
const Onda = {
  initialize: (config: OndaConfig) => invoke("initialize", config),
  identify: (externalId: string) => invoke("identify", { externalId }),
  reset: () => invoke("reset", {}),
  setUserAttributes: (attrs: Record<string, OndaValue>) =>
    invoke("setUserAttributes", { attrs }),
  track: (name: string, properties?: Record<string, unknown>) =>
    invoke("track", { name, properties: properties ?? {} }),
  flush: () => invoke("flush", {}),

  registerForPush: () => invoke("registerForPush", {}) as Promise<PushPermissionResult>,
  setPushSubscription: (optedIn: boolean) => invoke("setPushSubscription", { optedIn }),

  /** 콜드 스타트 — 푸시로 앱이 열렸으면 payload, 아니면 null (PRD-01A 3.3, 유실 0 요구) */
  getInitialPushPayload: () => invoke("getInitialPushPayload", {}) as Promise<PushPayload | null>,

  // addListener('pushOpened'|'pushReceived', cb) 는 EventEmitter 배선과 함께 M3 구현
};

export default Onda;
