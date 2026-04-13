import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_APP_NAME, LEGAL_CONTACT_EMAIL, getLegalBaseUrl } from '@/lib/legal';

const title = `Data Deletion Instructions | ${LEGAL_APP_NAME}`;
const description =
  'Instruções de exclusão de dados do HannaAI para App Review da Meta, incluindo o processo de solicitação, escopo da exclusão e limites relativos a dados mantidos pela própria Meta.';

export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${getLegalBaseUrl()}/data-deletion`,
  },
};

export default function DataDeletionPage() {
  return (
    <LegalDocument
      eyebrow="Data Deletion"
      title="Data Deletion Instructions"
      summary={`Esta página descreve como titulares, clientes e administradores de workspace podem solicitar exclusão de dados tratados pelo ${LEGAL_APP_NAME}. Esta URL pode ser utilizada como "Data Deletion Instructions URL" para integrações e revisões da Meta.`}
      sections={[
        {
          title: '1. Escopo desta página',
          content: (
            <>
              <p>
                Estas instruções se aplicam aos dados armazenados ou processados pelo {LEGAL_APP_NAME} em seus próprios
                sistemas, incluindo dados de conta, workspaces, canais conectados, mensagens, leads, automações, logs e
                configurações relacionadas à operação do produto.
              </p>
              <p>
                Esta página não substitui os mecanismos de exclusão de dados mantidos pela própria Meta, pelo Instagram,
                pelo Facebook ou por outras plataformas terceiras. Dados controlados por essas plataformas devem ser
                gerenciados nos ambientes oficiais de cada uma delas.
              </p>
            </>
          ),
        },
        {
          title: '2. Quem pode solicitar a exclusão',
          content: (
            <>
              <p>Podem solicitar exclusão, conforme o caso:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>o titular da conta cadastrada no {LEGAL_APP_NAME};</li>
                <li>o administrador do workspace responsável pelo canal integrado;</li>
                <li>o titular de dados pessoais presentes em conversas ou leads, por si ou por representante válido;</li>
                <li>
                  plataformas parceiras, quando houver requisição oficial tecnicamente válida vinculada a identificadores
                  da integração.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: '3. O que pode ser excluído',
          content: (
            <>
              <p>Conforme o escopo do pedido e a base legal aplicável, a exclusão pode abranger:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>dados de perfil da conta e do workspace;</li>
                <li>configurações de canais conectados e tokens associados armazenados por nós;</li>
                <li>mensagens, históricos de conversa, contatos, leads, tags, notas e automações;</li>
                <li>metadados internos e registros operacionais relacionados ao uso da plataforma.</li>
              </ul>
              <p>
                Alguns registros poderão ser retidos por obrigação legal, segurança, prevenção de fraude, defesa de
                direitos, controle financeiro ou auditoria mínima necessária.
              </p>
            </>
          ),
        },
        {
          title: '4. Como solicitar',
          content: (
            <>
              <p>
                Para solicitar exclusão de dados, envie e-mail para{' '}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Data%20Deletion%20Request%20-%20${encodeURIComponent(LEGAL_APP_NAME)}`}
                  className="text-text-primary underline decoration-border-hover underline-offset-4"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>{' '}
                com o assunto <strong>Data Deletion Request - {LEGAL_APP_NAME}</strong>.
              </p>
              <p>Inclua, sempre que possível:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>nome completo do solicitante;</li>
                <li>e-mail da conta ou do workspace relacionado;</li>
                <li>nome do workspace e canal conectado, se houver;</li>
                <li>identificadores relevantes, como username, página ou conta integrada;</li>
                <li>descrição clara do que deve ser excluído;</li>
                <li>prova razoável de titularidade ou autorização, quando necessária.</li>
              </ul>
            </>
          ),
        },
        {
          title: '5. Etapas do processo',
          content: (
            <>
              <ol className="list-decimal space-y-2 pl-6">
                <li>recebemos e registramos a solicitação;</li>
                <li>validamos identidade, autoridade e escopo do pedido;</li>
                <li>localizamos os dados aplicáveis em conta, workspace, mensagens, leads e integrações;</li>
                <li>executamos exclusão, anonimização ou bloqueio, conforme cabível;</li>
                <li>enviamos uma confirmação ao solicitante quando o processo for concluído.</li>
              </ol>
            </>
          ),
        },
        {
          title: '6. Prazo estimado',
          content: (
            <>
              <p>
                Nosso prazo padrão é de até 15 dias corridos para responder e encaminhar pedidos regulares, podendo ser
                reduzido ou ampliado conforme a complexidade do caso, a necessidade de verificação adicional e os
                prazos obrigatórios previstos em lei.
              </p>
            </>
          ),
        },
        {
          title: '7. Dados mantidos pela Meta e por terceiros',
          content: (
            <>
              <p>
                O {LEGAL_APP_NAME} não controla todos os dados mantidos por Meta Platforms ou por outras plataformas
                conectadas. Se o usuário quiser excluir dados armazenados diretamente em contas do Instagram, Facebook ou
                WhatsApp, deve também utilizar os mecanismos de exclusão disponibilizados pela própria plataforma
                correspondente.
              </p>
              <p>
                A exclusão em nossos sistemas não apaga automaticamente dados que continuem hospedados em provedores
                externos, logs de conformidade obrigatórios ou registros financeiros sujeitos a retenção legal.
              </p>
            </>
          ),
        },
        {
          title: '8. Solicitações enviadas por plataformas parceiras',
          content: (
            <>
              <p>
                Quando uma plataforma parceira enviar solicitação oficial baseada em identificadores de integração,
                processaremos o pedido de acordo com esta política, nossos registros internos e a legislação aplicável.
                Caso necessário, poderemos contatar o administrador do workspace para confirmar contexto ou escopo.
              </p>
            </>
          ),
        },
        {
          title: '9. Contato para acompanhamento',
          content: (
            <>
              <p>
                Dúvidas sobre o status de uma solicitação de exclusão podem ser encaminhadas para{' '}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="text-text-primary underline decoration-border-hover underline-offset-4"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
