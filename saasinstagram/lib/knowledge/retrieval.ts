import type { Firestore } from 'firebase-admin/firestore';
import { getOpenAIClient } from '@/lib/openai/client';
import { trackAIUsage, type AIUsageContext } from '@/lib/openai/usage';
import type { KnowledgeBlock } from '@/types/knowledge';

const KNOWLEDGE_BLOCKS_COLLECTION = 'knowledgeBlocks';
const SIMILARITY_THRESHOLD = 0.70;
const KNOWLEDGE_TOTAL_CHAR_BUDGET = 4000;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function computeEmbedding(
  text: string,
  usageContext?: AIUsageContext
): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  if (usageContext) {
    await trackAIUsage({
      context: usageContext,
      model: 'text-embedding-3-small',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: 0,
    }).catch(() => null);
  }

  return response.data[0].embedding;
}

export async function resolveKnowledgeBlocks(params: {
  db: Firestore;
  workspaceId: string;
  messageText: string;
  maxBlocks?: number;
}): Promise<KnowledgeBlock[]> {
  const { db, workspaceId, messageText, maxBlocks = 2 } = params;

  const snap = await db
    .collection(KNOWLEDGE_BLOCKS_COLLECTION)
    .where('workspaceId', '==', workspaceId)
    .where('isActive', '==', true)
    .get();

  if (snap.empty) return [];

  const blocks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as KnowledgeBlock);
  const normalized = normalizeText(messageText);

  // Layer 1: keyword match
  const keywordMatches = blocks.filter((block) =>
    block.triggers.some((trigger) => normalized.includes(normalizeText(trigger)))
  );

  if (keywordMatches.length > 0) {
    return keywordMatches
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxBlocks);
  }

  // Layer 2: embedding similarity
  // Lazily generate and store embeddings for blocks that are missing them
  const blocksNeedingEmbedding = blocks.filter((b) => !b.embedding || b.embedding.length === 0);
  if (blocksNeedingEmbedding.length > 0) {
    await Promise.allSettled(
      blocksNeedingEmbedding.map(async (block) => {
        try {
          const embedding = await computeEmbedding(block.content, {
            db,
            workspaceId,
            source: 'knowledge_embedding',
            metadata: {
              knowledgeBlockId: block.id,
              stage: 'block_seed',
            },
          });
          block.embedding = embedding;
          await db.collection(KNOWLEDGE_BLOCKS_COLLECTION).doc(block.id).update({ embedding });
        } catch {
          // Non-fatal
        }
      })
    );
  }

  const blocksWithEmbeddings = blocks.filter((b) => b.embedding && b.embedding.length > 0);
  if (blocksWithEmbeddings.length === 0) return [];

  let messageEmbedding: number[];
  try {
    messageEmbedding = await computeEmbedding(messageText, {
      db,
      workspaceId,
      source: 'knowledge_embedding',
      metadata: {
        stage: 'message_query',
      },
    });
  } catch {
    return [];
  }

  const scored = blocksWithEmbeddings
    .map((block) => ({
      block,
      score: cosineSimilarity(messageEmbedding, block.embedding),
    }))
    .sort((a, b) => b.score - a.score || a.block.priority - b.block.priority);

  const aboveThreshold = scored.filter((item) => item.score >= SIMILARITY_THRESHOLD);

  // Fallback: if nothing meets threshold, return top-scoring blocks anyway
  const candidates = aboveThreshold.length > 0 ? aboveThreshold : scored;

  return candidates.slice(0, maxBlocks).map((item) => item.block);
}

export function formatKnowledgeContext(blocks: KnowledgeBlock[]): string {
  if (blocks.length === 0) return '';

  const conflictHeader =
    blocks.length > 1
      ? 'If sections below conflict on the same topic, trust the lower-numbered section.\n\n'
      : '';

  let budget = KNOWLEDGE_TOTAL_CHAR_BUDGET;
  const parts: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    if (budget <= 0) break;
    const header = `### Section ${i + 1}: ${blocks[i].name}\n`;
    const available = budget - header.length;
    if (available <= 0) break;
    const content =
      blocks[i].content.length > available
        ? blocks[i].content.slice(0, available) + '\n[…truncated]'
        : blocks[i].content;
    parts.push(header + content);
    budget -= header.length + content.length;
  }

  return conflictHeader + parts.join('\n\n');
}
