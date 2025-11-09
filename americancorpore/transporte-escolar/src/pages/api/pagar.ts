// src/pages/api/pagar.ts
import type { NextApiRequest, NextApiResponse } from "next";
import stripe from "@/lib/stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      responsavelNome,
      responsavelUid,
      responsavelEmail,
      criancaNome,
      criancaId,
      idUnico,
      // compat: tanto faz o nome que vier
      valorSemanalCents,
      valor, // legado: já em centavos no nosso fluxo atual
    } = req.body || {};

    // coalesce dos campos de amount (sempre em centavos)
    let amount = Number(valorSemanalCents ?? valor ?? 0);

    if (!Number.isFinite(amount)) amount = 0;
    // garantia de inteiro
    amount = Math.round(amount);

    if (!criancaNome || amount <= 0) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const origin =
      (req.headers.origin as string) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: responsavelEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount, // CENTAVOS
            product_data: {
              name: `Transporte Escolar — ${criancaNome}`,
              description: `Pagamento semanal do responsável ${
                responsavelNome || ""
              }`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        responsavelUid: responsavelUid || "",
        responsavelNome: responsavelNome || "",
        responsavelEmail: responsavelEmail || "",
        criancaId: criancaId || "",
        idUnico: idUnico?.toString() || "",
        tipo: "pagamento_semanal",
      },
      success_url: `${origin}/responsavel?status=success`,
      cancel_url: `${origin}/responsavel?status=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe error:", error);
    const message =
      error instanceof Error ? error.message : "Erro no Stripe";
    return res.status(500).json({ error: message });
  }
}
