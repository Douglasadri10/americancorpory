export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import { getTokens, deleteGoogleEvent } from '@/services/googleCalendarService';
import type { Appointment } from '@/types/appointment';

const COLLECTION = 'appointments';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'appointment_not_found' ? 404 :
    message === 'workspace_not_found' ? 404 :
    message === 'workspace_forbidden' || message === 'appointment_forbidden' ? 403 :
    500;
  return NextResponse.json({ error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') }, { status });
}

async function getOwnedAppointment(
  db: ReturnType<typeof getAdminFirestore>,
  appointmentId: string,
  uid: string
) {
  const snap = await db.collection(COLLECTION).doc(appointmentId).get();
  if (!snap.exists) throw new Error('appointment_not_found');

  const data = snap.data() as Appointment;
  await getOwnedWorkspace(db, data.workspaceId, uid);

  return { snap, data };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<Appointment>;
  try { body = await request.json() as Partial<Appointment>; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const db = getAdminFirestore();
    await getOwnedAppointment(db, params.id, decoded.uid);

    const allowed: (keyof Appointment)[] = [
      'title', 'description', 'date', 'startTime', 'endTime',
      'status', 'leadId', 'leadName', 'conversationId', 'contactName',
      'channel', 'notes', 'bookedByAI',
    ];

    const updates: Partial<Appointment> & { updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };
    for (const key of allowed) {
      if (body[key] !== undefined) {
        (updates as Record<string, unknown>)[key] = body[key];
      }
    }

    // Recalculate duration if times changed
    if (updates.startTime || updates.endTime) {
      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0); };
      const snap = await db.collection(COLLECTION).doc(params.id).get();
      const current = snap.data() as Appointment;
      const start = updates.startTime ?? current.startTime;
      const end = updates.endTime ?? current.endTime;
      updates.durationMinutes = toMins(end) - toMins(start);
    }

    await db.collection(COLLECTION).doc(params.id).update(updates as Record<string, unknown>);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errResponse(err);
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
    await getOwnedAppointment(db, params.id, decoded.uid);

    const { data: appt } = await getOwnedAppointment(db, params.id, decoded.uid);

    // Soft delete — mark as cancelled
    await db.collection(COLLECTION).doc(params.id).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    // Remove from Google Calendar (fire-and-forget)
    if (appt.googleEventId) {
      void getTokens(db, appt.workspaceId).then(async (tokens) => {
        if (!tokens || !appt.googleEventId) return;
        await deleteGoogleEvent(tokens, appt.googleEventId);
      }).catch(() => null);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errResponse(err);
  }
}
