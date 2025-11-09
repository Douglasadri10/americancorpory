import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const defaultTemplateSid =
  process.env.TWILIO_TEMPLATE_SID ||
  process.env.TWILIO_REMINDER_TEMPLATE_SID;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not set in environment variables.");
  }
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

export type SendMessageOptions = {
  to: string; // telefone internacional ex: +5599...
  body?: string;
  from?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
};

export async function sendWhatsAppMessage({
  to,
  body,
  from,
  contentSid,
  contentVariables,
}: SendMessageOptions) {
  const sender = from ?? whatsappFrom;
  if (!sender) {
    throw new Error("TWILIO_WHATSAPP_FROM is not configured.");
  }

  const formattedTo = to.startsWith("whatsapp:")
    ? to
    : `whatsapp:${to.startsWith("+") ? to : `+${to}`}`;

  const formattedFrom = sender.startsWith("whatsapp:")
    ? sender
    : `whatsapp:${sender.startsWith("+") ? sender : `+${sender}`}`;

  const twilioClient = getClient();
  const templateToUse = contentSid || defaultTemplateSid;

  if (templateToUse) {
    await twilioClient.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid: templateToUse,
      ...(contentVariables
        ? { contentVariables: JSON.stringify(contentVariables) }
        : {}),
    });
    return;
  }

  if (!body) {
    throw new Error(
      "sendWhatsAppMessage requires either a body or a contentSid."
    );
  }

  await twilioClient.messages.create({
    from: formattedFrom,
    to: formattedTo,
    body,
  });
}

export function formatReminderMessage({
  responsavelNome,
  criancaNome,
}: {
  responsavelNome: string;
  criancaNome: string;
}) {
  return `*Mensagem Automática 💬*

Olá ${responsavelNome},

Estamos iniciando mais uma semana de transporte e precisamos confirmar o pagamento referente a ${criancaNome}.

Lembrando do *Zelle da American Corpory* para o pagamento semanal.

💵 Zelle: 407-360-1394  
M&D Solutions LLC  

👉 Pais com alunos no tutoring (Westpoint): acrescentar o valor extra de $10 junto ao pagamento.

Se o pagamento já foi feito, por favor desconsidere esta mensagem ou envie o comprovante.

Agradecemos a pontualidade e parceria de sempre 💜  

— *Equipe American Corpory / M&D Solutions*
`;
}
