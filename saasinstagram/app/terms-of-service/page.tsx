import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_APP_NAME, LEGAL_CONTACT_EMAIL, getLegalBaseUrl } from '@/lib/legal';

const title = `Termos de Serviço | ${LEGAL_APP_NAME}`;
const description =
  'Termos de Serviço do HannaAI, incluindo uso de integrações Meta, recursos de IA, billing, responsabilidades do usuário e limitações operacionais.';

export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${getLegalBaseUrl()}/terms-of-service`,
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      eyebrow="Termos de Serviço"
      title="Termos de Serviço"
      summary={`Estes Termos de Serviço regulam o acesso e o uso do ${LEGAL_APP_NAME}, incluindo o painel web, APIs, integrações com plataformas de terceiros, recursos de automação, recursos de inteligência artificial, billing e demais funcionalidades disponibilizadas ao usuário.`}
      sections={[
        {
          title: '1. Aceitação',
          content: (
            <>
              <p>
                Ao acessar, criar conta, conectar canais, usar automações, habilitar recursos de IA ou de qualquer
                forma utilizar o {LEGAL_APP_NAME}, o usuário declara que leu, entendeu e concorda com estes Termos e com
                a Política de Privacidade aplicável.
              </p>
              <p>
                Se o usuário utilizar a plataforma em nome de empresa, equipe ou cliente, declara possuir poderes para
                vincular tal organização a estes Termos.
              </p>
            </>
          ),
        },
        {
          title: '2. Descrição do serviço',
          content: (
            <>
              <p>O {LEGAL_APP_NAME} oferece, entre outros, os seguintes recursos:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>autenticação de usuários e gestão de workspaces;</li>
                <li>conexão com canais do Instagram, Facebook, WhatsApp e integrações relacionadas;</li>
                <li>inbox para visualização e operação de conversas;</li>
                <li>registro de contatos, leads, mensagens, automações e logs;</li>
                <li>respostas automáticas, classificação e fluxos com apoio de IA;</li>
                <li>recursos de cobrança, planos e limites de uso quando aplicáveis.</li>
              </ul>
              <p>
                O serviço pode evoluir, ser alterado, expandido ou restringido a qualquer tempo, inclusive com inclusão
                ou remoção de funcionalidades, APIs, integrações e limites operacionais.
              </p>
            </>
          ),
        },
        {
          title: '3. Elegibilidade e conta',
          content: (
            <>
              <p>
                O usuário deve fornecer informações verdadeiras, manter credenciais seguras e utilizar a conta apenas
                para fins legítimos. O usuário é responsável por toda atividade realizada sob sua conta e por qualquer
                acesso concedido a membros do seu workspace.
              </p>
            </>
          ),
        },
        {
          title: '4. Responsabilidades do usuário',
          content: (
            <>
              <p>O usuário concorda em:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>respeitar a legislação aplicável e as regras das plataformas conectadas;</li>
                <li>obter todas as autorizações, bases legais e permissões necessárias para uso dos dados tratados;</li>
                <li>
                  não usar a plataforma para spam, fraude, assédio, violação de direitos autorais, engenharia social,
                  manipulação indevida ou qualquer atividade ilícita;
                </li>
                <li>
                  não tentar contornar limites técnicos, explorar falhas, realizar scraping indevido ou comprometer a
                  segurança do serviço;
                </li>
                <li>
                  supervisionar automações e respostas com IA quando houver risco comercial, jurídico, regulatório ou
                  reputacional.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: '5. Unicidade e uso de canais conectados',
          content: (
            <>
              <p>
                Cada canal de mensagens — como uma conta do Instagram, página do Facebook ou número de WhatsApp —
                pode ser vinculado a apenas uma conta {LEGAL_APP_NAME} ao mesmo tempo. A plataforma mantém um
                registro global de canais conectados para garantir essa unicidade e prevenir uso abusivo do plano
                gratuito ou de qualquer plano.
              </p>
              <p>
                Ao desconectar um canal, aplica-se automaticamente um período de carência de 24 horas durante o qual
                o mesmo canal não pode ser vinculado a nenhuma outra conta. Esse mecanismo existe para prevenir a
                criação cíclica de contas com a finalidade de contornar limites de plano.
              </p>
              <p>
                O usuário que tentar conectar um canal já vinculado a outra conta, ou que esteja em período de
                carência, receberá mensagem de bloqueio informando a situação. A reconexão do mesmo canal na mesma
                conta não é afetada por esse período.
              </p>
              <p>
                Tentativas de contornar esses mecanismos por qualquer meio técnico ou organizacional constituem
                violação destes Termos e podem resultar em suspensão da conta.
              </p>
            </>
          ),
        },
        {
          title: '6. Integrações com terceiros',
          content: (
            <>
              <p>
                O {LEGAL_APP_NAME} depende de serviços de terceiros como Meta, OpenAI, Firebase, Vercel, Stripe e
                outros provedores de infraestrutura. O funcionamento de integrações, tokens, webhooks, permissões,
                autenticações e APIs pode ser afetado por políticas ou indisponibilidades desses terceiros.
              </p>
              <p>
                O usuário reconhece que o acesso a certos recursos pode exigir aprovação de app, permissões adicionais,
                tokens válidos, configuração correta de webhook e observância das políticas dessas plataformas.
              </p>
            </>
          ),
        },
        {
          title: '7. Recursos de inteligência artificial',
          content: (
            <>
              <p>
                Recursos de IA podem sugerir, redigir, classificar ou automatizar respostas e ações. Tais recursos são
                fornecidos “como disponíveis”, com finalidade de apoio operacional, e não substituem validação humana em
                cenários críticos.
              </p>
              <p>
                O usuário assume a responsabilidade final pelo conteúdo enviado aos seus clientes, inclusive quando o
                conteúdo tiver sido gerado ou sugerido por IA, por automação ou por prompts definidos pelo próprio
                workspace.
              </p>
            </>
          ),
        },
        {
          title: '8. Conteúdo e propriedade intelectual',
          content: (
            <>
              <p>
                O usuário mantém a titularidade sobre conteúdo próprio que enviar ou armazenar na plataforma, na medida
                permitida por lei e pelas regras dos serviços terceiros conectados.
              </p>
              <p>
                Ao utilizar o serviço, o usuário concede ao {LEGAL_APP_NAME} as permissões necessárias para hospedar,
                processar, transmitir, formatar, analisar e exibir esse conteúdo com a finalidade de operar o produto,
                prestar suporte, executar integrações, gerar respostas e cumprir estes Termos.
              </p>
              <p>
                O software, a marca, a interface, a documentação, os fluxos, os componentes visuais e os elementos
                proprietários do {LEGAL_APP_NAME} permanecem protegidos por direitos de propriedade intelectual.
              </p>
            </>
          ),
        },
        {
          title: '9. Planos, cobrança e pagamentos',
          content: (
            <>
              <p>
                Certas funcionalidades podem depender de plano pago, limites de uso, assinatura ativa ou testes
                promocionais. Quando aplicável, valores, franquias, periodicidade e condições comerciais serão
                apresentados no produto ou em proposta comercial específica.
              </p>
              <p>
                O usuário concorda em manter informações de faturamento válidas, pagar valores devidos e reconhecer que
                atrasos, chargebacks, suspeita de fraude ou violação contratual podem resultar em restrição, suspensão ou
                cancelamento do acesso.
              </p>
            </>
          ),
        },
        {
          title: '10. Disponibilidade e mudanças',
          content: (
            <>
              <p>
                Buscamos manter o serviço disponível, mas não garantimos operação contínua, sem erros ou totalmente
                livre de interrupções. Janelas de manutenção, falhas de terceiros, limites de API, eventos de segurança,
                alterações de escopo e evolução do produto podem afetar o funcionamento.
              </p>
            </>
          ),
        },
        {
          title: '11. Suspensão e encerramento',
          content: (
            <>
              <p>Podemos suspender, limitar ou encerrar o acesso em caso de:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>violação destes Termos ou da lei;</li>
                <li>uso abusivo, fraudulento ou que exponha a plataforma ou terceiros a risco indevido;</li>
                <li>inadimplemento financeiro quando aplicável;</li>
                <li>exigência legal, ordem válida ou determinação de plataforma parceira;</li>
                <li>necessidade técnica urgente para proteção do serviço, dos dados ou da infraestrutura.</li>
              </ul>
            </>
          ),
        },
        {
          title: '12. Confidencialidade e dados',
          content: (
            <>
              <p>
                Cada parte deve tratar como confidenciais as informações não públicas recebidas em razão da relação
                comercial, exceto quando a divulgação for autorizada, exigida por lei ou necessária para execução do
                serviço com provedores vinculados.
              </p>
              <p>
                O tratamento de dados pessoais e operacionais ocorre conforme a Política de Privacidade e conforme as
                configurações definidas pelo workspace.
              </p>
            </>
          ),
        },
        {
          title: '13. Limitação de responsabilidade',
          content: (
            <>
              <p>
                Na máxima extensão permitida por lei, o {LEGAL_APP_NAME} não será responsável por perdas indiretas,
                lucros cessantes, danos reputacionais, perda de oportunidade, paralisação operacional, perda de dados
                causada por plataformas terceiras ou decisões tomadas exclusivamente com base em automações ou saídas de
                IA.
              </p>
              <p>
                Sempre que permitido, a responsabilidade total agregada relacionada ao serviço ficará limitada ao valor
                efetivamente pago pelo usuário ao {LEGAL_APP_NAME} nos 3 meses anteriores ao evento que originou a
                reclamação, ou ao valor mínimo permitido pela legislação aplicável para usuários sem contratação paga.
              </p>
            </>
          ),
        },
        {
          title: '14. Indenização',
          content: (
            <>
              <p>
                O usuário concorda em defender, indenizar e manter o {LEGAL_APP_NAME} indene contra reclamações,
                prejuízos, custos, multas e despesas decorrentes de uso ilícito do serviço, violação de direitos de
                terceiros, descumprimento de políticas de plataformas conectadas ou infração destes Termos.
              </p>
            </>
          ),
        },
        {
          title: '15. Lei aplicável e resolução de disputas',
          content: (
            <>
              <p>
                Estes Termos serão interpretados de acordo com a legislação aplicável ao operador responsável por esta
                implantação, sem prejuízo de regras obrigatórias de proteção ao consumidor ou de proteção de dados que
                possam se aplicar ao usuário.
              </p>
              <p>
                Sempre que possível, as partes buscarão resolver controvérsias de forma amigável antes de adotar medidas
                administrativas ou judiciais.
              </p>
            </>
          ),
        },
        {
          title: '16. Contato',
          content: (
            <>
              <p>
                Solicitações contratuais, comunicações legais e dúvidas gerais podem ser encaminhadas para{' '}
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

