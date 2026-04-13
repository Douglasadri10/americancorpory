import type { Firestore } from 'firebase-admin/firestore';
import type { LeadStatus } from '@/types/lead';

// ─── Signal rules ─────────────────────────────────────────────────────────────
// Each rule adds/subtracts `delta` from the lead's cumulative score when its
// pattern matches the incoming message. Rules are evaluated in order; multiple
// rules can fire on the same message.

interface Rule {
  label: string;
  pattern: RegExp;
  delta: number;
}

const RULES: Rule[] = [
  // ── Booking intent (highest signal) ────────────────────────────────────────
  {
    label: 'booking',
    pattern:
      /\b(agendar|agendamento|marcar (uma )?(consulta|visita|reuni[aã]o|horário)|reservar|quero (marcar|agendar)|quando (você|vc|vocês|pode|poderia)|disponível para|que horas|dia (e )?hora)\b/i,
    delta: 28,
  },
  // ── Purchase intent ─────────────────────────────────────────────────────────
  {
    label: 'purchase_intent',
    pattern:
      /\b(quero (comprar|adquirir|contratar|assinar|fechar|encomendar)|vou (comprar|contratar|fechar)|fechar (negócio|contrato|acordo|pedido)|quero (levar|pegar|um desse|esse produto))\b/i,
    delta: 25,
  },
  // ── Pricing inquiry ─────────────────────────────────────────────────────────
  {
    label: 'pricing',
    pattern:
      /\b(quanto (custa|cobra|vale|é|fica|cobram)|qual (o )?(preço|valor|custo|investimento)|preços?|valores?|planos?|pacotes?|tabela de preços?|orçamento|propost[ao])\b/i,
    delta: 16,
  },
  // ── Strong interest ─────────────────────────────────────────────────────────
  {
    label: 'strong_interest',
    pattern:
      /\b(tenho interesse|me interessa|quero saber mais|mais informações?|como funciona|quero conhecer|quero ver|pode me (mostrar|apresentar)|me manda|me envia)\b/i,
    delta: 12,
  },
  // ── Mild interest / product mention ─────────────────────────────────────────
  {
    label: 'mild_interest',
    pattern:
      /\b(produto|serviço|serviço|solução|plataforma|sistema|ferramenta|seu (produto|serviço)|sobre (o|a) (produto|serviço|empresa))\b/i,
    delta: 6,
  },
  // ── General question (low value) ────────────────────────────────────────────
  {
    label: 'inquiry',
    pattern: /\b(dúvida|duvida|pergunta|como (eu|posso|faço)|pode me (ajudar|explicar|informar))\b/i,
    delta: 4,
  },
  // ── Urgency amplifier (bonus on top of other signals) ───────────────────────
  {
    label: 'urgency',
    pattern: /\b(urgente|preciso hoje|para hoje|o mais rápido|logo|quanto antes|agora|imediato)\b/i,
    delta: 8,
  },
  // ── Re-engagement after silence ─────────────────────────────────────────────
  {
    label: 'reengagement',
    pattern: /\b(voltei|passei para perguntar|lembrei de você|ainda (vende|tem|disponível))\b/i,
    delta: 10,
  },

  // ── Disinterest / cancellation ───────────────────────────────────────────────
  {
    label: 'disinterest',
    pattern:
      /\b(não (quero|tenho interesse|preciso|vou (comprar|contratar))|nao (quero|tenho interesse|preciso)|cancelar|desistir|não estou (mais )?(interessad[oa])|mudei de ideia|não (vou|pretendo)|só (tava|estava) curioso)\b/i,
    delta: -18,
  },
  // ── Spam / noise ────────────────────────────────────────────────────────────
  {
    label: 'spam',
    pattern:
      /\b(ganhe dinheiro|bitcoin|criptomoeda|investimento garantido|clique (aqui|no link)|promoção (grátis|gratis|imperdível)|faça renda|trabalhe (em casa|de casa)|renda extra fácil)\b/i,
    delta: -30,
  },
];

// ─── Per-message delta caps ───────────────────────────────────────────────────
const MAX_DELTA = 35;   // max gain per single message
const MIN_DELTA = -20;  // max loss per single message

// ─── Status thresholds ────────────────────────────────────────────────────────
// Only auto-promote statuses that are still early-stage (new / contacted).
// Manual or late-stage statuses (qualified, proposal, won, lost…) are never
// overwritten automatically.

const AUTO_STATUSES: LeadStatus[] = ['new', 'contacted'];

function inferStatus(score: number): LeadStatus | null {
  if (score >= 72) return 'qualified';
  if (score >= 40) return 'contacted';
  if (score <= 4)  return 'unqualified';
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function classifyAndUpdateLead(params: {
  db: Firestore;
  workspaceId: string;
  leadId: string | undefined;
  messageText: string;
}): Promise<{ delta: number; newScore: number; signals: string[] } | null> {
  const { db, leadId, messageText } = params;

  if (!leadId || !messageText.trim()) return null;

  try {
    const text = messageText.toLowerCase();
    let rawDelta = 0;
    const signals: string[] = [];

    for (const rule of RULES) {
      if (rule.pattern.test(text)) {
        rawDelta += rule.delta;
        signals.push(rule.label);
      }
    }

    // No signal matched — skip the Firestore write
    if (signals.length === 0) return null;

    // Clamp the per-message delta
    const delta = Math.max(MIN_DELTA, Math.min(MAX_DELTA, rawDelta));

    // Atomic read + write via transaction so concurrent messages don't collide
    const leadRef = db.collection('leads').doc(leadId);
    let newScore = 0;
    let statusUpdate: LeadStatus | null = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(leadRef);
      if (!snap.exists) throw new Error('lead_not_found');

      const data = snap.data()!;
      const currentScore: number = typeof data.score === 'number' ? data.score : 0;
      const currentStatus: LeadStatus = data.status ?? 'new';

      newScore = Math.max(0, Math.min(100, currentScore + delta));
      statusUpdate = inferStatus(newScore);

      const updates: Record<string, unknown> = {
        score: newScore,
        updatedAt: new Date().toISOString(),
      };

      // Only auto-update status when still in early stages
      if (statusUpdate && AUTO_STATUSES.includes(currentStatus)) {
        updates.status = statusUpdate;
      }

      tx.update(leadRef, updates);
    });

    return { delta, newScore, signals };
  } catch {
    // Non-fatal — classification must never break the webhook
    return null;
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function getLeadHeat(score?: number): 'hot' | 'warm' | 'cold' | 'unknown' {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 70) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}
