import Foundation
import NudgeOnSDK
import React

/// RN 브리지 (iOS) — 무상태. invoke(method,args)를 NudgeOnSDK 코어로 위임하고,
/// 코어 이벤트를 nudgeon_pushOpened/received로 emit한다 (PRD-01A 4장).
/// 코어가 유일한 상태 보유자 — 이 클래스에는 큐/영속/토큰 상태가 없다.
@objc(NudgeOnModule)
final class NudgeOnModule: RCTEventEmitter {
  private var openedToken: UUID?
  private var receivedToken: UUID?
  private var listeners: [String: Int] = [:]

  override static func requiresMainQueueSetup() -> Bool { false }
  override func supportedEvents() -> [String]! { ["nudgeon_pushOpened", "nudgeon_pushReceived"] }

  override func startObserving() {
    // replayBuffer attaches each native event only after its JS listener exists.
  }

  override func stopObserving() {
    if let t = openedToken { NudgeOn.off(t) }
    if let t = receivedToken { NudgeOn.off(t) }
    openedToken = nil; receivedToken = nil; listeners.removeAll()
  }

  private func attachListeners() {
    if listeners["pushOpened", default: 0] > 0 && openedToken == nil {
      openedToken = NudgeOn.onPushOpened { [weak self] p in self?.forward("nudgeon_pushOpened", p) }
    }
    if listeners["pushReceived", default: 0] > 0 && receivedToken == nil {
      receivedToken = NudgeOn.onPushReceived { [weak self] p in self?.forward("nudgeon_pushReceived", p) }
    }
  }

  private func forward(_ event: String, _ p: PushPayload) {
    guard let json = NudgeOnJSON.string(from: NudgeOnJSON.dict(p)) else { return }
    sendEvent(withName: event, body: json)
  }

  /// 단일 dispatch 진입점 (PRD-01A 4장). argsJson → 코어 호출 → resultJson.
  @objc(invoke:argsJson:resolver:rejecter:)
  func invoke(_ method: String, argsJson: String,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    let args = NudgeOnJSON.dict(fromString: argsJson)
    switch method {
    case "initialize":
      guard let config = NudgeOnJSON.config(args) else { reject("E_ARGS", "initialize 인자 오류", nil); return }
      NudgeOn.initialize(config: config)
      attachListeners()
      resolve(nil)
    case "identify":
      NudgeOn.identify(externalId: args["externalId"] as? String ?? "")
      resolve(nil)
    case "reset": NudgeOn.reset(); resolve(nil)
    case "setUserAttributes":
      NudgeOn.setUserAttributes(NudgeOnJSON.values(args["attrs"] as? [String: Any] ?? [:]))
      resolve(nil)
    case "track":
      NudgeOn.track(args["name"] as? String ?? "", properties: args["properties"] as? [String: Any])
      resolve(nil)
    case "flush": NudgeOn.flush(); resolve(nil)
    case "setPushSubscription":
      NudgeOn.setPushSubscription(args["optedIn"] as? Bool ?? true); resolve(nil)
    case "setLogLevel":
      guard let level = NudgeOnJSON.logLevel(args["level"] as? String ?? "") else { reject("E_ARGS", "logLevel 인자 오류", nil); return }
      NudgeOn.setLogLevel(level); resolve(nil)
    case "getDeviceId": resolve(NudgeOn.getDeviceId().flatMap { NudgeOnJSON.string(from: $0) })
    case "getAnonId": resolve(NudgeOn.getAnonId().flatMap { NudgeOnJSON.string(from: $0) })
    case "getInitialPushPayload":
      resolve(NudgeOn.getInitialPushPayload().flatMap { NudgeOnJSON.string(from: NudgeOnJSON.dict($0)) })
    case "replayBuffer":
      guard let event = args["event"] as? String, ["pushOpened", "pushReceived"].contains(event) else { reject("E_ARGS", "event 인자 오류", nil); return }
      listeners[event, default: 0] += 1
      attachListeners(); resolve(nil)
    case "releaseListener":
      let event = args["event"] as? String ?? ""
      listeners[event] = max(0, listeners[event, default: 0] - 1)
      if event == "pushOpened", listeners[event] == 0, let token = openedToken { NudgeOn.off(token); openedToken = nil }
      if event == "pushReceived", listeners[event] == 0, let token = receivedToken { NudgeOn.off(token); receivedToken = nil }
      resolve(nil)
    case "registerForPush":
      Task { let r = await NudgeOn.registerForPush(); resolve(NudgeOnJSON.string(from: r.rawValue)) }
    case "getPushSubscription":
      Task {
        let s = await NudgeOn.getPushSubscription()
        resolve(NudgeOnJSON.string(from: [
          "serviceOptIn": s.serviceOptIn,
          "osPermission": s.osPermission,
          "tokenRegistered": s.tokenRegistered,
        ]))
      }
    default:
      reject("E_METHOD", "알 수 없는 메서드: \(method)", nil)
    }
  }
}
