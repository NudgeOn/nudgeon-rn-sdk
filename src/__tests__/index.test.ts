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
      return { remove: () => { listeners[name] = []; } };
    }
  },
}));

// 목 등록 후 import (모듈 로드 시 emitter 생성).
import NudgeOn from "../index";

function emit(name: string, raw: string) {
  (listeners[name] || []).forEach((cb) => cb(raw));
}

beforeEach(() => {
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
});

describe("리스너 재생", () => {
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
