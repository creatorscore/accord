#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TikTokAnalyticsBridge, NSObject)

RCT_EXTERN_METHOD(trackRegistration)
RCT_EXTERN_METHOD(trackLogin)
RCT_EXTERN_METHOD(trackCompleteTutorial)
RCT_EXTERN_METHOD(identifyUser:(NSString *)externalId email:(NSString *)email)
RCT_EXTERN_METHOD(trackStartTrial)
RCT_EXTERN_METHOD(trackSubscribe)
RCT_EXTERN_METHOD(trackPurchase:(NSString *)productId productName:(NSString *)productName price:(double)price currency:(NSString *)currency)
RCT_EXTERN_METHOD(trackAddPaymentInfo)
RCT_EXTERN_METHOD(trackViewContent:(NSString *)profileId profileName:(NSString *)profileName)
RCT_EXTERN_METHOD(trackSearch)
RCT_EXTERN_METHOD(trackGenerateLead)
RCT_EXTERN_METHOD(trackAddToWishlist:(NSString *)profileId profileName:(NSString *)profileName)
RCT_EXTERN_METHOD(trackLaunchApp)
RCT_EXTERN_METHOD(trackCustomEvent:(NSString *)eventName)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
