/**
 * Script de setup do canal Instagram no Firestore
 * Uso: node scripts/setup-channel.mjs <PAGE_ACCESS_TOKEN>
 *
 * Cria:
 *  - workspace (M&D Solutions)
 *  - channel (Instagram)
 *  - membro (owner)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lê as credenciais do service account ──────────────────────────────────────
const saKeyPath = join(__dirname, '..', 'hannai2-sa-key.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saKeyPath, 'utf-8'));
} catch {
  console.error('❌  Arquivo hannai2-sa-key.json não encontrado em:', saKeyPath);
  process.exit(1);
}

// ── Pega o token do argumento ─────────────────────────────────────────────────
const PAGE_ACCESS_TOKEN = process.argv[2];
if (!PAGE_ACCESS_TOKEN) {
  console.error('❌  Informe o Page Access Token como argumento:');
  console.error('    node scripts/setup-channel.mjs EAAYxUEY...');
  process.exit(1);
}

// ── Configurações fixas ───────────────────────────────────────────────────────
const PAGE_ID              = '1022942164237354';
const INSTAGRAM_ACCOUNT_ID = '1022942164237354';
const WORKSPACE_ID         = 'ws_mdsolutions';
const CHANNEL_ID           = 'ch_instagram_main';
const OWNER_EMAIL          = 'mdfloorsusa@gmail.com';  // sua conta Firebase Auth

// ── Init Firebase Admin ───────────────────────────────────────────────────────
initializeApp({ credential: cert(serviceAccount), projectId: 'hannai2' });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function setup() {
  console.log('\n🚀  Configurando HannaAI no Firebase...\n');

  // 1. Workspace
  const wsRef = db.collection('workspaces').doc(WORKSPACE_ID);
  await wsRef.set({
    id: WORKSPACE_ID,
    name: 'M&D Solutions',
    slug: 'mdsolutions',
    ownerUid: OWNER_EMAIL,
    plan: { id: 'starter', status: 'active' },
    settings: {
      timezone: 'America/Sao_Paulo',
      businessHours: { start: '08:00', end: '18:00', days: [1,2,3,4,5] },
      outOfHoursMessage: 'Olá! Estamos fora do horário de atendimento. Retornaremos em breve! 😊',
      aiEnabled: true,
      aiPersonality: 'Você é um assistente profissional e simpático da M&D Solutions. Responda sempre no idioma do cliente, seja direto e prestativo. Mantenha o idioma iniciado pelo cliente, a menos que ele peça para mudar. Foque em entender a necessidade do cliente e direcionar para o atendimento correto.',
      language: 'pt-BR',
    },
    limits: {
      messagesPerMonth: 500,
      messagesUsed: 0,
      channels: 1,
      agents: 1,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Workspace criado:', WORKSPACE_ID);

  // 2. Membro (owner)
  await wsRef.collection('members').doc(OWNER_EMAIL).set({
    role: 'owner',
    email: OWNER_EMAIL,
    name: 'Dono',
    workspaceId: WORKSPACE_ID,
    joinedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Membro owner criado');

  // 3. Canal Instagram
  await db.collection('channels').doc(CHANNEL_ID).set({
    id: CHANNEL_ID,
    workspaceId: WORKSPACE_ID,
    channel: 'instagram',
    pageId: PAGE_ID,
    pageName: 'M&D Solutions Instagram',
    instagramAccountId: INSTAGRAM_ACCOUNT_ID,
    instagramAccountIdApi: INSTAGRAM_ACCOUNT_ID,
    accessToken: PAGE_ACCESS_TOKEN,   // em produção isso seria criptografado
    authMethod: 'manual',
    tokenType: 'page',
    tokenStatus: 'limited',
    grantedScopes: [],
    requiredScopes: [
      'instagram_basic',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
    ],
    connected: true,
    webhookVerified: true,
    webhookStatus: 'subscribed',
    igConnectionStatus: 'connected',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Canal Instagram criado:', CHANNEL_ID);

  // 4. Subscrever webhook na Meta (messages field)
  console.log('\n📡  Subscrevendo webhook na Meta...');
  try {
    const subRes = await fetch(
      `https://graph.facebook.com/v18.0/${PAGE_ID}/subscribed_apps`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
          access_token: PAGE_ACCESS_TOKEN,
        }),
      }
    );
    const subData = await subRes.json();
    if (subData.success) {
      console.log('✅  Webhook subscrito na Meta (messages, messaging_postbacks)');
    } else {
      console.warn('⚠️   Webhook subscribe retornou:', JSON.stringify(subData));
    }
  } catch (err) {
    console.warn('⚠️   Erro ao subscrever webhook (tente manualmente):', err.message);
  }

  console.log('\n🎉  Setup completo!\n');
  console.log('   Workspace ID :', WORKSPACE_ID);
  console.log('   Canal ID     :', CHANNEL_ID);
  console.log('   Page ID      :', PAGE_ID);
  console.log('\n👉  Agora manda um DM para a conta Instagram da M&D Solutions e veja chegar no HannaAI!\n');
  process.exit(0);
}

setup().catch((err) => {
  console.error('❌  Erro:', err.message);
  process.exit(1);
});
