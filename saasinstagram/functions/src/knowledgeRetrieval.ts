import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import OpenAI from 'openai';

const COLLECTION = 'knowledgeBlocks';
const SIMILARITY_THRESHOLD = 0.75;

interface KnowledgeBlock {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  triggers: string[];
  embedding: number[];
  isActive: boolean;
  priority: number;
}

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function resolveKnowledgeContext(
  db: admin.firestore.Firestore,
  workspaceId: string,
  messageText: string,
  maxBlocks = 2
): Promise<string> {
  try {
    const snap = await db
      .collection(COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .where('isActive', '==', true)
      .get();

    if (snap.empty) return '';

    const blocks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as KnowledgeBlock);
    const normalized = normalizeText(messageText);

    // Layer 1: keyword match
    const keywordMatches = blocks.filter((block) =>
      block.triggers.some((trigger) => normalized.includes(normalizeText(trigger)))
    );

    let selected: KnowledgeBlock[] = [];

    if (keywordMatches.length > 0) {
      selected = keywordMatches.sort((a, b) => a.priority - b.priority).slice(0, maxBlocks);
    } else {
      // Layer 2: embedding similarity
      const blocksWithEmbeddings = blocks.filter((b) => b.embedding && b.embedding.length > 0);
      if (blocksWithEmbeddings.length > 0) {
        const apiKey = functions.config().openai?.api_key ?? process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey });
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: messageText,
        });
        const msgEmbedding = response.data[0].embedding;

        const scored = blocksWithEmbeddings
          .map((block) => ({ block, score: cosineSimilarity(msgEmbedding, block.embedding) }))
          .filter((item) => item.score >= SIMILARITY_THRESHOLD)
          .sort((a, b) => b.score - a.score || a.block.priority - b.block.priority);

        selected = scored.slice(0, maxBlocks).map((item) => item.block);
      }
    }

    if (selected.length === 0) return '';
    return selected.map((b) => `### ${b.name}\n${b.content}`).join('\n\n');
  } catch {
    return '';
  }
}
