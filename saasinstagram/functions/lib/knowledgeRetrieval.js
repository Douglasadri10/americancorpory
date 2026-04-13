"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveKnowledgeContext = resolveKnowledgeContext;
const functions = __importStar(require("firebase-functions"));
const openai_1 = __importDefault(require("openai"));
const COLLECTION = 'knowledgeBlocks';
const SIMILARITY_THRESHOLD = 0.75;
function cosineSimilarity(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
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
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
async function resolveKnowledgeContext(db, workspaceId, messageText, maxBlocks = 2) {
    try {
        const snap = await db
            .collection(COLLECTION)
            .where('workspaceId', '==', workspaceId)
            .where('isActive', '==', true)
            .get();
        if (snap.empty)
            return '';
        const blocks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const normalized = normalizeText(messageText);
        // Layer 1: keyword match
        const keywordMatches = blocks.filter((block) => block.triggers.some((trigger) => normalized.includes(normalizeText(trigger))));
        let selected = [];
        if (keywordMatches.length > 0) {
            selected = keywordMatches.sort((a, b) => a.priority - b.priority).slice(0, maxBlocks);
        }
        else {
            // Layer 2: embedding similarity
            const blocksWithEmbeddings = blocks.filter((b) => b.embedding && b.embedding.length > 0);
            if (blocksWithEmbeddings.length > 0) {
                const apiKey = functions.config().openai?.api_key ?? process.env.OPENAI_API_KEY;
                const openai = new openai_1.default({ apiKey });
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
        if (selected.length === 0)
            return '';
        return selected.map((b) => `### ${b.name}\n${b.content}`).join('\n\n');
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=knowledgeRetrieval.js.map