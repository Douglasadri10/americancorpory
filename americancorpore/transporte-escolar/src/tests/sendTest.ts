import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import {
  sendWhatsAppMessage,
  formatReminderMessage,
} from "../services/twilio";

async function run() {
  const [, , cliPhone, cliNomeResponsavel, cliNomeCrianca] = process.argv;

  const to =
    cliPhone ||
    process.env.TEST_WHATSAPP_TO ||
    process.env.TWILIO_TEST_WHATSAPP_TO;

  if (!to) {
    throw new Error(
      "Informe o número destino via argumento (ex.: ts-node src/tests/sendTest.ts +5511999999999) ou defina TEST_WHATSAPP_TO/TWILIO_TEST_WHATSAPP_TO no .env."
    );
  }

  const responsavelNome =
    cliNomeResponsavel || process.env.TEST_RESPONSAVEL || "Responsável";
  const criancaNome = cliNomeCrianca || process.env.TEST_CRIANCA || "aluno(a)";

  const templateSid =
    process.env.TWILIO_TEMPLATE_SID ||
    process.env.TWILIO_REMINDER_TEMPLATE_SID ||
    "HXc6cf25a0776fed140308222a5b8ffa2d";

  console.log("Enviando mensagem para", to);

  if (templateSid) {
    await sendWhatsAppMessage({
      to,
      contentSid: templateSid,
      contentVariables: {
        responsavel: responsavelNome,
        crianca: criancaNome,
      },
    });
  } else {
    const body = formatReminderMessage({
      responsavelNome,
      criancaNome,
    });

    await sendWhatsAppMessage({ to, body });
  }
  console.log("✅ Mensagem enviada com sucesso!");
}

run().catch((err) => {
  console.error("Falha ao enviar mensagem de teste:", err);
  process.exit(1);
});
