#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// OndaModule(Swift)을 RN에 노출 (PRD-01A 4장 단일 dispatch 계약).
@interface RCT_EXTERN_MODULE(OndaModule, RCTEventEmitter)

RCT_EXTERN_METHOD(invoke:(NSString *)method
                  argsJson:(NSString *)argsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
