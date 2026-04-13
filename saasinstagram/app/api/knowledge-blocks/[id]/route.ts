export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { computeEmbedding } from '@/lib/knowledge/retrieval';
import type { KnowledgeBlock } from '@/types/knowledge';

const COLLECTION = 'knowledgeBlocks';

async function getOwnedBlock(db: ReturnType<typeof getAdminFirestore>, blockId: string, uid: string) {
  const snap = await db.collection(COLLECTION).doc(blockId).get();
  if (!snap.exists) throw new Error('block_not_found');

  const block = snap.data() as KnowledgeBlock;
  const workspaceSnap = await db.collection('workspaces').doc(block.workspaceId).get();
  if (!workspaceSnap.exists || workspaceSnap.data()?.ownerUid !== uid) {
    throw new Error('block_forbidden');
  }

  return { snap, block };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<KnowledgeBlock>;
  try {
    body = await request.json() as Partial<KnowledgeBlock>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const { block } = await getOwnedBlock(db, params.id, decoded.uid);

    const updates: Partial<KnowledgeBlock> = { updatedAt: new Date().toISOString() };

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      if (trimmedName.length > 200) {
        return NextResponse.json({ error: 'name deve ter no máximo 200 caracteres' }, { status: 400 });
      }
      updates.name = trimmedName;
    }
    if (body.category !== undefined) updates.category = body.category?.trim() || undefined;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.triggers !== undefined) {
      updates.triggers = body.triggers.map((t) => t.toLowerCase().trim()).filter(Boolean);
    }

    // Recompute embedding if content changed OR explicitly requested
    const shouldRecomputeEmbedding =
      (body.content !== undefined && body.content.trim() !== block.content) ||
      (body as Record<string, unknown>).regenerateEmbedding === true;

    if (shouldRecomputeEmbedding) {
      if (body.content !== undefined) {
        const trimmedContent = body.content.trim();
        if (trimmedContent.length > 20000) {
          return NextResponse.json({ error: 'content deve ter no máximo 20.000 caracteres' }, { status: 400 });
        }
        updates.content = trimmedContent;
      }
      const textForEmbedding = updates.content ?? block.content;
      try {
        updates.embedding = await computeEmbedding(textForEmbedding);
      } catch {
        // Non-fatal
      }
    }

    await db.collection(COLLECTION).doc(params.id).update(updates as Record<string, unknown>);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'block_not_found' ? 404 : message === 'block_forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminFirestore();
    await getOwnedBlock(db, params.id, decoded.uid);
    await db.collection(COLLECTION).doc(params.id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message === 'block_not_found' ? 404 : message === 'block_forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
