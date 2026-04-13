import type { Firestore } from 'firebase-admin/firestore';
import { getOpenAIClient } from '@/lib/openai/client';
import type { KnowledgeBlock } from '@/types/knowledge';

const KNOWLEDGE_BLOCKS_COLLECTION = 'knowledgeBlocks';
const SIMILARITY_THRESHOLD = 0.60;

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

export async function computeEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
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
          const embedding = await computeEmbedding(block.content);
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
    messageEmbedding = await computeEmbedding(messageText);
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

// Max chars per block injected into the system prompt.
// Blocks stored before the 20k limit was enforced may be larger — truncate defensively.
const MAX_CONTENT_IN_PROMPT = 20000;

export function formatKnowledgeContext(blocks: KnowledgeBlock[]): string {
  if (blocks.length === 0) return '';
  return blocks
    .map((b) => {
      const content = b.content.length > MAX_CONTENT_IN_PROMPT
        ? b.content.slice(0, MAX_CONTENT_IN_PROMPT) + '\n[...]'
        : b.content;
      return `### ${b.name}\n${content}`;
    })
    .join('\n\n');
}
