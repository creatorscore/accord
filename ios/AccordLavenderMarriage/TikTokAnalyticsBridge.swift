import Foundation
import TikTokBusinessSDK

@objc(TikTokAnalyticsBridge)
class TikTokAnalyticsBridge: NSObject {

  @objc func trackRegistration() {
    TikTokAnalytics.trackRegistration()
  }

  @objc func trackLogin() {
    TikTokAnalytics.trackLogin()
  }

  @objc func trackCompleteTutorial() {
    TikTokAnalytics.trackCompleteTutorial()
  }

  @objc func identifyUser(_ externalId: String, email: String?) {
    TikTokAnalytics.identifyUser(externalId: externalId, email: email)
  }

  @objc func trackStartTrial() {
    TikTokAnalytics.trackStartTrial()
  }

  @objc func trackSubscribe() {
    TikTokAnalytics.trackSubscribe()
  }

  @objc func trackPurchase(_ productId: String, productName: String, price: Double, currency: String) {
    TikTokAnalytics.trackPurchase(productId: productId, productName: productName, price: price, currency: currency)
  }

  @objc func trackAddPaymentInfo() {
    TikTokAnalytics.trackAddPaymentInfo()
  }

  @objc func trackViewContent(_ profileId: String, profileName: String) {
    TikTokAnalytics.trackViewContent(profileId: profileId, profileName: profileName)
  }

  @objc func trackSearch() {
    TikTokAnalytics.trackSearch()
  }

  @objc func trackGenerateLead() {
    TikTokAnalytics.trackGenerateLead()
  }

  @objc func trackAddToWishlist(_ profileId: String, profileName: String) {
    TikTokAnalytics.trackAddToWishlist(profileId: profileId, profileName: profileName)
  }

  @objc func trackLaunchApp() {
    TikTokAnalytics.trackLaunchApp()
  }

  @objc func trackCustomEvent(_ eventName: String) {
    TikTokAnalytics.trackCustomEvent(eventName: eventName)
  }
}
