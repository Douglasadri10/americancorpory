import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_APP_NAME, LEGAL_CONTACT_EMAIL, getLegalBaseUrl } from '@/lib/legal';

const title = `Política de Privacidade | ${LEGAL_APP_NAME}`;
const description =
  'Política de Privacidade do HannaAI para App Review da Meta, incluindo tratamento de dados de mensagens, canais conectados e automações com IA.';

export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${getLegalBaseUrl()}/privacy-policy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Política de Privacidade"
      title="Política de Privacidade"
      summary={`${LEGAL_APP_NAME} é uma plataforma de atendimento omnichannel com integração a Instagram, Facebook e outros canais. Esta Política de Privacidade explica quais dados são coletados, como são utilizados, com quem podem ser compartilhados e quais direitos os titulares possuem ao usar a plataforma, seus recursos de automação e seus recursos de inteligência artificial.`}
      sections={[
        {
          title: '1. Escopo e controlador responsável',
          content: (
            <>
              <p>
                Esta Política se aplica ao website, painel administrativo, integrações, APIs, webhooks e demais
                recursos operados pelo {LEGAL_APP_NAME}. Para fins deste documento, “nós”, “nosso” e “plataforma”
                significam o {LEGAL_APP_NAME} e o responsável por esta implantação.
              </p>
              <p>
                Para dúvidas, solicitações de privacidade ou exercício de direitos, o contato principal é{' '}
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
        {
          title: '2. Dados que coletamos',
          content: (
            <>
              <p>Podemos coletar e tratar as seguintes categorias de dados:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  dados de cadastro e conta, como nome, e-mail, identificadores de autenticação e informações básicas do
                  workspace;
                </li>
                <li>
                  dados de canais conectados, como IDs de página, IDs de conta profissional do Instagram, nomes de
                  página, usernames, tokens de acesso, estado do webhook e metadados técnicos de integração;
                </li>
                <li>
                  dados de mensagens e conversas, incluindo conteúdo textual, anexos suportados, metadados de
                  mensagens, horários, recibos de leitura, IDs externos e histórico operacional;
                </li>
                <li>
                  dados de contatos e leads, como nome, username, telefone, e-mail, empresa, tags, observações e
                  informações comerciais registradas no CRM interno da plataforma;
                </li>
                <li>
                  dados de uso e segurança, como logs de webhook, registros de erro, IP, informações do navegador,
                  auditoria interna e eventos de uso necessários para suporte, proteção contra fraude e melhoria do
                  serviço;
                </li>
                <li>
                  dados de cobrança e assinatura quando aplicável, incluindo plano contratado, status da assinatura,
                  identificadores de cliente e metadados de faturamento processados por provedores de pagamento;
                </li>
                <li>
                  dados do registro global de canais, incluindo identificadores técnicos de páginas e números de
                  WhatsApp vinculados, workspace associado, datas de conexão e desconexão e período de carência
                  aplicável, utilizados exclusivamente para garantir a unicidade de canais e prevenir abuso de planos.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: '3. Como os dados são coletados',
          content: (
            <>
              <p>Os dados podem ser obtidos das seguintes fontes:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>diretamente do usuário quando cria conta, configura o workspace ou entra em contato conosco;</li>
                <li>
                  das plataformas conectadas, como Meta, quando o usuário autoriza integrações e recebemos eventos por
                  webhook ou por APIs oficiais;
                </li>
                <li>
                  automaticamente, a partir do uso normal da plataforma, da autenticação, de métricas técnicas e de
                  logs de observabilidade;
                </li>
                <li>
                  de provedores terceirizados estritamente necessários para operação, hospedagem, autenticação, IA,
                  armazenamento e billing.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: '4. Finalidades do tratamento',
          content: (
            <>
              <p>Tratamos dados pessoais e operacionais para:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>autenticar usuários e administrar workspaces;</li>
                <li>configurar, manter e monitorar integrações com Instagram, Facebook, WhatsApp e APIs correlatas;</li>
                <li>receber, armazenar, exibir e organizar mensagens, conversas, leads, automações e logs;</li>
                <li>
                  gerar, sugerir ou enviar respostas automatizadas com apoio de modelos de inteligência artificial,
                  quando esse recurso estiver habilitado no workspace;
                </li>
                <li>executar automações, classificações, extração de leads e fluxos operacionais relacionados;</li>
                <li>cumprir obrigações legais, prevenir abuso, investigar incidentes e exercer direitos contratuais, incluindo a aplicação de regras de unicidade de canal e períodos de carência entre workspaces;</li>
                <li>melhorar a segurança, estabilidade, experiência do produto e suporte ao cliente.</li>
              </ul>
            </>
          ),
        },
        {
          title: '5. Base legal e justificativas de uso',
          content: (
            <>
              <p>
                Quando aplicável, tratamos dados com fundamento em execução contratual, legítimo interesse, cumprimento
                de obrigação legal, exercício regular de direitos e consentimento, conforme a natureza de cada operação
                e a legislação aplicável ao usuário.
              </p>
              <p>
                O uso de integrações com canais de mensagem e recursos de IA depende da configuração voluntária feita
                pelo administrador do workspace ou por usuário autorizado.
              </p>
            </>
          ),
        },
        {
          title: '6. IA e processamento automatizado',
          content: (
            <>
              <p>
                Quando os recursos de IA estiverem habilitados, partes do conteúdo de mensagens, contexto de conversa e
                dados operacionais mínimos podem ser enviados a provedores de inteligência artificial para geração de
                respostas, classificação de intenção, triagem ou extração estruturada de informações.
              </p>
              <p>
                Esses recursos são oferecidos para agilizar atendimento e automação. Embora busquemos reduzir erros, a
                saída gerada por IA pode conter imprecisões e deve ser supervisionada pelo usuário nos casos
                sensíveis, regulados ou de maior risco.
              </p>
            </>
          ),
        },
        {
          title: '7. Integração com Google Calendar e dados do Google',
          content: (
            <>
              <p>
                O {LEGAL_APP_NAME} oferece integração opcional com o Google Calendar. Ao conectar sua conta do Google,
                o usuário autoriza o acesso aos seguintes escopos:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong>https://www.googleapis.com/auth/calendar</strong> — leitura e criação de eventos no Google
                  Calendar para sincronizar compromissos criados na plataforma;
                </li>
                <li>
                  <strong>https://www.googleapis.com/auth/userinfo.email</strong> — identificação do endereço de e-mail
                  da conta conectada, para exibição no painel do workspace.
                </li>
              </ul>
              <p>
                O uso dos dados obtidos via Google APIs está sujeito à{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-primary underline decoration-border-hover underline-offset-4"
                >
                  Política de Dados de Usuário dos Serviços de API do Google
                </a>
                , incluindo os requisitos de uso limitado. Especificamente:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  Os dados do Google Calendar são utilizados exclusivamente para sincronizar compromissos entre o
                  {LEGAL_APP_NAME} e o Google Calendar do usuário. Não utilizamos esses dados para fins publicitários,
                  análise de comportamento ou venda a terceiros.
                </li>
                <li>
                  Dados obtidos via Google APIs não são compartilhados com terceiros exceto na medida estritamente
                  necessária para prestação do serviço ao próprio usuário (por exemplo, armazenamento seguro em banco de
                  dados sob controle do workspace do usuário).
                </li>
                <li>
                  O acesso ao Google Calendar é revogável a qualquer momento pelo usuário, tanto nas configurações do
                  {LEGAL_APP_NAME} (Configurações → Integrações → Desconectar Google Agenda) quanto diretamente em{' '}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-primary underline decoration-border-hover underline-offset-4"
                  >
                    myaccount.google.com/permissions
                  </a>
                  .
                </li>
                <li>
                  Os tokens de acesso ao Google são armazenados de forma segura e são usados exclusivamente para
                  autenticar chamadas à API do Google Calendar em nome do usuário.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: '8. Compartilhamento com terceiros',
          content: (
            <>
              <p>Podemos compartilhar dados apenas quando necessário para operação legítima da plataforma, incluindo:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Meta Platforms, para autenticação, integração de canais e processamento de eventos oficiais;</li>
                <li>OpenAI ou provedores equivalentes, para funcionalidades de IA habilitadas no produto;</li>
                <li>Google Firebase e infraestrutura associada, para autenticação, banco de dados e armazenamento;</li>
                <li>Vercel ou infraestrutura de hospedagem semelhante, para execução do aplicativo;</li>
                <li>Stripe ou processadores de pagamento equivalentes, quando houver recursos de billing ativos;</li>
                <li>autoridades públicas ou terceiros quando exigido por lei, ordem válida ou proteção de direitos.</li>
              </ul>
              <p>
                Não vendemos dados pessoais. O compartilhamento ocorre no limite necessário para prestação do serviço,
                segurança, suporte e conformidade.
              </p>
            </>
          ),
        },
        {
          title: '9. Retenção de dados',
          content: (
            <>
              <p>
                Mantemos dados enquanto forem necessários para operar a conta, o workspace, as integrações, a
                observabilidade do serviço, a cobrança aplicável e o cumprimento de obrigações legais.
              </p>
              <p>
                Após encerramento da relação, os dados podem ser excluídos, anonimizados ou mantidos pelo período
                estritamente exigido para obrigações legais, auditoria, prevenção de fraude, defesa de direitos e
                resolução de disputas.
              </p>
            </>
          ),
        },
        {
          title: '10. Transferências internacionais',
          content: (
            <>
              <p>
                Como a plataforma utiliza provedores globais de infraestrutura, autenticação, IA e mensageria, os dados
                podem ser tratados em países diferentes do local do usuário. Sempre que possível, adotamos medidas
                contratuais, técnicas e organizacionais razoáveis para proteger esse tratamento internacional.
              </p>
            </>
          ),
        },
        {
          title: '11. Segurança',
          content: (
            <>
              <p>
                Empregamos medidas técnicas e administrativas razoáveis para proteger dados contra acesso não
                autorizado, destruição, perda, alteração ou divulgação indevida. Isso inclui mecanismos de autenticação,
                segregação lógica, criptografia ou pseudoanonimização quando aplicável, logs e controles operacionais.
              </p>
              <p>
                Ainda assim, nenhum ambiente conectado à internet é completamente livre de risco. O usuário também é
                responsável por manter credenciais seguras, limitar acessos e proteger seus próprios dispositivos.
              </p>
            </>
          ),
        },
        {
          title: '12. Direitos do titular',
          content: (
            <>
              <p>Conforme a legislação aplicável, o titular poderá solicitar:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>confirmação sobre existência de tratamento;</li>
                <li>acesso, correção, atualização ou portabilidade de dados;</li>
                <li>anonimização, bloqueio ou eliminação de dados quando cabível;</li>
                <li>informações sobre compartilhamento com terceiros;</li>
                <li>revisão de decisões exclusivamente automatizadas, quando aplicável;</li>
                <li>retirada de consentimento, nas hipóteses em que ele for a base legal do tratamento.</li>
              </ul>
              <p>
                Para exercer direitos, envie solicitação para{' '}
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="text-text-primary underline decoration-border-hover underline-offset-4"
                >
                  {LEGAL_CONTACT_EMAIL}
                </a>
                . Podemos solicitar informações adicionais para confirmar identidade, vínculo com o workspace e escopo
                do pedido.
              </p>
            </>
          ),
        },
        {
          title: '13. Dados mantidos por terceiros e plataformas conectadas',
          content: (
            <>
              <p>
                Quando o usuário integra contas do Instagram, Facebook ou outras plataformas, parte dos dados exibidos
                ou processados pelo {LEGAL_APP_NAME} pode continuar armazenada diretamente por essas plataformas sob suas
                próprias políticas e controles.
              </p>
              <p>
                A exclusão de dados em nossa plataforma não substitui a necessidade de gerenciar ou remover dados
                diretamente nas contas do Meta, do Instagram, do Facebook ou de outros provedores quando esses dados
                estiverem fora do nosso controle.
              </p>
            </>
          ),
        },
        {
          title: '14. Alterações desta política',
          content: (
            <>
              <p>
                Podemos atualizar esta Política periodicamente para refletir mudanças legais, operacionais ou de
                produto. Quando a mudança for material, publicaremos a versão revisada nesta URL e, quando apropriado,
                adotaremos mecanismos adicionais de aviso.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}

