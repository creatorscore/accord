import Foundation
import TikTokBusinessSDK

@objc(TikTokAnalytics)
class TikTokAnalytics: NSObject {

  // MARK: - User Events

  @objc static func trackRegistration() {
    let event = TikTokBaseEvent(eventName: "Registration")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackLogin() {
    let event = TikTokBaseEvent(eventName: "Login")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackCompleteTutorial() {
    let event = TikTokBaseEvent(eventName: "CompleteTutorial")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func identifyUser(externalId: String, email: String?) {
    TikTokBusiness.identify(withExternalID: externalId, externalUserName: nil, phoneNumber: nil, email: email)
  }

  // MARK: - Subscription Events

  @objc static func trackStartTrial() {
    let event = TikTokBaseEvent(eventName: "StartTrial")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackSubscribe() {
    let event = TikTokBaseEvent(eventName: "Subscribe")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackPurchase(productId: String, productName: String, price: Double, currency: String) {
    let event = TikTokPurchaseEvent()
    event.setContentId(productId)
    event.setCurrency(.USD)
    event.setDescription(productName)
    event.setContentType("subscription")
    event.setValue(String(price))

    let eventContent = TikTokContentParams()
    eventContent.price = NSNumber(value: price)
    eventContent.quantity = 1
    eventContent.contentName = productName
    event.setContents([eventContent])

    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackAddPaymentInfo() {
    let event = TikTokBaseEvent(eventName: "AddPaymentInfo")
    TikTokBusiness.trackTTEvent(event)
  }

  // MARK: - Engagement Events

  @objc static func trackViewContent(profileId: String, profileName: String) {
    let event = TikTokViewContentEvent()
    event.setContentId(profileId)
    event.setContentType("profile")
    event.setDescription("Viewed profile: \(profileName)")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackSearch() {
    let event = TikTokBaseEvent(eventName: "Search")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackGenerateLead() {
    // Track when a match is made
    let event = TikTokBaseEvent(eventName: "GenerateLead")
    TikTokBusiness.trackTTEvent(event)
  }

  @objc static func trackAddToWishlist(profileId: String, profileName: String) {
    // Track when user likes a profile
    let event = TikTokAddToWishlistEvent()
    event.setContentId(profileId)
    event.setContentType("profile")
    event.setDescription("Liked profile: \(profileName)")
    TikTokBusiness.trackTTEvent(event)
  }

  // MARK: - App Events

  @objc static func trackLaunchApp() {
    let event = TikTokBaseEvent(eventName: "LaunchAPP")
    TikTokBusiness.trackTTEvent(event)
  }

  // MARK: - Custom Event

  @objc static func trackCustomEvent(eventName: String) {
    let event = TikTokBaseEvent(eventName: eventName)
    TikTokBusiness.trackTTEvent(event)
  }
}
