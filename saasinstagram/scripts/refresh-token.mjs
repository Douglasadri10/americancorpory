/**
 * Troca o short-lived token por um long-lived token (60 dias)
 * e atualiza o canal no Firestore + subscreve webhook.
 *
 * Uso: node scripts/refresh-token.mjs <SHORT_LIVED_TOKEN>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

// ── Lê .env.local ─────────────────────────────────────────────────────────────
function readEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch {
    console.error('❌  .env.local não encontrado');
    process.exit(1);
  }
  return env;
}

const env = readEnv();
const APP_ID     = env.META_APP_ID;
const APP_SECRET = env.META_APP_SECRET;

if (!APP_ID || !APP_SECRET || APP_ID.startsWith('your_')) {
  console.error('❌  META_APP_ID e META_APP_SECRET precisam estar preenchidos no .env.local');
  process.exit(1);
}

const SHORT_TOKEN = process.argv[2];
if (!SHORT_TOKEN) {
  console.error('❌  Informe o token como argumento:');
  console.error('    node scripts/refresh-token.mjs EAAYxUEY...');
  process.exit(1);
}

// ── Firebase ──────────────────────────────────────────────────────────────────
const saKey = JSON.parse(readFileSync(join(root, 'hannai2-sa-key.json'), 'utf-8'));
initializeApp({ credential: cert(saKey), projectId: 'hannai2' });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const PAGE_ID    = '1022942164237354';
const WORKSPACE  = 'ws_mdsolutions';
const CHANNEL    = 'ch_instagram_main';

async function main() {
  console.log('\n🔄  Trocando por Long-Lived Token (60 dias)...');

  // 1. Exchange short → long-lived
  const exchangeUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
  exchangeUrl.searchParams.set('grant_type',       'fb_exchange_token');
  exchangeUrl.searchParams.set('client_id',        APP_ID);
  exchangeUrl.searchParams.set('client_secret',    APP_SECRET);
  exchangeUrl.searchParams.set('fb_exchange_token', SHORT_TOKEN);

  const exchangeRes  = await fetch(exchangeUrl.toString());
  const exchangeData = await exchangeRes.json();

  if (!exchangeData.access_token) {
    console.error('❌  Erro ao trocar token:', JSON.stringify(exchangeData));
    process.exit(1);
  }

  const LONG_TOKEN   = exchangeData.access_token;
  const expiresInSec = exchangeData.expires_in ?? 5183944; // ~60 dias
  const expiresAt    = new Date(Date.now() + expiresInSec * 1000);
  console.log(`✅  Long-Lived Token gerado! Expira em: ${expiresAt.toLocaleDateString('pt-BR')}`);

  // 2. Atualiza canal no Firestore
  const channelRef = db.collection('channels').doc(CHANNEL);

  await channelRef.update({
    accessToken:    LONG_TOKEN,
    tokenExpiresAt: expiresAt.toISOString(),
    tokenStatus:    'active',
    webhookStatus:  'pending',
    connected:      true,
    updatedAt:      FieldValue.serverTimestamp(),
  });
  console.log('✅  Canal atualizado no Firestore com long-lived token');

  // 3. Subscrever webhook na Meta
  console.log('\n📡  Subscrevendo webhook na Meta (messages)...');
  const subRes = await fetch(
    `https://graph.facebook.com/v18.0/${PAGE_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
        access_token: LONG_TOKEN,
      }),
    }
  );
  const subData = await subRes.json();

  if (subData.success) {
    console.log('✅  Webhook subscrito! Campos: messages, messaging_postbacks');
  } else {
    console.warn('⚠️   Webhook subscribe:', JSON.stringify(subData));
  }

  // 4. Verifica se a conta recebe mensagens
  console.log('\n🔍  Verificando conta Instagram...');
  const igRes = await fetch(
    `https://graph.facebook.com/v18.0/${PAGE_ID}?fields=name,instagram_business_account&access_token=${LONG_TOKEN}`
  );
  const igData = await igRes.json();
  if (igData.name) {
    console.log(`✅  Conta verificada: ${igData.name} (ID: ${PAGE_ID})`);
  }

  console.log('\n🎉  Tudo pronto!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👉  TESTE AGORA:');
  console.log('    1. Certifique-se que npm run dev está rodando');
  console.log('    2. Certifique-se que o cloudflared tunnel está rodando');
  console.log('    3. Manda um DM para a conta Instagram M&D Solutions');
  console.log('    4. A IA vai responder automaticamente!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

main().catch(err => {
  console.error('❌  Erro:', err.message);
  process.exit(1);
});
