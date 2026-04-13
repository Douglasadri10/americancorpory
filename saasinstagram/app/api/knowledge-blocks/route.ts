export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import { computeEmbedding } from '@/lib/knowledge/retrieval';
import type { KnowledgeBlock } from '@/types/knowledge';

const COLLECTION = 'knowledgeBlocks';

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const snap = await db
      .collection(COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    const blocks = snap.docs
      .map((doc) => {
        const data = doc.data() as KnowledgeBlock;
        // Don't return embeddings to the client (large + not needed)
        const { embedding: _embedding, ...rest } = data;
        return { ...rest, hasEmbedding: Array.isArray(data.embedding) && data.embedding.length > 0 };
      })
      .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

    return NextResponse.json({ blocks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'workspace_not_found' ? 404 : message === 'workspace_forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<KnowledgeBlock>;
  try {
    body = await request.json() as Partial<KnowledgeBlock>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workspaceId, name, content, triggers, priority, category, isActive } = body;

  if (!workspaceId || !name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'workspaceId, name e content são obrigatórios' }, { status: 400 });
  }

  if (name.trim().length > 200) {
    return NextResponse.json({ error: 'name deve ter no máximo 200 caracteres' }, { status: 400 });
  }

  if (content.trim().length > 20000) {
    return NextResponse.json({ error: 'content deve ter no máximo 20.000 caracteres' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    // Compute embedding for the content
    let embedding: number[] = [];
    try {
      embedding = await computeEmbedding(content.trim());
    } catch {
      // Non-fatal: block works with keyword-only matching
    }

    const ref = db.collection(COLLECTION).doc();
    const now = new Date().toISOString();
    const block: KnowledgeBlock = {
      id: ref.id,
      workspaceId,
      name: name.trim(),
      content: content.trim(),
      triggers: (triggers ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      embedding,
      isActive: isActive ?? true,
      priority: priority ?? 10,
      category: category?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(block);

    const { embedding: _e, ...blockWithoutEmbedding } = block;
    return NextResponse.json({
      block: { ...blockWithoutEmbedding, hasEmbedding: embedding.length > 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'workspace_not_found' ? 404 : message === 'workspace_forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
