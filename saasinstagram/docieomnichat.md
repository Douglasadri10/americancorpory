# OmniChat: documento de contexto para outra IA

Este arquivo serve como handoff tecnico do projeto. A ideia e permitir que outra IA entre neste repositorio e entenda rapidamente:

- o que o app faz
- quais partes estao realmente implementadas
- quais fluxos sao os mais importantes
- o que ainda esta incompleto
- qual parece ser o foco atual do trabalho

O nome comercial exibido no produto e `OmniChat`, embora o repositorio esteja em `saasinstagram`.

## 1. Resumo executivo

O projeto e um SaaS de atendimento omnichannel com foco principal em:

- centralizar conversas de Instagram, Facebook e, parcialmente, WhatsApp
- registrar contatos, conversas, mensagens, automacoes e leads no Firestore
- usar IA da OpenAI para sugerir ou enviar respostas automaticas
- oferecer painel web para operacao: inbox, canais, automacoes, leads, logs, configuracoes e billing

Hoje, a parte mais critica e mais real do sistema e o fluxo de canais Meta + webhook + inbox + resposta por IA.

O app esta claramente em fase de produto real, mas ainda com varias areas parcialmente prontas. O repositorio mistura:

- fluxo moderno em `Next.js App Router`
- integracao ativa com Firebase e Vercel
- codigo legado/operacional de `Firebase Functions`
- scripts manuais de setup para canais Meta
- UI ja relativamente polida, mas com alguns modulos ainda simulados ou incompletos

## 2. Objetivo do produto

O produto quer funcionar como um "hub" de atendimento para pequenas empresas, com estes pilares:

- inbox unificado de mensagens
- resposta automatica com IA
- CRM simples de leads
- automacoes por gatilho
- gestao de canais conectados
- cobranca por planos

No estado atual do codigo, o caso de uso mais avancado e:

1. conectar uma pagina/conta da Meta
2. receber eventos de webhook
3. localizar ou criar conversa
4. salvar mensagens no Firestore
5. gerar resposta com OpenAI quando fizer sentido
6. enviar a resposta de volta para Instagram/Facebook
7. registrar logs operacionais para diagnostico

## 3. Stack principal

Frontend e backend web:

- `Next.js 14`
- `React 18`
- `TypeScript`
- `Tailwind CSS`

Dados e autenticacao:

- `Firebase Auth`
- `Firestore`
- `Firebase Admin SDK`

IA:

- `OpenAI SDK`
- modelos configurados via `lib/openai/client.ts`

Pagamentos:

- `Stripe`

Deploy e operacao:

- uso evidente de `Vercel` para o app web
- configuracoes antigas/auxiliares de `Firebase Hosting` e `Firebase Functions`

## 4. Estrutura de pastas

Mapa de alto nivel:

- `app/`: rotas App Router do Next, incluindo dashboard e APIs
- `components/`: UI reutilizavel e componentes de paginas
- `hooks/`: hooks de auth, workspace, conversas e mensagens
- `services/`: camada de acesso ao Firestore no cliente
- `lib/`: clientes, utilitarios, integracoes Meta, OpenAI, Stripe e Firebase
- `types/`: tipos centrais do dominio
- `firebase/`: regras do Firestore
- `functions/`: codigo de Cloud Functions legado/paralelo
- `scripts/`: scripts manuais de setup e refresh de token

Pontos importantes:

- o app principal ativo esta em `app/`
- `functions/` parece representar uma fase anterior ou uma via alternativa de backend
- `scripts/` contem conhecimento operacional importante do projeto

## 5. Arquitetura geral

### 5.1 Frontend

O frontend e um painel autenticado com sidebar e paginas dedicadas a:

- overview
- inbox
- leads
- automations
- channels
- logs
- team
- billing
- settings

A navegacao principal esta em:

- `components/layout/Sidebar.tsx`
- `components/layout/Header.tsx`
- `app/(dashboard)/layout.tsx`

### 5.2 Backend

O backend principal atual esta nas rotas `app/api/*`.

Existem rotas para:

- autenticacao e sessao
- workspace
- canais
- webhook da Meta
- envio manual de mensagens
- automacoes
- logs
- callback do OAuth Meta
- webhook do Stripe

### 5.3 Banco

O Firestore e o banco central do app. O sistema grava e le:

- `workspaces`
- `channels`
- `conversations`
- `messages`
- `automations`
- `leads`
- `webhookLogs`

Existe mistura entre:

- colecoes top-level
- subcolecoes dentro de `workspaces/{workspaceId}`

Isso indica que o modelo de dados ainda nao esta 100% consolidado.

## 6. Modelo de autenticacao e workspace

### 6.1 Auth

Autenticacao via Firebase Auth:

- email/senha
- Google popup

Arquivos relevantes:

- `hooks/useAuth.ts`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `lib/firebase/client.ts`
- `lib/firebase/admin.ts`

Observacoes:

- o frontend trabalha principalmente com `idToken` do Firebase
- existe rota de sessao em `app/api/auth/session/route.ts`
- o login client-side nao parece depender de uma sessao server-side forte em todo o app
- ha uma combinacao de auth via cookie simples e auth via bearer token

### 6.2 Workspace

O sistema gira ao redor de `workspace`.

Fluxo de onboarding atual:

1. cria usuario
2. cria workspace
3. aplica plano inicial `free` (gratuito permanente, sem cartão)

Arquivos relevantes:

- `hooks/useWorkspace.ts`
- `services/workspaceService.ts`
- `app/api/workspace/me/route.ts`
- `app/api/workspace/settings/route.ts`

Observacoes importantes:

- o workspace ativo e controlado no browser com `localStorage.currentWorkspaceId`
- boa parte das telas e APIs assume workspace do owner
- suporte a varios workspaces existe no conceito, mas parece parcial na implementacao

## 7. Principais entidades do dominio

### 7.1 Conversation

Arquivo principal:

- `types/conversation.ts`

Campos importantes:

- `workspaceId`
- `channel`
- `channelId`
- `contactId`
- `contactName`
- `contactUsername`
- `status`
- `priority`
- `assignedTo`
- `tags`
- `lastMessage`
- `lastMessageAt`
- `unreadCount`
- `leadId`
- `aiEnabled`

Uso:

- representa um thread de atendimento
- conecta inbox, mensagens, CRM e automacao

### 7.2 Message

Arquivo principal:

- `types/message.ts`

Campos importantes:

- `conversationId`
- `workspaceId`
- `channel`
- `direction`
- `type`
- `text`
- `mediaUrl`
- `senderId`
- `senderName`
- `senderType`
- `status`
- `metadata`
- `generatedByAI`

Observacao importante:

- ha inconsistencia de tipagem: parte do codigo grava `senderType: 'ai'`, mas o tipo nem sempre reflete isso corretamente

### 7.3 Lead

Arquivo principal:

- `types/lead.ts`

Uso:

- CRM simples
- dados de contato
- origem
- status comercial
- valor
- tags
- historico

### 7.4 Automation

Arquivo principal:

- `types/automation.ts`

Modelo:

- um gatilho
- zero ou mais condicoes
- uma sequencia de acoes

Tipos de gatilho:

- nova conversa
- nova mensagem
- palavra-chave
- conversa atribuida
- conversa resolvida
- sem resposta do agente
- fora do horario

Tipos de acao:

- enviar mensagem
- responder com IA
- atribuir agente
- adicionar tag
- alterar status
- aguardar
- chamar webhook
- notificar agente

### 7.5 MetaConnectedChannel

Arquivo principal:

- `types/meta.ts`

Representa canal conectado da Meta, com campos como:

- `channel`
- `pageId`
- `pageName`
- `pageAvatarURL`
- `instagramAccountId`
- `instagramAccountIdApi`
- `instagramUsername`
- `phoneNumber`
- `accessToken`
- `tokenExpiresAt`
- `webhookVerified`
- `isActive`

## 8. Funcionalidades por area

### 8.1 Overview

Arquivo:

- `app/(dashboard)/overview/page.tsx`

Entrega:

- cards de estatisticas
- resumo de conversas
- distribuicao por canal
- conversas recentes

Estado:

- funcional para leitura geral
- alguns indicadores ainda sao placeholder ou simplificados

### 8.2 Inbox

Arquivos principais:

- `app/(dashboard)/inbox/page.tsx`
- `app/(dashboard)/inbox/[id]/page.tsx`
- `components/inbox/ConversationList.tsx`
- `components/inbox/ConversationThread.tsx`
- `components/inbox/ContactPanel.tsx`
- `components/inbox/MessageBubble.tsx`
- `hooks/useConversations.ts`
- `hooks/useMessages.ts`

Entrega:

- lista de conversas
- thread em tempo real via Firestore
- envio manual de mensagem
- resolve/reabre conversa
- painel lateral do contato

Estado:

- este e um dos modulos mais reais do sistema
- a lista tem filtros de UI, mas nem todos filtram de fato no backend
- parte das acoes do painel lateral ainda e placeholder
- o modo de IA no composer e mais visual do que um fluxo separado de produto

### 8.3 Leads

Arquivo:

- `app/(dashboard)/leads/page.tsx`

Entrega:

- visualizacao de leads
- filtros
- estatisticas simples
- acoes de exportacao e criacao

Estado:

- modulo com estrutura pronta
- parte das interacoes ainda nao representa um CRM completo

### 8.4 Automations

Arquivos principais:

- `app/(dashboard)/automations/page.tsx`
- `components/automations/AutomationEditor.tsx`
- `app/api/automations/route.ts`
- `app/api/automations/[id]/route.ts`
- `services/automationService.ts`

Entrega:

- criar, editar, listar, ativar, desativar e remover automacoes
- editor visual de gatilhos e acoes

Estado real:

- CRUD existe
- UI do editor esta boa
- engine de execucao ainda nao parece completa dentro do fluxo operacional principal
- ha sinais de recurso parcialmente implementado

Observacao importante:

- o editor de automacao exibe condicoes como palavra-chave, mas nem toda a configuracao esta claramente persistida ou executada end-to-end

### 8.5 Channels

Arquivos principais:

- `app/(dashboard)/channels/page.tsx`
- `components/channels/ChannelCard.tsx`
- `components/channels/ManualTokenModal.tsx`
- `app/api/channels/route.ts`
- `app/api/channels/manual/route.ts`
- `app/api/channels/[id]/route.ts`
- `app/api/channels/[id]/subscribe/route.ts`
- `app/api/meta/callback/route.ts`

Entrega:

- listar canais conectados
- conectar via OAuth da Meta
- conectar manualmente por token
- atualizar token
- verificar webhook
- ativar/desativar canal
- desconectar
- reconectar conta IG quando necessario

Estado:

- este e um modulo central e ativo
- o suporte a Instagram e Facebook esta mais claro
- WhatsApp aparece no produto, mas parece menos maduro no fluxo de configuracao
- existe suporte a token criptografado e tambem compatibilidade com token plain-text legado

### 8.6 Logs

Arquivos:

- `app/(dashboard)/logs/page.tsx`
- `app/api/logs/route.ts`

Entrega:

- lista de logs operacionais do webhook
- auto refresh
- busca
- limpar logs
- visualizar payload detalhado

Importancia:

- e uma tela critica para diagnostico de integracao Meta
- o projeto esta claramente usando esta tela como centro de depuracao do webhook

### 8.7 Team

Arquivo:

- `app/(dashboard)/team/page.tsx`

Estado:

- modulo majoritariamente mock
- convite de membros e simulacao de estados
- nao representa uma gestao completa de equipe ainda

### 8.8 Billing

Arquivos:

- `app/(dashboard)/billing/page.tsx`
- `lib/stripe/plans.ts`
- `app/api/stripe/webhook/route.ts`

Entrega visivel:

- UI de planos
- resumo de uso
- botoes para checkout e portal

Lacuna importante:

- a pagina tenta chamar APIs de checkout e portal que nao existem no `app/api`
- portanto o billing esta parcialmente desenhado, mas nao completo no fluxo web atual

### 8.9 Settings

Arquivos:

- `app/(dashboard)/settings/page.tsx`
- `app/api/workspace/settings/route.ts`

Entrega:

- configuracoes gerais
- horario comercial
- notificacoes
- IA
- seguranca
- aparencia

Estado:

- parte das configuracoes salva de verdade
- parte ainda parece ser apenas UI
- configuracoes de IA sao relevantes para o fluxo operacional

## 9. Integracao com Meta

Esta e a parte mais importante do projeto neste momento.

Arquivos centrais:

- `lib/meta/graph.ts`
- `lib/meta/webhook.ts`
- `lib/meta/normalizer.ts`
- `app/api/meta/callback/route.ts`
- `app/api/webhooks/meta/route.ts`
- `app/api/messages/route.ts`
- `lib/utils/encryption.ts`

### 9.1 O que o sistema faz com a Meta

O app tenta cobrir:

- login e conexao via OAuth
- persistencia de tokens
- descoberta de pagina e conta Instagram
- verificacao de webhook
- recebimento de eventos
- normalizacao de mensagens
- envio de resposta

### 9.2 Tipos de canal

Os canais previstos no produto sao:

- `instagram`
- `facebook`
- `whatsapp`

Estado mais maduro:

- Instagram e Facebook

Estado parcial:

- WhatsApp Cloud API aparece no modelo e em partes do backend, mas nao parece ter o mesmo nivel de UX e maturidade no painel

### 9.3 Criptografia de token

Arquivo:

- `lib/utils/encryption.ts`

Comportamento:

- tokens novos podem ser armazenados criptografados
- existe `decryptIfNeeded()` para manter compatibilidade com registros antigos ou manuais

Isso e importante porque o repositorio esta em transicao entre operacao manual e fluxo mais robusto.

## 10. Fluxo principal do webhook

Arquivo mais importante:

- `app/api/webhooks/meta/route.ts`

### 10.1 Fluxo resumido

1. Meta envia evento para `/api/webhooks/meta`
2. rota valida `hub.challenge` no GET
3. rota pode validar assinatura `x-hub-signature-256` no POST
4. payload e logado em `webhookLogs`
5. o sistema identifica o canal correto
6. extrai eventos de `messaging`
7. normaliza a mensagem
8. cria ou encontra a conversa
9. salva a mensagem no Firestore
10. atualiza resumo da conversa
11. se houver texto inbound valido e IA habilitada, gera resposta
12. envia a resposta de volta pela Graph API
13. salva a resposta gerada como mensagem outbound
14. registra logs de sucesso ou erro

### 10.2 Casos especiais tratados

O webhook tem logica adicional para:

- diferenciar `message`, `read`, `echo` e eventos sem mensagem
- lidar com caminho de Instagram em que o conteudo precisa ser buscado na API antes de processar
- fazer match de canal por `instagramAccountId`, `instagramAccountIdApi` ou `pageId`

### 10.3 Papel dos logs

O sistema grava eventos como:

- `webhook_received`
- `event_received`
- `channel_found`
- `processing_events`
- `before_ai_gate`
- `ai_check`
- `ai_sent`
- `ai_error`

Isso torna o webhook um fluxo observavel e depuravel.

## 11. Fluxo de resposta por IA

Arquivos centrais:

- `lib/openai/client.ts`
- `lib/openai/prompts.ts`
- `app/api/webhooks/meta/route.ts`

### 11.1 O que acontece

Quando chega uma mensagem inbound com texto:

1. o sistema busca configuracoes do workspace
2. monta historico recente da conversa
3. monta prompt contextual com negocio, canal e politicas
4. chama a OpenAI
5. recebe o texto de resposta
6. envia essa resposta pela Meta
7. persiste a resposta no Firestore

### 11.2 Prompts existentes

O projeto ja tem base para varios comportamentos:

- atendimento geral
- vendas
- qualificacao de lead
- resposta fora do horario

### 11.3 Observacoes

- a IA mais relevante hoje e a IA automatica do webhook
- ha tambem utilitarios de classificacao de intencao e extracao de lead
- o modelo default visto no codigo e `gpt-4o-mini`

## 12. Fluxo de envio manual de mensagem

Arquivo:

- `app/api/messages/route.ts`

Comportamento:

- usuario envia mensagem pela inbox
- sistema busca conversa e canal
- envia para a Meta
- grava mensagem localmente
- atualiza status e resumo da conversa

Observacao importante:

- esta rota usa autenticacao de sessao/cookie, enquanto outras usam bearer token do Firebase
- isso e um sinal de arquitetura ainda em consolidacao

## 13. Firestore e regras

Arquivo:

- `firebase/firestore.rules`

Leitura geral:

- ha regras relativamente amplas para varias colecoes top-level
- subcolecoes de workspace usam mais checagens de ownership e membership

Interpretacao pratica:

- o projeto parece ter evoluido rapido, com regras funcionais mas ainda nao minimalistas
- seguranca e consistencia de acesso provavelmente ainda vao precisar de endurecimento

## 14. Stripe e monetizacao

Arquivos:

- `lib/stripe/client.ts`
- `lib/stripe/plans.ts`
- `app/api/stripe/webhook/route.ts`

O que ja existe:

- catalogo de planos `starter`, `growth`, `enterprise`
- limites por plano
- webhook do Stripe para atualizar workspace

O que falta ou esta incompleto:

- rotas web de checkout/portal que a UI tenta chamar

Conclusao:

- a monetizacao esta parcialmente modelada, mas nao totalmente fechada no app atual

## 15. Scripts operacionais importantes

Arquivos:

- `scripts/setup-channel.mjs`
- `scripts/refresh-token.mjs`

Esses scripts sao valiosos para entender o historico do projeto.

### 15.1 `scripts/setup-channel.mjs`

Mostra que houve ou ainda ha uso de setup manual para:

- criar workspace
- criar membro owner
- criar canal Instagram
- inscrever webhook

Esse script sugere um passado recente de bootstrap manual e teste dirigido.

### 15.2 `scripts/refresh-token.mjs`

Mostra um fluxo operacional de:

- trocar short-lived token por long-lived token
- atualizar canal no Firestore
- reinscrever webhook
- verificar conta Meta

Isso indica que a equipe esta lidando diretamente com problemas reais de token, validade e assinatura de webhook.

## 16. Pasta `functions/`

A pasta `functions/` contem codigo paralelo para:

- webhook Meta
- resposta de IA
- Stripe

Interpretacao recomendada para outra IA:

- trate `app/api/*` como backend principal atual do produto web
- trate `functions/` como legado, experimento paralelo ou camada de transicao
- nao assuma que `functions/` e a runtime principal, a menos que alguma tarefa futura mostre o contrario

## 17. Estado atual do produto

Se outra IA precisar priorizar entendimento, a ordem de maturidade mais provavel e:

1. canais Meta + webhook + inbox + logs
2. workspace/auth
3. configuracoes de IA
4. CRUD de automacoes
5. leads
6. billing
7. team

### 17.1 O que parece realmente pronto para uso

- login e registro
- criacao de workspace
- dashboard autenticado
- conexao de canais Meta
- recebimento de webhook
- persistencia de conversas e mensagens
- tela de logs de webhook
- resposta por IA no fluxo principal

### 17.2 O que parece funcional, mas parcial

- automacoes
- leads
- configuracoes
- suporte a multi-workspace
- WhatsApp
- billing

### 17.3 O que parece incompleto ou mock

- team/invite
- parte do billing web
- parte das configuracoes de UI
- partes do CRM
- alguns filtros e acoes de interface

## 18. Foco atual do trabalho

Pelo codigo e pelos artefatos operacionais, o foco atual do projeto parece ser:

- estabilizar a integracao de Instagram DM
- garantir webhook confiavel
- lidar com tokens Meta, page tokens e user tokens
- confirmar que o canal conectado esta correto
- fazer a IA responder automaticamente em cenarios reais
- instrumentar logs para diagnostico de problemas

Se outra IA for continuar o trabalho, a leitura correta e:

- o projeto nao esta apenas "construindo um SaaS"
- ele esta especificamente tentando fechar o fluxo de testes reais de Instagram DM com auto reply por IA

## 19. Inconsistencias e pontos de atencao

Esta secao e importante para evitar conclusoes erradas.

### 19.1 Mistura de modelos de auth

- parte das rotas usa bearer token Firebase
- parte usa sessao/cookie

### 19.2 Mistura de estrutura de dados

- existem colecoes top-level e subcolecoes por workspace
- isso sugere evolucao incremental do schema

### 19.3 Build tolera erros

Em `next.config.mjs`, o build ignora erros de TypeScript e ESLint.

Isso significa:

- o app pode deployar mesmo com problemas tecnicos nao tratados
- outra IA nao deve assumir que "buildando" significa "arquitetura saudavel"

### 19.4 UI nem sempre implica backend completo

Exemplos:

- billing com botoes sem rotas correspondentes
- team com fluxo mock
- filtros de inbox parcialmente cosmeticos
- automacoes com editor mais avancado que a engine

### 19.5 Permissoes do Firestore merecem revisao futura

As rules parecem funcionais, mas amplas em alguns pontos.

## 20. Variaveis de ambiente relevantes

Nao listar valores reais aqui. Apenas as categorias que outra IA deve conhecer.

### 20.1 Firebase client

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### 20.2 Firebase admin

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### 20.3 Meta

- `NEXT_PUBLIC_META_APP_ID`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `NEXT_PUBLIC_APP_URL`

### 20.4 OpenAI

- `OPENAI_API_KEY`

### 20.5 Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_ENTERPRISE`

### 20.6 Criptografia

- `ENCRYPTION_KEY`

## 21. Como outra IA deve abordar este repositorio

Se a meta for continuar desenvolvimento, a heuristica recomendada e:

1. identificar se a tarefa e do fluxo principal atual ou de modulo secundario
2. priorizar `app/api/webhooks/meta/route.ts` quando o assunto envolver DM, webhook, Meta ou IA
3. validar sempre a relacao entre `channel`, `pageId`, `instagramAccountId` e token
4. tratar `logs` como fonte operacional principal de verdade
5. nao assumir que todo recurso da UI esta implementado end-to-end
6. conferir se uma feature esta no backend Next atual ou no codigo legado de `functions/`

### 21.1 Ordem de leitura recomendada para outra IA

1. `app/api/webhooks/meta/route.ts`
2. `lib/meta/graph.ts`
3. `lib/meta/normalizer.ts`
4. `lib/openai/client.ts`
5. `lib/openai/prompts.ts`
6. `app/api/messages/route.ts`
7. `app/(dashboard)/channels/page.tsx`
8. `app/(dashboard)/inbox/page.tsx`
9. `hooks/useConversations.ts`
10. `hooks/useMessages.ts`
11. `app/(dashboard)/logs/page.tsx`
12. `app/api/logs/route.ts`

## 22. Resumo final

OmniChat e um SaaS de atendimento com IA cujo coracao atual e a integracao com a Meta para Instagram/Facebook.

O repositorio ja contem:

- painel autenticado
- modelo de workspace
- inbox operacional
- canais conectaveis
- webhook da Meta
- respostas por IA
- observabilidade via logs

Mas ainda contem zonas parciais ou em transicao:

- billing web incompleto
- team mock
- CRM e automacoes ainda amadurecendo
- estrutura de auth e dados ainda sendo consolidada
- coexistencia de codigo atual e legado

Se outra IA assumir este projeto, ela deve tratar o fluxo `Meta -> webhook -> conversation -> message -> AI -> outbound message -> log` como o eixo principal do sistema.
