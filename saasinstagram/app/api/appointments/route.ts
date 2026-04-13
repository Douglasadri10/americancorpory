export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import { getTokens, createGoogleEvent } from '@/services/googleCalendarService';
import { parseBody, appointmentSchema } from '@/lib/security/validation';
import type { Appointment } from '@/types/appointment';

const COLLECTION = 'appointments';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal error';
  const status =
    message === 'workspace_not_found' ? 404 :
    message === 'workspace_forbidden' ? 403 :
    500;
  return NextResponse.json({ error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') }, { status });
}

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get('workspaceId');
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    const snap = await db
      .collection(COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    let appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);
    if (dateFrom) appointments = appointments.filter((a) => a.date >= dateFrom);
    if (dateTo) appointments = appointments.filter((a) => a.date <= dateTo);

    appointments = appointments
      .filter((a) => a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    return NextResponse.json({ appointments });
  } catch (err) {
    return errResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: validationError } = await parseBody(request, appointmentSchema);
  if (validationError) return validationError;

  const { workspaceId, title, date, startTime, endTime } = body;

  try {
    const db = getAdminFirestore();
    await getOwnedWorkspace(db, workspaceId, decoded.uid);

    // Check for conflicts
    const existingSnap = await db
      .collection(COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .where('date', '==', date)
      .get();

    const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0); };
    const reqStart = toMins(startTime);
    const reqEnd = toMins(endTime);

    const conflicts = existingSnap.docs
      .map((d) => d.data() as Appointment)
      .filter((a) => a.status !== 'cancelled')
      .filter((a) => reqStart < toMins(a.endTime) && reqEnd > toMins(a.startTime));

    if (conflicts.length > 0) {
      return NextResponse.json({ error: 'time_slot_unavailable', conflicts }, { status: 409 });
    }

    const ref = db.collection(COLLECTION).doc();
    const now = new Date().toISOString();
    const durationMinutes = reqEnd - reqStart;
    const appointment: Appointment = {
      id: ref.id,
      workspaceId,
      title: title.trim(),
      description: body.description?.trim() || undefined,
      date,
      startTime,
      endTime,
      durationMinutes,
      status: body.status ?? 'booked',
      leadId: body.leadId,
      leadName: body.leadName,
      conversationId: body.conversationId,
      contactName: body.contactName,
      channel: body.channel,
      bookedByAI: body.bookedByAI ?? false,
      notes: body.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(appointment);

    // Sync to Google Calendar (fire-and-forget)
    void getTokens(db, workspaceId).then(async (tokens) => {
      if (!tokens) return;
      const googleEventId = await createGoogleEvent(tokens, appointment);
      if (googleEventId) {
        await ref.update({ googleEventId });
      }
    }).catch(() => null);

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    return errResponse(err);
  }
}
