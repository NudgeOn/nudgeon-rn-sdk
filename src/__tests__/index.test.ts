/**
 * 브리지 경계 테스트 (PRD-01A 8장 DoD: 직렬화·이벤트 스트림 경계 100%).
 * react-native를 목으로 대체 — 브리지의 JS 레이어 직렬화·리스너 재생만 검증한다.
 */

type Listener = (raw: string) => void;
const listeners: Record<string, Listener[]> = {};
const invokeMock = jest.fn(
  async (_method: string, _argsJson: string): Promise<string> => "null",
);

jest.mock("react-native", () => ({
  NativeModules: {
    NudgeOnModule: {
      invoke: invokeMock,
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    },
  },
  NativeEventEmitter: class {
    addListener(name: string, cb: Listener) {
      (listeners[name] ||= []).push(cb);
      return { remove: () => { listeners[name] = listeners[name].filter(listener => listener !== cb); } };
    }
  },
}));

// 목 등록 후 import (모듈 로드 시 emitter 생성).
import NudgeOn, { NudgeOnEvents, NudgeOnAttributes } from "../index";

function emit(name: string, raw: string) {
  (listeners[name] || []).forEach((cb) => cb(raw));
}

beforeEach(() => {
  for (const key of Object.keys(listeners)) delete listeners[key];
  invokeMock.mockClear();
  invokeMock.mockResolvedValue("null");
});

describe("직렬화 경계", () => {
  it("track args를 JSON으로 직렬화해 invoke 호출", async () => {
    await NudgeOn.track("product_viewed", { product_id: "P-1", price: 12900 });
    expect(invokeMock).toHaveBeenCalledWith(
      "track",
      JSON.stringify({ name: "product_viewed", properties: { product_id: "P-1", price: 12900 } }),
    );
  });

  it("빈 인자 메서드는 {}로 직렬화", async () => {
    await NudgeOn.flush();
    expect(invokeMock).toHaveBeenCalledWith("flush", "{}");
  });

  it("결과 JSON을 파싱해 반환", async () => {
    invokeMock.mockResolvedValueOnce('"granted"');
    await expect(NudgeOn.registerForPush()).resolves.toBe("granted");
  });

  it("null 결과를 null로 반환 (getInitialPushPayload 미탑재)", async () => {
    invokeMock.mockResolvedValueOnce("null");
    await expect(NudgeOn.getInitialPushPayload()).resolves.toBeNull();
  });

  it("decodes escaped string identifiers from the native JSON contract", async () => {
    invokeMock.mockResolvedValueOnce(JSON.stringify('device-"id"'));
    await expect(NudgeOn.getDeviceId()).resolves.toBe('device-"id"');
  });
});

describe("리스너 재생", () => {
  it("removes each native subscription once without removing another JS listener", () => {
    const got: string[] = [];
    const first = NudgeOn.addListener("pushOpened", () => got.push("first"));
    const second = NudgeOn.addListener("pushOpened", () => got.push("second"));
    first.remove(); first.remove();
    emit("nudgeon_pushOpened", JSON.stringify({messageId: "m", title: "", body: "", data: {}}));
    expect(got).toEqual(["second"]);
    expect(invokeMock.mock.calls.filter(([method]) => method === "releaseListener")).toEqual([
      ["releaseListener", JSON.stringify({event: "pushOpened"})],
    ]);
    second.remove();
  });
  it("네이티브 emit(JSON 문자열)을 파싱해 핸들러에 전달", () => {
    const got: string[] = [];
    NudgeOn.addListener("pushOpened", (p) => got.push(p.messageId));
    emit(
      "nudgeon_pushOpened",
      JSON.stringify({ messageId: "m1", title: "t", body: "b", data: {} }),
    );
    expect(got).toEqual(["m1"]);
  });

  it("구독 시 네이티브 버퍼 재생을 요청 (콜드 스타트 유실 0)", () => {
    NudgeOn.addListener("pushReceived", () => {});
    expect(invokeMock).toHaveBeenCalledWith(
      "replayBuffer",
      JSON.stringify({ event: "pushReceived" }),
    );
  });
});

// Public exports must cross the existing native bridge as canonical string names.
describe("standard events", () => {
  it.each([
    [NudgeOnEvents.signUp, "sign_up"],
    [NudgeOnEvents.login, "login"],
    [NudgeOnEvents.purchaseCompleted, "purchase_completed"],
    [NudgeOnEvents.productViewed, "product_viewed"],
    [NudgeOnEvents.addToCart, "add_to_cart"],
    [NudgeOnEvents.checkoutStarted, "checkout_started"],
    ["purchase", "purchase"],
  ])("serializes %s without renaming or coercing properties", async (name, wireName) => {
    const properties = { order_id: "order-123", total_amount: 29000, currency: "KRW", item_count: 1 };
    await NudgeOn.track(name, properties);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("track", JSON.stringify({ name: wireName, properties }));
  });
});

// Standard keys retain the established native attribute transport and null semantics.
it("serializes standard profile keys alongside custom values and unsets", async () => {
  const attrs = {
    [NudgeOnAttributes.firstName]: "Minji",
    [NudgeOnAttributes.lastName]: "Kim",
    [NudgeOnAttributes.email]: "minji@example.com",
    [NudgeOnAttributes.phone]: "+821012345678",
    [NudgeOnAttributes.dateOfBirth]: "1995-03-15",
    [NudgeOnAttributes.gender]: "F",
    [NudgeOnAttributes.homeCity]: "Seoul",
    [NudgeOnAttributes.country]: "KR",
    [NudgeOnAttributes.language]: "ko",
    [NudgeOnAttributes.timezone]: "Asia/Seoul",
    [NudgeOnAttributes.createdAt]: "2026-09-22T00:00:00Z",
    score: 0, enabled: false, interests: ["music"], removed: null,
  };
  await NudgeOn.setUserAttributes(attrs);
  expect(invokeMock).toHaveBeenCalledTimes(1);
  const [method, raw] = invokeMock.mock.calls[0]!;
  expect(method).toBe("setUserAttributes");
  expect(JSON.parse(raw)).toEqual({ attrs: {"first_name": "Minji", "last_name": "Kim", "email": "minji@example.com", "phone": "+821012345678", "dob": "1995-03-15", "gender": "F", "home_city": "Seoul", "country": "KR", "language": "ko", "timezone": "Asia/Seoul", "created_at": "2026-09-22T00:00:00Z", "score": 0, "enabled": false, "interests": ["music"], "removed": null} });
});
