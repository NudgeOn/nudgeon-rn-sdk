#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// NudgeOnModule(Swift)을 RN에 노출 (PRD-01A 4장 단일 dispatch 계약).
@interface RCT_EXTERN_MODULE(NudgeOnModule, RCTEventEmitter)

RCT_EXTERN_METHOD(invoke:(NSString *)method
                  argsJson:(NSString *)argsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
