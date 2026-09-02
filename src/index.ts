/**
 * NudgeOn React Native SDK (PRD-01A 3.3).
 * 무상태 브리지 — 네이티브 코어(iOS/Android)에 invoke/emit dispatch만 전달한다.
 * 오프라인 큐·식별자 영속·토큰 라이프사이클은 네이티브 코어에만 존재 (PRD-01A 1.1).
 */

import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";

export interface NudgeOnConfig {
  sdkKey: string;
  apiHost: string;
  logLevel?: "none" | "error" | "warn" | "info" | "debug";
  flushInterval?: number;
  flushBatchSize?: number;
  autoTrackSessions?: boolean;
  autoRegisterPushToken?: boolean;
}

export type NudgeOnValue = string | number | boolean | string[] | null;

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

export interface SubscriptionState {
  serviceOptIn: boolean;
  osPermission: string;
  tokenRegistered: boolean;
}

export type PushEvent = "pushOpened" | "pushReceived";

/**
 * 네이티브 브리지 계약 (PRD-01A 4장): 단일 invoke(method, argsJson) → resultJson.
 * addListener/removeListeners는 NativeEventEmitter 요건. TurboModule/legacy 모두 이 표면을 만족.
 */
export interface NativeBridge {
  invoke(method: string, argsJson: string): Promise<string>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

const LINKING_ERROR =
  "NudgeOn 네이티브 모듈('NudgeOnModule')을 찾을 수 없습니다. " +
  "재빌드(pod install / gradle sync)와 autolinking을 확인하세요.";

function resolveNative(): NativeBridge {
  const mod = (NativeModules as Record<string, NativeBridge | undefined>)
    .NudgeOnModule;
  if (mod) return mod;
  return new Proxy({} as NativeBridge, {
    get() {
      throw new Error(LINKING_ERROR);
    },
  });
}

const native: NativeBridge = resolveNative();
const emitter = new NativeEventEmitter(native as unknown as never);

/**
 * 브리지 경계 직렬화 (PRD-01A 4장): args→JSON, result→parse.
 * 숫자는 double, datetime은 ISO8601 문자열 규칙을 네이티브가 준수한다.
 */
async function invoke<T = unknown>(method: string, args?: unknown): Promise<T> {
  const res = await native.invoke(method, JSON.stringify(args ?? {}));
  return (res ? JSON.parse(res) : null) as T;
}

function nativeEventName(event: PushEvent): string {
  return `nudgeon_${event}`;
}

/**
 * 리스너 등록 (PRD-01A 2.5). 콜드 스타트에서 등록 전 발생분은 네이티브가 최대 20건 버퍼링 →
 * 구독 즉시 replayBuffer 요청으로 재생(유실 0 요구 — RN에서 가장 흔히 깨지는 지점).
 */
function addListener(
  event: PushEvent,
  handler: (payload: PushPayload) => void,
): EmitterSubscription {
  const sub = emitter.addListener(nativeEventName(event), (raw: string) => {
    handler(JSON.parse(raw) as PushPayload);
  });
  // 네이티브에 이 이벤트의 버퍼 재생을 요청 (첫 구독분 유실 방지).
  void invoke("replayBuffer", { event }).catch(() => {
    /* 재생 실패는 치명적 아님 — 다음 emit 정상 */
  });
  return sub;
}

/** 공개 API — iOS/Android와 완전 동형 (PRD-01A 2장) */
const NudgeOn = {
  initialize: (config: NudgeOnConfig): Promise<void> =>
    invoke("initialize", config),
  identify: (externalId: string): Promise<void> =>
    invoke("identify", { externalId }),
  reset: (): Promise<void> => invoke("reset"),
  setUserAttributes: (attrs: Record<string, NudgeOnValue>): Promise<void> =>
    invoke("setUserAttributes", { attrs }),
  track: (name: string, properties?: Record<string, unknown>): Promise<void> =>
    invoke("track", { name, properties: properties ?? {} }),
  flush: (): Promise<void> => invoke("flush"),

  // 푸시
  registerForPush: (): Promise<PushPermissionResult> =>
    invoke<PushPermissionResult>("registerForPush"),
  setPushSubscription: (optedIn: boolean): Promise<void> =>
    invoke("setPushSubscription", { optedIn }),
  getPushSubscription: (): Promise<SubscriptionState> =>
    invoke<SubscriptionState>("getPushSubscription"),

  // 리스너 (콜드 스타트 유실 0)
  addListener,
  /** 콜드 스타트 — 푸시로 앱이 열렸으면 payload, 아니면 null (이중 경로) */
  getInitialPushPayload: (): Promise<PushPayload | null> =>
    invoke<PushPayload | null>("getInitialPushPayload"),

  // 유틸리티
  getDeviceId: (): Promise<string | null> =>
    invoke<string | null>("getDeviceId"),
  getAnonId: (): Promise<string | null> => invoke<string | null>("getAnonId"),
  setLogLevel: (level: NonNullable<NudgeOnConfig["logLevel"]>): Promise<void> =>
    invoke("setLogLevel", { level }),
};

export default NudgeOn;
