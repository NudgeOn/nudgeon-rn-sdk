package io.nudgeon.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.nudgeon.sdk.NudgeOn
import io.nudgeon.sdk.NudgeOnConfig
import io.nudgeon.sdk.PushPayload
import org.json.JSONObject
import java.util.UUID

/**
 * RN 브리지 (Android) — 무상태. invoke(method,args)를 io.nudgeon.sdk 코어로 위임하고,
 * 코어 이벤트를 nudgeon_pushOpened/received로 emit한다 (PRD-01A 4장).
 */
class NudgeOnModule(private val reactCtx: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactCtx) {

  private var openedToken: UUID? = null
  private var receivedToken: UUID? = null

  override fun getName() = "NudgeOnModule"

  override fun initialize() {
    super.initialize()
    openedToken = NudgeOn.onPushOpened { emit("nudgeon_pushOpened", it) }
    receivedToken = NudgeOn.onPushReceived { emit("nudgeon_pushReceived", it) }
  }

  override fun invalidate() {
    openedToken?.let { NudgeOn.off(it) }
    receivedToken?.let { NudgeOn.off(it) }
    super.invalidate()
  }

  private fun emit(event: String, p: PushPayload) {
    reactCtx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, payloadJson(p))
  }

  /** 단일 dispatch 진입점. argsJson → 코어 호출 → resultJson(Promise). */
  @ReactMethod
  fun invoke(method: String, argsJson: String, promise: Promise) {
    val args = runCatching { JSONObject(argsJson) }.getOrDefault(JSONObject())
    when (method) {
      "initialize" -> {
        NudgeOn.initialize(
          reactCtx.applicationContext,
          NudgeOnConfig(sdkKey = args.optString("sdkKey"), apiHost = args.optString("apiHost")),
        )
        promise.resolve(null)
      }
      "identify" -> { NudgeOn.identify(args.optString("externalId")); promise.resolve(null) }
      "reset" -> { NudgeOn.reset(); promise.resolve(null) }
      "setUserAttributes" -> {
        NudgeOn.setUserAttributes(args.optJSONObject("attrs").toMap()); promise.resolve(null)
      }
      "track" -> {
        NudgeOn.track(args.optString("name"), args.optJSONObject("properties").toMap())
        promise.resolve(null)
      }
      "flush" -> { NudgeOn.flush(); promise.resolve(null) }
      "setPushSubscription" -> { NudgeOn.setPushSubscription(args.optBoolean("optedIn", true)); promise.resolve(null) }
      "setLogLevel" -> promise.resolve(null)
      "getDeviceId" -> promise.resolve(NudgeOn.getDeviceId())
      "getAnonId" -> promise.resolve(NudgeOn.getAnonId())
      "getInitialPushPayload" ->
        promise.resolve(NudgeOn.getInitialPushPayload()?.let { payloadJson(it) })
      "replayBuffer" -> promise.resolve(null) // 코어 EventBus 자동 재생 — no-op
      "registerForPush" -> {
        // Activity 권한 요청은 호스트가 처리. 여기선 현재 상태 반영.
        NudgeOn.registerForPush(currentActivity) { r -> promise.resolve(r.name.lowercase()) }
      }
      "getPushSubscription" -> {
        val s = NudgeOn.getPushSubscription()
        promise.resolve(
          JSONObject()
            .put("serviceOptIn", s.serviceOptIn)
            .put("osPermission", s.osPermission)
            .put("tokenRegistered", s.tokenRegistered)
            .toString(),
        )
      }
      else -> promise.reject("E_METHOD", "알 수 없는 메서드: $method")
    }
  }

  // RN NativeEventEmitter 요건 (no-op — DeviceEventEmitter 사용).
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  private fun payloadJson(p: PushPayload): String = JSONObject().apply {
    put("messageId", p.messageId)
    p.campaignId?.let { put("campaignId", it) }
    p.journeyId?.let { put("journeyId", it) }
    put("title", p.title)
    put("body", p.body)
    p.deepLink?.let { put("deepLink", it) }
    p.imageUrl?.let { put("imageUrl", it) }
    put("silent", p.silent)
    put("data", JSONObject(p.data as Map<*, *>))
  }.toString()

  private fun JSONObject?.toMap(): Map<String, Any?> {
    if (this == null) return emptyMap()
    return keys().asSequence().associateWith { k -> if (isNull(k)) null else get(k) }
  }
}
