export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { SupportTicket, SupportTicketCategory, SupportTicketPriority } from '@/types/support';

const VALID_CATEGORIES: SupportTicketCategory[] = ['billing', 'technical', 'feature_request', 'general'];
const VALID_PRIORITIES: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10), 100);
  const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10), 0);

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    // No orderBy — avoids requiring a Firestore composite index.
    // Sort in memory (support tickets per workspace are few).
    const snap = await db
      .collection('support_tickets')
      .where('workspaceId', '==', workspaceId)
      .get();

    const tickets = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SupportTicket)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);

    return NextResponse.json({ tickets, limit, offset });
  } catch (err) {
    console.error('support GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    workspaceId: string;
    subject: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    message: string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workspaceId, subject, category, priority, message } = body;

  if (!workspaceId || !subject || !category || !priority || !message) {
    return NextResponse.json({ error: 'workspaceId, subject, category, priority, message are required' }, { status: 400 });
  }

  if (subject.trim().length > 200) {
    return NextResponse.json({ error: 'subject deve ter no máximo 200 caracteres' }, { status: 400 });
  }

  if (message.trim().length > 5000) {
    return NextResponse.json({ error: 'message deve ter no máximo 5.000 caracteres' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'category inválida' }, { status: 400 });
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'priority inválida' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const now = new Date().toISOString();
    const docRef = db.collection('support_tickets').doc();

    const ticket: SupportTicket = {
      id: docRef.id,
      workspaceId,
      userId: decoded.uid,
      userEmail: decoded.email ?? '',
      userName: decoded.name ?? decoded.email ?? 'User',
      subject: subject.trim(),
      category,
      priority,
      status: 'open',
      messages: [
        {
          id: `${docRef.id}_0`,
          text: message.trim(),
          senderType: 'user',
          senderName: decoded.name ?? decoded.email ?? 'User',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(ticket);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error('support POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
