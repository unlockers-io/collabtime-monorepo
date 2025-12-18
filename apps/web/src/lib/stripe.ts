import Stripe from "stripe";

// Lazily initialized Stripe client to avoid build-time errors
// when environment variables aren't available
let _stripe: Stripe | null = null;

/**
 * Get the Stripe client instance (lazily initialized).
 */
const getStripe = (): Stripe => {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
};

export { getStripe };
