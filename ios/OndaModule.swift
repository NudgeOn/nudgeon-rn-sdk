import Foundation
import OndaSDK
import React

/// RN 브리지 (iOS) — 무상태. invoke(method,args)를 OndaSDK 코어로 위임하고,
/// 코어 이벤트를 onda_pushOpened/received로 emit한다 (PRD-01A 4장).
/// 코어가 유일한 상태 보유자 — 이 클래스에는 큐/영속/토큰 상태가 없다.
@objc(OndaModule)
final class OndaModule: RCTEventEmitter {
  private var openedToken: UUID?
  private var receivedToken: UUID?

  override static func requiresMainQueueSetup() -> Bool { false }
  override func supportedEvents() -> [String]! { ["onda_pushOpened", "onda_pushReceived"] }

  override func startObserving() {
    openedToken = Onda.onPushOpened { [weak self] p in self?.forward("onda_pushOpened", p) }
    receivedToken = Onda.onPushReceived { [weak self] p in self?.forward("onda_pushReceived", p) }
  }

  override func stopObserving() {
    if let t = openedToken { Onda.off(t) }
    if let t = receivedToken { Onda.off(t) }
  }

  private func forward(_ event: String, _ p: PushPayload) {
    guard let json = OndaJSON.string(from: OndaJSON.dict(p)) else { return }
    sendEvent(withName: event, body: json)
  }

  /// 단일 dispatch 진입점 (PRD-01A 4장). argsJson → 코어 호출 → resultJson.
  @objc(invoke:argsJson:resolver:rejecter:)
  func invoke(_ method: String, argsJson: String,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    let args = OndaJSON.dict(fromString: argsJson)
    switch method {
    case "initialize":
      guard let key = args["sdkKey"] as? String, let host = args["apiHost"] as? String,
            let url = URL(string: host) else { reject("E_ARGS", "initialize 인자 오류", nil); return }
      Onda.initialize(config: OndaConfig(sdkKey: key, apiHost: url))
      resolve(nil)
    case "identify":
      Onda.identify(externalId: args["externalId"] as? String ?? "")
      resolve(nil)
    case "reset": Onda.reset(); resolve(nil)
    case "setUserAttributes":
      Onda.setUserAttributes(OndaJSON.values(args["attrs"] as? [String: Any] ?? [:]))
      resolve(nil)
    case "track":
      Onda.track(args["name"] as? String ?? "", properties: args["properties"] as? [String: Any])
      resolve(nil)
    case "flush": Onda.flush(); resolve(nil)
    case "setPushSubscription":
      Onda.setPushSubscription(args["optedIn"] as? Bool ?? true); resolve(nil)
    case "setLogLevel": resolve(nil)
    case "getDeviceId": resolve(Onda.getDeviceId())
    case "getAnonId": resolve(Onda.getAnonId())
    case "getInitialPushPayload":
      resolve(Onda.getInitialPushPayload().flatMap { OndaJSON.string(from: OndaJSON.dict($0)) })
    case "replayBuffer":
      resolve(nil) // 코어 EventBus가 첫 구독 시 자동 재생 — no-op
    case "registerForPush":
      Task { let r = await Onda.registerForPush(); resolve(r.rawValue) }
    case "getPushSubscription":
      Task {
        let s = await Onda.getPushSubscription()
        resolve(OndaJSON.string(from: [
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

/// 브리지 직렬화 헬퍼 (PRD-01A 4장 타입 규칙).
enum OndaJSON {
  static func dict(fromString s: String) -> [String: Any] {
    guard let data = s.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
    return obj
  }
  static func string(from obj: Any) -> String? {
    guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return nil }
    return String(data: data, encoding: .utf8)
  }
  static func dict(_ p: PushPayload) -> [String: Any] {
    var d: [String: Any] = ["messageId": p.messageId, "title": p.title, "body": p.body, "data": p.data]
    if let c = p.campaignId { d["campaignId"] = c }
    if let j = p.journeyId { d["journeyId"] = j }
    if let l = p.deepLink { d["deepLink"] = l }
    return d
  }
  static func values(_ raw: [String: Any]) -> [String: OndaValue] {
    raw.mapValues { v in
      switch v {
      case let s as String: return .string(s)
      case let b as Bool: return .bool(b)
      case let n as NSNumber: return .number(n.doubleValue)
      case let a as [String]: return .stringArray(a)
      default: return .null
      }
    }
  }
}
