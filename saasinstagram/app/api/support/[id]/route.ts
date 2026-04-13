export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { SupportTicket, SupportTicketStatus } from '@/types/support';

const VALID_STATUSES: SupportTicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

async function getTicketForUser(
  db: ReturnType<typeof getAdminFirestore>,
  ticketId: string,
  uid: string
): Promise<{ ref: FirebaseFirestore.DocumentReference; ticket: SupportTicket }> {
  const ref = db.collection('support_tickets').doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('ticket_not_found');

  const ticket = { id: snap.id, ...snap.data() } as SupportTicket;
  await getOwnedWorkspace(db, ticket.workspaceId, uid);
  return { ref, ticket };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminFirestore();
    const { ticket } = await getTicketForUser(db, params.id, decoded.uid);
    return NextResponse.json({ ticket });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    if (msg === 'ticket_not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('support/[id] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/support/[id] — add a message to the thread
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { text: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const trimmedText = body.text?.trim() ?? '';
  if (!trimmedText) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (trimmedText.length > 5000) {
    return NextResponse.json({ error: 'message deve ter no máximo 5.000 caracteres' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const { ref, ticket } = await getTicketForUser(db, params.id, decoded.uid);

    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'Ticket is closed' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newMessage = {
      id: `${params.id}_${ticket.messages.length}`,
      text: trimmedText,
      senderType: 'user' as const,
      senderName: decoded.name ?? decoded.email ?? 'User',
      createdAt: now,
    };

    const updatedMessages = [...ticket.messages, newMessage];
    await ref.update({ messages: updatedMessages, updatedAt: now, status: 'open' });

    return NextResponse.json({ message: newMessage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    if (msg === 'ticket_not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('support/[id] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/support/[id] — update status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { status: SupportTicketStatus };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'status inválido' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const { ref } = await getTicketForUser(db, params.id, decoded.uid);

    const now = new Date().toISOString();
    await ref.update({
      status: body.status,
      updatedAt: now,
      ...(body.status === 'resolved' ? { resolvedAt: now } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    if (msg === 'ticket_not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('support/[id] PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
