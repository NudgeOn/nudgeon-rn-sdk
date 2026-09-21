/** Recommended names shared with the console. Pass to NudgeOn.track after success.
 * Constants do not emit events or identify users; custom names remain supported.
 */
export const NudgeOnEvents = Object.freeze({
  signUp: "sign_up",
  login: "login",
  purchaseCompleted: "purchase_completed",
  productViewed: "product_viewed",
  addToCart: "add_to_cart",
  checkoutStarted: "checkout_started",
} as const);

export type NudgeOnStandardEvent = (typeof NudgeOnEvents)[keyof typeof NudgeOnEvents];
