'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
  AnimatePresence,
  type Variants,
} from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Facebook,
  Globe2,
  Instagram,
  LayoutDashboard,
  Link2,
  MessageCircle,
  MessageSquare,
  type LucideIcon,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { PLAN_ORDER, PLANS } from '@/lib/stripe/plans';
import { type AppLanguage, normalizeBrowserLanguage } from '@/lib/i18n';

type LandingPageClientProps = {
  initialLanguage: AppLanguage;
  contactEmail: string;
};

const brandPillMeta = [
  {
    key: 'instagram',
    icon: Instagram,
    iconClassName: 'text-[#E1306C]',
    borderClassName: 'border-[#E1306C]/30',
    glowClassName: 'from-[#E1306C]/18',
  },
  {
    key: 'facebook',
    icon: Facebook,
    iconClassName: 'text-[#1877F2]',
    borderClassName: 'border-[#1877F2]/30',
    glowClassName: 'from-[#1877F2]/18',
  },
  {
    key: 'whatsapp',
    icon: MessageCircle,
    iconClassName: 'text-[#25D366]',
    borderClassName: 'border-[#25D366]/30',
    glowClassName: 'from-[#25D366]/18',
  },
] as const;

const highlightIcons: LucideIcon[] = [
  MessageSquare,
  Bot,
  Zap,
  CalendarDays,
  ShieldCheck,
  Users,
];

const flowIcons: LucideIcon[] = [Link2, Sparkles, Brain, BarChart3];

const sideNavIcons: LucideIcon[] = [
  LayoutDashboard,
  MessageSquare,
  Users,
  CalendarDays,
  Zap,
  Link2,
];

// ─── motion variants ────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.55, ease } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

const slideLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease } },
};

// ─── copy ────────────────────────────────────────────────────────────────────

const landingCopy = {
  'pt-BR': {
    nav: {
      product: 'Produto',
      workflow: 'Fluxo',
      pricing: 'Planos',
      faq: 'FAQ',
      login: 'Entrar',
      start: 'Criar conta grátis',
    },
    hero: {
      badge: 'Instagram, Facebook e WhatsApp em uma única operação',
      title: 'Centralize seu atendimento.',
      highlight: 'Qualifique leads e avance a venda sem perder contexto.',
      description:
        'HannaAI organiza mensagens, prioridades, automações, agenda e continuidade comercial em um único painel para pequenas e médias empresas que precisam responder rápido e operar com consistência.',
      primaryCta: 'Criar conta grátis',
      secondaryCta: 'Ver plataforma',
      proofs: [
        'Plano gratuito permanente, sem cartão',
        'Inbox, automação e agenda no mesmo fluxo',
        'IA configurável por operação',
      ],
    },
    brandPills: {
      instagram: {
        label: 'Instagram Business',
        detail: 'DMs, contexto e follow-up no mesmo fluxo',
      },
      facebook: {
        label: 'Facebook Messenger',
        detail: 'Mensagens da pagina com operacao centralizada',
      },
      whatsapp: {
        label: 'WhatsApp Cloud API',
        detail: 'Operacao complementar para fluxos Meta avancados',
      },
    },
    mock: {
      route: 'app.usehanna.com/overview',
      windowTag: 'Demonstracao com dados ilustrativos',
      demoBadge: 'Dados ilustrativos',
      sideNavLabels: ['Painel', 'Inbox', 'Leads', 'Agenda', 'Automações', 'Canais'],
      workspaceName: 'Atlas Service Ops',
      workspacePlan: 'Plano Pro',
      teamLabel: 'Equipe',
      teamName: 'Operacao Atlas',
      teamEmail: 'ops@atlas-demo.example',
      overviewEyebrow: 'Visão Geral',
      overviewTitle: 'Painel operacional',
      searchPlaceholder: 'Buscar conversa, lead ou agente...',
      greeting: 'Bom dia, equipe Atlas.',
      greetingText:
        'Acompanhe conversas, risco de SLA, oportunidades qualificadas e próximos passos sem alternar entre ferramentas.',
      metrics: [
        { label: 'Conversas ativas', value: '18', color: 'bg-[#7c3aed]', icon: MessageSquare },
        { label: 'SLA em risco', value: '3', color: 'bg-[#f59e0b]', icon: Zap },
        { label: 'Leads qualificados', value: '12', color: 'bg-[#10b981]', icon: Users },
        { label: 'Reunioes marcadas', value: '5', color: 'bg-[#3b82f6]', icon: BarChart3 },
      ],
      threadsTitle: 'Conversas recentes',
      threadsDescription: 'Fila priorizada para atendimento e vendas',
      threadsCta: 'Abrir inbox',
      threads: [
        {
          name: 'Lead Nova-14',
          message: 'Preciso entender disponibilidade para esta semana.',
          status: 'Aberta',
          channel: 'instagram',
        },
        {
          name: 'Lead Axis-02',
          message: 'Quero receber proposta ainda hoje.',
          status: 'Follow-up',
          channel: 'facebook',
        },
        {
          name: 'Cliente Orbit-07',
          message: 'Podemos confirmar o horario da visita?',
          status: 'Agendada',
          channel: 'whatsapp',
        },
      ],
      channelsTitle: 'Canais',
      channelsDescription: 'Distribuição de entrada da semana',
      channels: [
        { label: 'Instagram', value: '64%', line: 'bg-[#E1306C]', icon: Instagram, text: 'text-[#E1306C]', width: '64%' },
        { label: 'Facebook', value: '21%', line: 'bg-[#1877F2]', icon: Facebook, text: 'text-[#1877F2]', width: '21%' },
        { label: 'WhatsApp', value: '15%', line: 'bg-[#25D366]', icon: MessageCircle, text: 'text-[#25D366]', width: '15%' },
      ],
      actionsTitle: 'Ações rápidas',
      actionsDescription: 'Operação pronta para agir',
      actions: ['Conectar canal', 'Criar automação', 'Convidar agente'],
      floatEyebrow: 'Resposta com contexto',
      floatTitle: 'Sugestao pronta para revisar',
      floatName: 'Lead Nova-14',
      floatSubtitle: 'Instagram • IA pronta para envio',
      floatIncoming: 'Preciso entender disponibilidade para esta semana.',
      floatReply:
        'Temos janelas livres entre terça e quinta. Se quiser, já organizo as melhores opções para seu atendimento continuar sem atraso.',
      composerPlaceholder: 'Escreva uma resposta...',
    },
    strip: {
      eyebrow: 'Operacao comercial',
      title: 'Pensada para equipes que vendem e atendem por DM.',
      items: [
        'Menos leads perdidos',
        'Mais contexto por conversa',
        'Follow-up estruturado',
        'Agenda conectada',
        'IA sob controle',
      ],
    },
    product: {
      eyebrow: 'Produto',
      title: 'Cada nova mensagem entra em um fluxo pronto para operar.',
      description:
        'Em vez de depender de caixas de entrada soltas, sua equipe recebe contexto, prioridade, próxima ação e histórico no mesmo lugar.',
      sidebarEyebrow: 'Pipeline de atendimento',
      sidebarTitle: 'Do primeiro contato até o próximo compromisso.',
      sidebarDescription:
        'O produto foi desenhado para operações reais: entrada centralizada, qualificação, handoff e continuidade comercial.',
      storySteps: [
        {
          label: 'Entrada centralizada',
          description: 'A mensagem chega com canal, histórico e responsável visíveis logo no primeiro toque.',
        },
        {
          label: 'Qualificação com IA',
          description: 'A operação usa contexto, base de conhecimento e regras para acelerar triagem e resposta.',
        },
        {
          label: 'Ação comercial',
          description: 'A equipe agenda, segue o lead e move a próxima etapa sem quebrar o fluxo.',
        },
      ],
      localeCardTitle: 'Respostas coerentes em diferentes idiomas',
      localeCardDescription: 'A conversa pode seguir o idioma do cliente sem tirar controle do time.',
    },
    highlights: [
      {
        eyebrow: 'Inbox unificado',
        title: 'Concentre Instagram, Facebook e operações via WhatsApp sem trocar de ferramenta.',
        description:
          'Toda conversa entra com canal, status, prioridade, responsável e histórico visíveis, reduzindo handoff e retrabalho.',
        bullets: ['Fila única por canal e etapa', 'Prioridade, tags e responsável'],
      },
      {
        eyebrow: 'IA operacional',
        title: 'Padronize respostas sem perder contexto, tom ou velocidade.',
        description:
          'Configure instruções, base de conhecimento e limites operacionais para revisar, enviar ou automatizar com mais consistência.',
        bullets: ['Sugestões e respostas automáticas', 'Contexto do workspace e da conversa'],
      },
      {
        eyebrow: 'Automação que economiza tempo',
        title: 'Acione triagem, follow-up e próxima ação assim que a mensagem chega.',
        description:
          'Regras ajudam a classificar, etiquetar, atribuir e mover conversas para que o time foque no que realmente precisa de atenção.',
        bullets: ['Gatilhos por palavra, horário e evento', 'Ações encadeadas para atendimento e vendas'],
      },
      {
        eyebrow: 'Agenda e continuidade',
        title: 'Converta conversa em compromisso sem desmontar o atendimento.',
        description:
          'Quando há intenção comercial, a equipe sai do chat para reunião, visita ou ligação com o contexto certo ainda anexado.',
        bullets: ['Agenda semanal nativa', 'Integração opcional com Google Calendar'],
      },
      {
        eyebrow: 'Governança de workspace',
        title: 'Controle operação, plano e limites em uma camada pronta para SaaS.',
        description:
          'Planos, faturamento e limites de uso já fazem parte da estrutura para dar previsibilidade a uma operação que cresce.',
        bullets: ['Plano gratuito permanente, sem cartão', 'Uso e limites por plano'],
      },
      {
        eyebrow: 'Pipeline de leads',
        title: 'Transforme atendimento em acompanhamento comercial sem planilhas paralelas.',
        description:
          'Leads continuam ligados à conversa, facilitando qualificação, próxima ação e visibilidade do time ao longo do processo.',
        bullets: ['Histórico de interações', 'Qualificação e próxima ação'],
      },
    ],
    workflow: {
      eyebrow: 'Fluxo',
      title: 'Da primeira DM até a próxima etapa comercial.',
      description:
        'Sua equipe ganha um processo claro para responder, qualificar, automatizar e encaminhar sem perder o ritmo da operação.',
      steps: [
        {
          title: 'Conecte os canais',
          description: 'Instagram e Facebook entram com fluxo Meta. Operações via WhatsApp complementam o processo quando necessário.',
        },
        {
          title: 'Organize a entrada',
          description: 'Cada nova mensagem aparece com prioridade, histórico, tags e contexto para o time agir com rapidez.',
        },
        {
          title: 'Responda com IA ou regra',
          description: 'A operação escolhe quando sugerir, automatizar, escalar ou proteger o atendimento conforme o cenário.',
        },
        {
          title: 'Avance a venda',
          description: 'Quando existe oportunidade, o fluxo segue para lead, agenda e continuidade comercial no mesmo workspace.',
        },
      ],
    },
    pricing: {
      eyebrow: 'Planos',
      title: 'Pricing alinhado ao volume operacional do seu time.',
      description:
        'Os cards mantêm os limites reais do produto para automações, canais, conversas e uso de IA.',
      trialLabel: 'Plano gratuito disponível — sem cartão',
      annualEquivalentLabel: 'Equivalente anual',
      perMonthLabel: '/mês',
      chooseLabel: 'Escolher',
      plans: {
        free: {
          description: 'Sinta a IA respondendo seu Instagram antes de pagar qualquer coisa.',
          features: [
            '100 mensagens de IA por mês',
            '15 interações de IA por mês',
            '5 automações ativas',
            '2 canais conectados',
            'Inbox omnichannel unificado',
            'CRM de leads completo',
            'Agenda e agendamentos',
            'Suporte por e-mail',
          ],
        },
        starter: {
          description: 'Para quem quer automatizar o atendimento com mais volume de IA.',
          features: [
            '300 mensagens de IA por mês',
            '30 interações de IA por mês',
            '20 automações ativas',
            '3 canais conectados',
            'Inbox omnichannel unificado',
            'CRM de leads completo',
            'Agenda e agendamentos',
            'Suporte por e-mail',
          ],
        },
        pro: {
          description: 'Para operações em crescimento que precisam de mais IA e mais volume.',
          badge: 'Mais popular',
          features: [
            '1.200 mensagens de IA por mês',
            '120 interações de IA por mês',
            '20 automações ativas',
            '3 canais conectados',
            'Inbox omnichannel unificado',
            'CRM de leads completo',
            'Agenda e agendamentos',
            'Suporte por e-mail',
          ],
        },
        business: {
          description: 'Escala completa — interações e automações de IA sem limite.',
          features: [
            '3.000 mensagens de IA por mês',
            'Interações de IA ilimitadas',
            'Automações ilimitadas',
            '3 canais conectados',
            'Inbox omnichannel unificado',
            'CRM de leads completo',
            'Agenda e agendamentos',
            'Suporte por e-mail',
          ],
        },
      },
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'As objeções mais comuns já ficam respondidas.',
      description:
        'Canal, IA, agenda, plano gratuito e maturidade operacional ficam claros antes do cadastro.',
      items: [
        {
          question: 'Quais canais o HannaAI suporta hoje?',
          answer:
            'Os fluxos mais maduros estão em Instagram e Facebook via Meta. Operações via WhatsApp entram como extensão para cenários mais avançados.',
        },
        {
          question: 'A IA responde sozinha ou apenas sugere?',
          answer:
            'Os dois modelos são possíveis. O time pode revisar respostas sugeridas ou automatizar envios conforme regras, horário e contexto.',
        },
        {
          question: 'Serve para atendimento e vendas?',
          answer:
            'Sim. O produto foi estruturado para organizar conversas, qualificar leads, manter follow-up e transformar intenção em próxima etapa comercial.',
        },
        {
          question: 'O plano gratuito é permanente?',
          answer: 'Sim. O plano gratuito está disponível permanentemente, sem cartão e sem prazo de validade. Conecte seus canais e experimente a IA respondendo suas DMs sem custo.',
        },
      ],
    },
    finalCta: {
      eyebrow: 'Proximo passo',
      title: 'Se o primeiro contato acontece em DM, sua equipe precisa de uma operação, não de mais uma caixa de entrada.',
      description:
        'Comece pelo plano gratuito, conecte os canais e valide um fluxo mais rápido para atender, qualificar e acompanhar oportunidades.',
      primary: 'Criar conta grátis',
      secondary: 'Entrar na plataforma',
    },
    footer: {
      tagline: 'Atendimento omnichannel com IA, automação e continuidade comercial.',
      privacy: 'Política de Privacidade',
      terms: 'Termos de Uso',
    },
  },
  'en-US': {
    nav: {
      product: 'Product',
      workflow: 'Workflow',
      pricing: 'Pricing',
      faq: 'FAQ',
      login: 'Sign in',
      start: 'Get started free',
    },
    hero: {
      badge: 'Instagram, Facebook, and WhatsApp in one operating layer',
      title: 'Centralize customer conversations.',
      highlight: 'Qualify leads and move deals forward without losing context.',
      description:
        'HannaAI keeps messages, priorities, automations, scheduling, and sales follow-up inside one workspace for small and mid-sized teams that need speed, consistency, and visibility.',
      primaryCta: 'Get started free',
      secondaryCta: 'View platform',
      proofs: [
        'Permanent free plan, no card required',
        'Inbox, automation, and scheduling in one flow',
        'AI behavior configurable per workspace',
      ],
    },
    brandPills: {
      instagram: {
        label: 'Instagram Business',
        detail: 'DMs, context, and follow-up in one queue',
      },
      facebook: {
        label: 'Facebook Messenger',
        detail: 'Page messages handled from the same control layer',
      },
      whatsapp: {
        label: 'WhatsApp Cloud API',
        detail: 'Complementary operations for advanced Meta workflows',
      },
    },
    mock: {
      route: 'app.usehanna.com/overview',
      windowTag: 'Illustrative demo data',
      demoBadge: 'Illustrative data',
      sideNavLabels: ['Dashboard', 'Inbox', 'Leads', 'Schedule', 'Automations', 'Channels'],
      workspaceName: 'Atlas Service Ops',
      workspacePlan: 'Pro plan',
      teamLabel: 'Team',
      teamName: 'Atlas Operations',
      teamEmail: 'ops@atlas-demo.example',
      overviewEyebrow: 'Overview',
      overviewTitle: 'Operations dashboard',
      searchPlaceholder: 'Search conversation, lead, or agent...',
      greeting: 'Good morning, Atlas team.',
      greetingText:
        'Track active conversations, SLA risk, qualified opportunities, and next steps without bouncing between tools.',
      metrics: [
        { label: 'Active conversations', value: '18', color: 'bg-[#7c3aed]', icon: MessageSquare },
        { label: 'At-risk SLA', value: '3', color: 'bg-[#f59e0b]', icon: Zap },
        { label: 'Qualified leads', value: '12', color: 'bg-[#10b981]', icon: Users },
        { label: 'Meetings booked', value: '5', color: 'bg-[#3b82f6]', icon: BarChart3 },
      ],
      threadsTitle: 'Recent conversations',
      threadsDescription: 'Prioritized queue for support and sales',
      threadsCta: 'Open inbox',
      threads: [
        {
          name: 'Lead Nova-14',
          message: 'I need to understand availability for this week.',
          status: 'Open',
          channel: 'instagram',
        },
        {
          name: 'Lead Axis-02',
          message: 'I want a proposal sent today.',
          status: 'Follow-up',
          channel: 'facebook',
        },
        {
          name: 'Client Orbit-07',
          message: 'Can we confirm the visit time?',
          status: 'Booked',
          channel: 'whatsapp',
        },
      ],
      channelsTitle: 'Channels',
      channelsDescription: 'Inbound distribution this week',
      channels: [
        { label: 'Instagram', value: '64%', line: 'bg-[#E1306C]', icon: Instagram, text: 'text-[#E1306C]', width: '64%' },
        { label: 'Facebook', value: '21%', line: 'bg-[#1877F2]', icon: Facebook, text: 'text-[#1877F2]', width: '21%' },
        { label: 'WhatsApp', value: '15%', line: 'bg-[#25D366]', icon: MessageCircle, text: 'text-[#25D366]', width: '15%' },
      ],
      actionsTitle: 'Quick actions',
      actionsDescription: 'Ready to move the queue forward',
      actions: ['Connect channel', 'Launch automation', 'Invite agent'],
      floatEyebrow: 'Context-aware reply',
      floatTitle: 'Suggested response ready to review',
      floatName: 'Lead Nova-14',
      floatSubtitle: 'Instagram • AI draft ready',
      floatIncoming: 'I need to understand availability for this week.',
      floatReply:
        'We currently have open windows between Tuesday and Thursday. If you want, I can organize the best options so your team can continue from there.',
      composerPlaceholder: 'Write a reply...',
    },
    strip: {
      eyebrow: 'Revenue operations',
      title: 'Built for teams that sell and support through DMs.',
      items: [
        'Fewer lost leads',
        'More context per thread',
        'Structured follow-up',
        'Connected scheduling',
        'AI with guardrails',
      ],
    },
    product: {
      eyebrow: 'Product',
      title: 'Every new message enters a workflow that is ready to operate.',
      description:
        'Instead of scattered inboxes, your team gets context, priority, ownership, and next action in one place.',
      sidebarEyebrow: 'Customer journey',
      sidebarTitle: 'From first contact to the next booked step.',
      sidebarDescription:
        'The product is built for real operations: centralized intake, qualification, handoff, and structured sales follow-through.',
      storySteps: [
        {
          label: 'Centralized intake',
          description: 'Every new message arrives with channel, history, and ownership visible from the first touch.',
        },
        {
          label: 'AI-assisted qualification',
          description: 'Context, knowledge, and rules help your team triage and respond faster with more consistency.',
        },
        {
          label: 'Commercial next step',
          description: 'The team books, follows up, and advances the opportunity without breaking the flow.',
        },
      ],
      localeCardTitle: 'Consistent replies across languages',
      localeCardDescription: 'Conversations can follow the customer language without removing team control.',
    },
    highlights: [
      {
        eyebrow: 'Unified inbox',
        title: 'Handle Instagram, Facebook, and WhatsApp workflows without switching tools.',
        description:
          'Every conversation comes in with channel, status, priority, ownership, and history visible, reducing handoff friction and rework.',
        bullets: ['One queue across channels and stages', 'Priority, tags, and ownership'],
      },
      {
        eyebrow: 'Operational AI',
        title: 'Standardize replies without sacrificing context, tone, or speed.',
        description:
          'Configure instructions, knowledge, and operational guardrails so the team can review, send, or automate with more confidence.',
        bullets: ['Suggested and automated replies', 'Workspace and conversation context'],
      },
      {
        eyebrow: 'Automation that saves time',
        title: 'Trigger triage, follow-up, and next actions the moment a message arrives.',
        description:
          'Rules help classify, tag, assign, and route conversations so the team can spend time where it actually matters.',
        bullets: ['Keyword, schedule, and event triggers', 'Chained actions for service and sales'],
      },
      {
        eyebrow: 'Scheduling and continuity',
        title: 'Turn a conversation into a booked next step without losing the thread.',
        description:
          'When buying intent shows up, the team can move from chat to meeting, visit, or call while keeping the right context attached.',
        bullets: ['Native weekly scheduling', 'Optional Google Calendar sync'],
      },
      {
        eyebrow: 'Workspace governance',
        title: 'Control plans, usage, and growth in a SaaS-ready operating layer.',
        description:
          'Plans, billing, and usage limits are already part of the structure, giving fast-moving teams visibility as operations scale.',
        bullets: ['Permanent free plan, no card required', 'Usage and limits by plan'],
      },
      {
        eyebrow: 'Lead pipeline',
        title: 'Turn customer conversations into follow-through without parallel spreadsheets.',
        description:
          'Leads stay linked to the thread, making qualification, next action, and commercial visibility easier across the team.',
        bullets: ['Interaction history', 'Qualification and next step'],
      },
    ],
    workflow: {
      eyebrow: 'Workflow',
      title: 'From the first DM to the next commercial step.',
      description:
        'Your team gets a clear process to respond, qualify, automate, and advance opportunities without losing operational rhythm.',
      steps: [
        {
          title: 'Connect the channels',
          description: 'Instagram and Facebook enter through the Meta flow. WhatsApp operations extend the process when needed.',
        },
        {
          title: 'Organize inbound demand',
          description: 'Every new message arrives with priority, tags, history, and context so the team can act fast.',
        },
        {
          title: 'Reply with AI or rules',
          description: 'Operations decide when to suggest, automate, escalate, or protect the customer experience.',
        },
        {
          title: 'Move the deal forward',
          description: 'When intent is clear, the flow continues into leads, scheduling, and structured follow-up inside the workspace.',
        },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'Pricing that matches your team operating volume.',
      description:
        'These cards keep the real product limits for agents, automations, channels, conversations, and AI usage.',
      trialLabel: 'Permanent free plan available — no card required',
      annualEquivalentLabel: 'Annual equivalent',
      perMonthLabel: '/mo',
      chooseLabel: 'Choose',
      plans: {
        free: {
          description: 'Experience AI replying to your Instagram before paying a cent.',
          features: [
            '100 AI messages per month',
            '15 AI interactions per month',
            '5 active automations',
            '2 connected channels',
            'Unified omnichannel inbox',
            'Full lead CRM',
            'Calendar and scheduling',
            'Email support',
          ],
        },
        starter: {
          description: 'For those who want to automate customer conversations with more AI volume.',
          features: [
            '300 AI messages per month',
            '30 AI interactions per month',
            '20 active automations',
            '3 connected channels',
            'Unified omnichannel inbox',
            'Full lead CRM',
            'Calendar and scheduling',
            'Email support',
          ],
        },
        pro: {
          description: 'For growing operations that need more AI and higher volumes.',
          badge: 'Most popular',
          features: [
            '1,200 AI messages per month',
            '120 AI interactions per month',
            '20 active automations',
            '3 connected channels',
            'Unified omnichannel inbox',
            'Full lead CRM',
            'Calendar and scheduling',
            'Email support',
          ],
        },
        business: {
          description: 'Full scale — unlimited AI interactions and automations.',
          features: [
            '3,000 AI messages per month',
            'Unlimited AI interactions',
            'Unlimited automations',
            '3 connected channels',
            'Unified omnichannel inbox',
            'Full lead CRM',
            'Calendar and scheduling',
            'Email support',
          ],
        },
      },
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'The main objections are answered before signup.',
      description:
        'Channel coverage, AI behavior, scheduling, free plan, and operational maturity are clear up front.',
      items: [
        {
          question: 'Which channels does HannaAI support today?',
          answer:
            'The most mature workflows run on Instagram and Facebook through Meta. WhatsApp operations are supported as an extension for more advanced setups.',
        },
        {
          question: 'Does the AI reply automatically or only suggest answers?',
          answer:
            'Both models are possible. Your team can review suggested replies or automate sends based on rules, schedule, and context.',
        },
        {
          question: 'Does this work for support and sales?',
          answer:
            'Yes. The product is structured to organize conversations, qualify leads, maintain follow-up, and turn intent into the next commercial step.',
        },
        {
          question: 'Is the free plan permanent?',
          answer:
            'Yes. The free plan is permanently available — no credit card and no expiration date. Connect your channels and experience AI replying to your DMs at no cost.',
        },
      ],
    },
    finalCta: {
      eyebrow: 'Next step',
      title: 'If the first touchpoint happens in DMs, your team needs an operation layer, not another inbox.',
      description:
        'Start on the free plan, connect the channels, and validate a faster workflow to respond, qualify, and follow through.',
      primary: 'Get started free',
      secondary: 'Sign in to platform',
    },
    footer: {
      tagline: 'Omnichannel conversations with AI, automation, and commercial follow-through.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
  },
} as const;

function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return null;
  return normalizeBrowserLanguage(navigator.languages?.[0] ?? navigator.language);
}

function formatLocalizedPrice(amount: number, currency: string, language: AppLanguage) {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function channelIconColor(channel: string) {
  if (channel === 'instagram') return 'text-[#E1306C]';
  if (channel === 'facebook') return 'text-[#1877F2]';
  return 'text-[#25D366]';
}

function channelIcon(channel: string) {
  if (channel === 'instagram') return Instagram;
  if (channel === 'facebook') return Facebook;
  return MessageCircle;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      variants={fadeIn}
      className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]"
    >
      {children}
    </motion.p>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function LandingPageClient({
  initialLanguage,
  contactEmail,
}: LandingPageClientProps) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(heroScroll, [0, 1], ['0%', '18%']);
  const heroOpacity = useTransform(heroScroll, [0, 0.6], [1, 0]);

  const mockRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-250, 250], [8, -8]), {
    stiffness: 160,
    damping: 28,
  });
  const rotateY = useSpring(useTransform(mouseX, [-350, 350], [-12, 12]), {
    stiffness: 160,
    damping: 28,
  });

  useEffect(() => {
    const syncLanguage = () => {
      const browserLanguage = detectBrowserLanguage();
      if (browserLanguage) {
        setLanguage((cur) => (cur === browserLanguage ? cur : browserLanguage));
      }
    };
    syncLanguage();
    window.addEventListener('languagechange', syncLanguage);
    return () => window.removeEventListener('languagechange', syncLanguage);
  }, []);

  function handleMockMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (shouldReduceMotion) return;
    const rect = mockRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleMockMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const copy = landingCopy[language];

  return (
    <div lang={language} className="relative min-h-screen overflow-hidden bg-white text-[#111827]">
      {/* Ambient accent orbs */}
      <div
        className="pointer-events-none absolute right-[-200px] top-[-100px] h-[600px] w-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="pointer-events-none absolute left-[-100px] top-[40%] h-[400px] w-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      {/* ─── Nav ──────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="sticky top-0 z-50 border-b border-[#e5e6eb] bg-white/90 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3.5 lg:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#e9d5ff] bg-[#f5f3ff]">
              <Image src="/logo.png" alt="HannaAI" width={36} height={36} className="h-full w-full object-contain" />
            </div>
            <p className="text-sm font-semibold tracking-[0.22em] text-[#111827]">HANNAAI</p>
          </a>

          <div className="hidden items-center gap-7 text-sm text-[#6b7280] md:flex">
            {(['product', 'workflow', 'pricing', 'faq'] as const).map((key) => (
              <a key={key} href={`#${key}`} className="transition-colors hover:text-[#111827]">
                {copy.nav[key]}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/login"
              className="hidden rounded-md border border-[#e5e6eb] px-4 py-2 text-sm text-[#374151] transition-all hover:bg-[#f3f4f6] sm:inline-flex"
            >
              {copy.nav.login}
            </a>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_3px_rgba(124,58,237,0.35)] hover:bg-[#6d28d9]"
              >
                {copy.nav.start}
                <ArrowRight size={14} />
              </a>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      <main>
        {/* ─── Hero ──────────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative overflow-hidden bg-white">
          <div className="mx-auto max-w-7xl px-6 pt-16 lg:px-8 lg:pt-24">
            <motion.div
              style={shouldReduceMotion ? {} : { y: heroY, opacity: heroOpacity }}
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="relative z-10"
            >
              {/* Badge */}
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5e6eb] bg-[#f5f3ff] px-4 py-2 text-xs font-medium text-[#7c3aed]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                {copy.hero.badge}
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={fadeUp}
                className="mt-7 max-w-[18ch] text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#111827] sm:text-6xl xl:text-7xl"
              >
                {copy.hero.title}
                <span className="block bg-[linear-gradient(135deg,#7c3aed_20%,#4f46e5_60%,#2563eb_100%)] bg-clip-text text-transparent">
                  {copy.hero.highlight}
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg leading-8 text-[#6b7280]">
                {copy.hero.description}
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}>
                  <a
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)] hover:bg-[#6d28d9]"
                  >
                    {copy.hero.primaryCta}
                    <ArrowRight size={16} />
                  </a>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}>
                  <a
                    href="#product"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#e5e6eb] px-6 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] hover:border-[#d1d5db]"
                  >
                    <Play size={15} className="text-[#7c3aed]" />
                    {copy.hero.secondaryCta}
                  </a>
                </motion.div>
              </motion.div>

              {/* Proofs */}
              <motion.div variants={staggerFast} className="mt-5 flex flex-wrap gap-2">
                {copy.hero.proofs.map((proof) => (
                  <motion.span
                    key={proof}
                    variants={cardUp}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e5e6eb] bg-white px-4 py-1.5 text-sm text-[#6b7280]"
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {proof}
                  </motion.span>
                ))}
              </motion.div>

              {/* Brand pills */}
              <motion.div variants={staggerFast} className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
                {brandPillMeta.map((pill) => {
                  const Icon = pill.icon;
                  const item = copy.brandPills[pill.key];
                  return (
                    <motion.div
                      key={pill.key}
                      variants={cardUp}
                      whileHover={{ y: -3 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                      className="rounded-xl border border-[#e5e6eb] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all"
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e6eb] bg-[#f7f7f8]">
                        <Icon size={16} className={pill.iconClassName} />
                      </div>
                      <p className="text-sm font-medium text-[#111827]">{item.label}</p>
                      <p className="mt-0.5 text-sm leading-5 text-[#6b7280]">{item.detail}</p>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          </div>

          {/* ── Dashboard mock ── */}
          <div
            ref={mockRef}
            className="app-stage relative mx-auto mt-14 max-w-7xl px-6 lg:px-8"
            onMouseMove={handleMockMouseMove}
            onMouseLeave={handleMockMouseLeave}
          >
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 24 }}
              animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8, ease }}
              style={shouldReduceMotion ? {} : { rotateX, rotateY, transformPerspective: 2200 }}
              className="hero-screen-shell"
            >
              <div className="app-window overflow-hidden rounded-xl border border-[#e5e6eb] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]">
                {/* Chrome bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e6eb] bg-[#f7f7f8] px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                      <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                      <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="rounded border border-[#e5e6eb] bg-white px-3 py-1 text-[11px] text-[#9ca3af]">
                      {copy.mock.route}
                    </div>
                  </div>
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-medium text-amber-600">
                    {copy.mock.windowTag}
                  </div>
                </div>

                {/* App layout */}
                <div className="grid overflow-hidden md:grid-cols-[188px_minmax(0,1fr)]" style={{ maxHeight: 640 }}>
                  {/* Sidebar */}
                  <aside className="border-b border-[#e5e6eb] bg-white p-3 md:border-b-0 md:border-r md:border-[#e5e6eb]">
                    {/* Workspace */}
                    <div className="mb-3 flex items-center gap-2.5 border-b border-[#e5e6eb] px-2 pb-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e9d5ff] bg-[#f5f3ff]">
                        <Image src="/logo.png" alt="Workspace" width={28} height={28} className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#111827]">{copy.mock.workspaceName}</p>
                        <p className="text-[10px] text-[#9ca3af]">{copy.mock.workspacePlan}</p>
                      </div>
                    </div>

                    {/* Nav items */}
                    <div className="space-y-0.5">
                      {copy.mock.sideNavLabels.map((label, index) => {
                        const Icon = sideNavIcons[index];
                        const active = index === 0;
                        return (
                          <div
                            key={`${label}-${index}`}
                            className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                              active
                                ? 'bg-[#f5f3ff] font-medium text-[#7c3aed]'
                                : 'text-[#6b7280]'
                            }`}
                          >
                            {active && (
                              <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-[#7c3aed]" />
                            )}
                            <Icon size={14} className={active ? 'text-[#7c3aed]' : 'text-[#9ca3af]'} />
                            <span>{label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Team */}
                    <div className="mt-4 border-t border-[#e5e6eb] pt-3">
                      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                        {copy.mock.teamLabel}
                      </p>
                      <div className="flex items-center gap-2 rounded-md px-3 py-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e9d5ff] bg-[#f5f3ff] text-[10px] font-semibold text-[#7c3aed]">
                          A
                        </div>
                        <p className="truncate text-xs font-medium text-[#111827]">{copy.mock.teamName}</p>
                      </div>
                    </div>
                  </aside>

                  {/* Content */}
                  <div className="overflow-hidden bg-[#f7f7f8]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#e5e6eb] bg-white px-5 py-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
                          {copy.mock.overviewEyebrow}
                        </p>
                        <h2 className="text-sm font-semibold text-[#111827]">{copy.mock.overviewTitle}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="hidden items-center gap-2 rounded-md border border-[#e5e6eb] bg-[#f3f4f6] px-3 py-1.5 sm:flex">
                          <Search size={11} className="text-[#9ca3af]" />
                          <span className="text-[11px] text-[#9ca3af]">{copy.mock.searchPlaceholder}</span>
                        </div>
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e9d5ff] bg-[#f5f3ff] text-[10px] font-semibold text-[#7c3aed]">
                          A
                        </div>
                      </div>
                    </div>

                    {/* Scrollable */}
                    <div className="overflow-y-hidden p-4 space-y-3">
                      {/* Greeting */}
                      <div className="rounded-lg border border-[#e5e6eb] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <p className="text-sm font-semibold text-[#111827]">{copy.mock.greeting}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6b7280]">{copy.mock.greetingText}</p>
                      </div>

                      {/* Stat cards */}
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        {copy.mock.metrics.map((metric) => {
                          const Icon = metric.icon;
                          return (
                            <div
                              key={metric.label}
                              className="rounded-lg border border-[#e5e6eb] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-[9px] font-medium uppercase tracking-wider text-[#9ca3af]">
                                    {metric.label}
                                  </p>
                                  <p className="mt-1 text-xl font-bold text-[#111827]">{metric.value}</p>
                                </div>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${metric.color}`}>
                                  <Icon size={13} className="text-white" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Conversations */}
                      <div className="rounded-lg border border-[#e5e6eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-between border-b border-[#e5e6eb] px-4 py-2.5">
                          <p className="text-xs font-semibold text-[#111827]">{copy.mock.threadsTitle}</p>
                          <span className="text-[11px] text-[#7c3aed]">{copy.mock.threadsCta}</span>
                        </div>
                        <div className="divide-y divide-[#f3f4f6]">
                          {copy.mock.threads.map((thread) => {
                            const ThreadIcon = channelIcon(thread.channel);
                            return (
                              <div key={thread.name} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-medium text-[#6b7280]">
                                  {thread.name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-xs font-medium text-[#111827]">{thread.name}</p>
                                    <ThreadIcon
                                      size={10}
                                      className={`shrink-0 ${channelIconColor(thread.channel)}`}
                                    />
                                  </div>
                                  <p className="truncate text-[11px] text-[#9ca3af]">{thread.message}</p>
                                </div>
                                <span className="shrink-0 rounded-full border border-[#e5e6eb] px-2 py-0.5 text-[10px] font-medium text-[#6b7280]">
                                  {thread.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Fade bottom of mock */}
          <div className="pointer-events-none relative z-10 -mt-16 h-16 bg-gradient-to-t from-white to-transparent" />
        </section>

        {/* ─── Strip ─────────────────────────────────────────────────────── */}
        <section className="border-y border-[#e5e6eb] bg-[#f7f7f8] py-6">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">
                  {copy.strip.eyebrow}
                </p>
                <h2 className="mt-1.5 text-xl font-semibold text-[#111827]">{copy.strip.title}</h2>
              </div>
              <motion.div
                variants={staggerFast}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="flex flex-wrap items-center gap-2.5"
              >
                {copy.strip.items.map((item) => (
                  <motion.span
                    key={item}
                    variants={slideLeft}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e5e6eb] bg-white px-4 py-2 text-sm text-[#6b7280]"
                  >
                    <CheckCircle2 size={13} className="text-[#7c3aed]" />
                    {item}
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ─── Product ───────────────────────────────────────────────────── */}
        <section id="product" className="relative bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="max-w-3xl"
            >
              <SectionLabel>{copy.product.eyebrow}</SectionLabel>
              <motion.h2
                variants={fadeUp}
                className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-5xl"
              >
                {copy.product.title}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-5 max-w-2xl text-lg leading-8 text-[#6b7280]">
                {copy.product.description}
              </motion.p>
            </motion.div>

            <div className="mt-14 grid gap-8 lg:grid-cols-2">
              {/* Left panel */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={slideLeft}
                className="lg:sticky lg:top-24 lg:h-fit"
              >
                <div className="relative overflow-hidden rounded-xl border border-[#e9d5ff] bg-[#f5f3ff] p-7">
                  <div
                    className="absolute right-0 top-0 h-48 w-48 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(124,58,237,0.16), transparent 70%)',
                      filter: 'blur(30px)',
                    }}
                  />
                  <div className="relative">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">
                      {copy.product.sidebarEyebrow}
                    </p>
                    <h3 className="mt-4 text-2xl font-semibold text-[#111827]">{copy.product.sidebarTitle}</h3>
                    <p className="mt-3 text-base leading-7 text-[#6b7280]">{copy.product.sidebarDescription}</p>

                    <div className="mt-8 space-y-5">
                      {copy.product.storySteps.map((step, i) => (
                        <div key={step.label} className="flex gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e9d5ff] bg-white text-sm font-semibold text-[#7c3aed]">
                            {i + 1}
                          </div>
                          <div>
                            <p className="font-medium text-[#111827]">{step.label}</p>
                            <p className="mt-1 text-sm leading-6 text-[#6b7280]">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex items-center gap-3 rounded-lg border border-[#e9d5ff] bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e9d5ff] bg-[#f5f3ff]">
                        <Globe2 size={18} className="text-[#7c3aed]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{copy.product.localeCardTitle}</p>
                        <p className="text-sm text-[#6b7280]">{copy.product.localeCardDescription}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right — first 4 highlight cards */}
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                className="space-y-4"
              >
                {copy.highlights.slice(0, 4).map((item, index) => {
                  const Icon = highlightIcons[index];
                  return (
                    <motion.article
                      key={item.title}
                      variants={cardUp}
                      whileHover={{ y: -3 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                      className="group relative overflow-hidden rounded-lg border border-[#e5e6eb] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">
                            {item.eyebrow}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold leading-snug text-[#111827]">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#6b7280]">{item.description}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.bullets.map((bullet) => (
                              <span
                                key={bullet}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e6eb] px-3 py-1 text-xs text-[#6b7280]"
                              >
                                <ChevronRight size={11} className="text-[#7c3aed]" />
                                {bullet}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#e5e6eb] bg-[#f5f3ff]">
                          <Icon size={19} className="text-[#7c3aed]" />
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── Highlights (remaining 2) ──────────────────────────────────── */}
        <section className="border-y border-[#e5e6eb] bg-[#f7f7f8]">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid gap-4 md:grid-cols-2"
            >
              {copy.highlights.slice(4).map((item, index) => {
                const Icon = highlightIcons[index + 4];
                return (
                  <motion.article
                    key={item.title}
                    variants={cardUp}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                    className="rounded-lg border border-[#e5e6eb] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">
                          {item.eyebrow}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold leading-snug text-[#111827]">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#6b7280]">{item.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.bullets.map((bullet) => (
                            <span
                              key={bullet}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e6eb] px-3 py-1 text-xs text-[#6b7280]"
                            >
                              <ChevronRight size={11} className="text-[#7c3aed]" />
                              {bullet}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#e5e6eb] bg-[#f5f3ff]">
                        <Icon size={19} className="text-[#7c3aed]" />
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ─── Workflow ──────────────────────────────────────────────────── */}
        <section id="workflow" className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="max-w-3xl"
            >
              <SectionLabel>{copy.workflow.eyebrow}</SectionLabel>
              <motion.h2
                variants={fadeUp}
                className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-5xl"
              >
                {copy.workflow.title}
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-5 text-lg leading-8 text-[#6b7280]">
                {copy.workflow.description}
              </motion.p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="mt-12 grid gap-4 lg:grid-cols-4"
            >
              {copy.workflow.steps.map((step, index) => {
                const Icon = flowIcons[index];
                return (
                  <motion.div
                    key={step.title}
                    variants={cardUp}
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="group rounded-lg border border-[#e5e6eb] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-[#e5e6eb] bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#9ca3af]">
                        0{index + 1}
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e6eb] bg-[#f5f3ff]">
                        <Icon size={17} className="text-[#7c3aed]" />
                      </div>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#111827]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6b7280]">{step.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ─── Pricing ───────────────────────────────────────────────────── */}
        <section id="pricing" className="border-y border-[#e5e6eb] bg-[#f7f7f8]">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
            >
              <div className="max-w-2xl">
                <SectionLabel>{copy.pricing.eyebrow}</SectionLabel>
                <motion.h2
                  variants={fadeUp}
                  className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-5xl"
                >
                  {copy.pricing.title}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-5 text-lg leading-8 text-[#6b7280]">
                  {copy.pricing.description}
                </motion.p>
              </div>
              <motion.div
                variants={fadeIn}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5e6eb] bg-white px-5 py-2.5 text-sm text-[#6b7280]"
              >
                <CheckCircle2 size={15} className="text-emerald-500" />
                {copy.pricing.trialLabel}
              </motion.div>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="mt-12 grid gap-4 xl:grid-cols-4"
            >
              {PLAN_ORDER.map((planId) => {
                const plan = PLANS[planId];
                const planCopy = copy.pricing.plans[plan.id];
                const planBadge = 'badge' in planCopy ? planCopy.badge : undefined;
                const highlighted = plan.highlighted;
                return (
                  <motion.div
                    key={plan.id}
                    variants={cardUp}
                    whileHover={{ y: -5 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className={`group relative overflow-hidden rounded-xl p-7 transition-all ${
                      highlighted
                        ? 'border-2 border-[#7c3aed] bg-white shadow-[0_8px_30px_rgba(124,58,237,0.18)]'
                        : 'border border-[#e5e6eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[#d1d5db] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]'
                    }`}
                  >
                    {highlighted && (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.06),transparent_50%)]" />
                    )}
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>
                            {planBadge && (
                              <span className="rounded-full border border-[#e9d5ff] bg-[#f5f3ff] px-2.5 py-0.5 text-xs font-medium text-[#7c3aed]">
                                {planBadge}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#6b7280]">{planCopy.description}</p>
                        </div>
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            highlighted ? 'border border-[#e9d5ff] bg-[#f5f3ff]' : 'border border-[#e5e6eb] bg-[#f3f4f6]'
                          }`}
                        >
                          <Sparkles size={16} className={highlighted ? 'text-[#7c3aed]' : 'text-[#9ca3af]'} />
                        </div>
                      </div>

                      <div className="mt-6 flex items-end gap-1.5">
                        <span className="text-4xl font-bold tracking-[-0.04em] text-[#111827]">
                          {plan.price.monthly === 0
                            ? language === 'pt-BR'
                              ? 'Grátis'
                              : 'Free'
                            : formatLocalizedPrice(plan.price.monthly, plan.price.currency, language)}
                        </span>
                        {plan.price.monthly > 0 && (
                          <span className="pb-1.5 text-sm text-[#9ca3af]">{copy.pricing.perMonthLabel}</span>
                        )}
                      </div>
                      {plan.price.monthly > 0 && (
                        <p className="mt-1 text-xs text-[#9ca3af]">
                          {copy.pricing.annualEquivalentLabel}:{' '}
                          {formatLocalizedPrice(plan.price.annual, plan.price.currency, language)}
                          {copy.pricing.perMonthLabel}
                        </p>
                      )}

                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#e5e6eb] bg-[#f3f4f6] p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
                            {language === 'pt-BR' ? 'Msgs IA' : 'AI msgs'}
                          </p>
                          <p className="mt-1.5 text-lg font-bold text-[#111827]">
                            {plan.limits.aiMessagesPerMonth.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#e5e6eb] bg-[#f3f4f6] p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">
                            {language === 'pt-BR' ? 'Interações' : 'Interactions'}
                          </p>
                          <p className="mt-1.5 text-lg font-bold text-[#111827]">
                            {plan.limits.aiInteractionsPerMonth === -1
                              ? '∞'
                              : plan.limits.aiInteractionsPerMonth}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 space-y-2.5">
                        {planCopy.features.map((feature) => (
                          <div key={feature} className="flex items-start gap-2.5 text-sm text-[#6b7280]">
                            <CheckCircle2
                              size={15}
                              className={`mt-0.5 shrink-0 ${highlighted ? 'text-[#7c3aed]' : 'text-emerald-500'}`}
                            />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="mt-7">
                        <a
                          href="/register"
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all ${
                            highlighted
                              ? 'bg-[#7c3aed] text-white shadow-[0_2px_8px_rgba(124,58,237,0.3)] hover:bg-[#6d28d9]'
                              : 'border border-[#e5e6eb] text-[#374151] hover:border-[#d1d5db] hover:bg-[#f3f4f6]'
                          }`}
                        >
                          {copy.pricing.chooseLabel} {plan.name}
                          <ArrowRight size={14} />
                        </a>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ─── FAQ ───────────────────────────────────────────────────────── */}
        <section id="faq" className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
              >
                <SectionLabel>{copy.faq.eyebrow}</SectionLabel>
                <motion.h2
                  variants={fadeUp}
                  className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-5xl"
                >
                  {copy.faq.title}
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-5 text-lg leading-8 text-[#6b7280]">
                  {copy.faq.description}
                </motion.p>
              </motion.div>

              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                className="space-y-2"
              >
                {copy.faq.items.map((item, index) => (
                  <motion.div
                    key={item.question}
                    variants={cardUp}
                    className="overflow-hidden rounded-lg border border-[#e5e6eb]"
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="flex w-full items-center justify-between gap-4 bg-white px-5 py-4 text-left transition-colors hover:bg-[#f7f7f8]"
                    >
                      <p className="text-base font-medium text-[#111827]">{item.question}</p>
                      <motion.div
                        animate={{ rotate: openFaq === index ? 180 : 0 }}
                        transition={{ duration: 0.2, ease }}
                        className="shrink-0 text-[#9ca3af]"
                      >
                        <ChevronDown size={17} />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {openFaq === index && (
                        <motion.div
                          key="answer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease }}
                          className="overflow-hidden"
                        >
                          <p className="border-t border-[#e5e6eb] bg-[#f7f7f8] px-5 py-4 text-sm leading-7 text-[#6b7280]">
                            {item.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─────────────────────────────────────────────────── */}
        <section className="border-t border-[#e5e6eb] bg-[#f7f7f8]">
          <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8 lg:pb-28">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl bg-[#7c3aed] px-8 py-14 sm:px-12 lg:px-16"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)]" />
              <motion.div
                className="pointer-events-none absolute right-16 top-12 h-48 w-48 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                  filter: 'blur(32px)',
                }}
                animate={shouldReduceMotion ? {} : { scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="max-w-3xl"
                >
                  <motion.p variants={fadeIn} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    {copy.finalCta.eyebrow}
                  </motion.p>
                  <motion.h2
                    variants={fadeUp}
                    className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl"
                  >
                    {copy.finalCta.title}
                  </motion.h2>
                  <motion.p variants={fadeUp} className="mt-5 text-lg leading-8 text-white/76">
                    {copy.finalCta.description}
                  </motion.p>
                </motion.div>

                <div className="flex flex-col gap-3">
                  <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}>
                    <a
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#7c3aed] shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:bg-white/95"
                    >
                      {copy.finalCta.primary}
                      <ArrowRight size={15} />
                    </a>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}>
                    <a
                      href="/login"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white hover:bg-white/16"
                    >
                      {copy.finalCta.secondary}
                    </a>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e5e6eb] bg-[#f7f7f8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-[#9ca3af] lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#e9d5ff] bg-[#f5f3ff]">
              <Image src="/logo.png" alt="HannaAI" width={36} height={36} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-medium text-[#374151]">HannaAI</p>
              <p className="text-xs">{copy.footer.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <a href="/privacy-policy" className="transition-colors hover:text-[#6b7280]">
              {copy.footer.privacy}
            </a>
            <a href="/terms-of-service" className="transition-colors hover:text-[#6b7280]">
              {copy.footer.terms}
            </a>
            <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-[#6b7280]">
              {contactEmail}
            </a>
            <span>© {new Date().getFullYear()} HannaAI</span>
          </div>
        </div>
      </footer>

      <style>{`
        .app-stage {
          perspective: 2600px;
          transform-style: preserve-3d;
        }
        .hero-screen-shell {
          transform-style: preserve-3d;
          transform-origin: center center;
          will-change: transform;
        }
        .app-window {
          transition: box-shadow 0.45s ease, border-color 0.45s ease;
        }
      `}</style>
    </div>
  );
}
