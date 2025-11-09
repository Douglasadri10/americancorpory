// src/lib/stripe.ts
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  throw new Error("STRIPE_SECRET_KEY ausente no ambiente.");
}
if (key.startsWith("pk_")) {
  // Evita confusão com a chave pública
  throw new Error(
    "STRIPE_SECRET_KEY está com uma chave publicável (pk_). Use a chave secreta (sk_)."
  );
}

const stripe = new Stripe(key, {
  apiVersion: "2025-07-30.basil",
});

export default stripe;
