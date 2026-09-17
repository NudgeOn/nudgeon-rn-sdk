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
  private val listeners = mutableMapOf<String, Int>()

  override fun getName() = "NudgeOnModule"

  override fun initialize() {
    super.initialize()
    // Subscribe only after the corresponding JS listener has been installed.
  }

  override fun invalidate() {
    openedToken?.let { NudgeOn.off(it) }
    receivedToken?.let { NudgeOn.off(it) }
    openedToken = null; receivedToken = null; listeners.clear()
    super.invalidate()
  }

  private fun attachListeners() {
    if ((listeners["pushOpened"] ?: 0) > 0 && openedToken == null)
      openedToken = NudgeOn.onPushOpened { emit("nudgeon_pushOpened", it) }
    if ((listeners["pushReceived"] ?: 0) > 0 && receivedToken == null)
      receivedToken = NudgeOn.onPushReceived { emit("nudgeon_pushReceived", it) }
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
        if (args.has("logLevel")) {
          promise.reject("E_UNSUPPORTED", "Android core 0.2.2 does not support logLevel"); return
        }
        val interval = args.optDouble("flushInterval", 10.0)
        val size = args.optDouble("flushBatchSize", 10.0)
        val host = args.optString("apiHost")
        val uri = runCatching { java.net.URI(host) }.getOrNull()
        if (args.optString("sdkKey").isEmpty() || uri?.host == null || uri.scheme !in listOf("http", "https") ||
          !interval.isFinite() || interval < 1 || interval > Int.MAX_VALUE || interval % 1.0 != 0.0 ||
          !size.isFinite() || size < 1 || size > Int.MAX_VALUE || size % 1.0 != 0.0) {
          promise.reject("E_ARGS", "Invalid initialize configuration"); return
        }
        NudgeOn.initialize(
          reactCtx.applicationContext,
          NudgeOnConfig(sdkKey = args.optString("sdkKey"), apiHost = host,
            flushIntervalSeconds = interval.toLong(), flushBatchSize = size.toInt(),
            autoTrackSessions = args.optBoolean("autoTrackSessions", true),
            autoRegisterPushToken = args.optBoolean("autoRegisterPushToken", true)),
        )
        attachListeners()
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
      "setLogLevel" -> promise.reject("E_UNSUPPORTED", "Android core 0.2.2 does not support logLevel")
      "getDeviceId" -> promise.resolve(NudgeOn.getDeviceId()?.let { JSONObject.quote(it) })
      "getAnonId" -> promise.resolve(NudgeOn.getAnonId()?.let { JSONObject.quote(it) })
      "getInitialPushPayload" ->
        promise.resolve(NudgeOn.getInitialPushPayload()?.let { payloadJson(it) })
      "replayBuffer" -> {
        val event = args.optString("event")
        if (event !in listOf("pushOpened", "pushReceived")) { promise.reject("E_ARGS", "Invalid event"); return }
        listeners[event] = (listeners[event] ?: 0) + 1
        attachListeners(); promise.resolve(null)
      }
      "releaseListener" -> {
        val event = args.optString("event")
        listeners[event] = ((listeners[event] ?: 0) - 1).coerceAtLeast(0)
        if (event == "pushOpened" && listeners[event] == 0) { openedToken?.let { NudgeOn.off(it) }; openedToken = null }
        if (event == "pushReceived" && listeners[event] == 0) { receivedToken?.let { NudgeOn.off(it) }; receivedToken = null }
        promise.resolve(null)
      }
      "registerForPush" -> {
        // UI thread에서 현재 Activity로 요청한다. 호스트는 권한 결과를 코어에 전달한다.
        reactCtx.runOnUiQueueThread {
          NudgeOn.registerForPush(reactCtx.currentActivity) { r -> promise.resolve(JSONObject.quote(r.name.lowercase())) }
        }
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
