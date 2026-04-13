export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getOwnedWorkspace } from '@/lib/workspaces/access';
import type { Appointment } from '@/types/appointment';
import type { WorkspaceSettings } from '@/types/workspace';

const COLLECTION = 'appointments';

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function fromMins(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export async function GET(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get('workspaceId');
  const date = searchParams.get('date');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const durationParam = searchParams.get('duration');

  if (!workspaceId || !date) {
    return NextResponse.json({ error: 'workspaceId and date required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const wsSnap = await getOwnedWorkspace(db, workspaceId, decoded.uid);
    const settings = wsSnap.data()?.settings as WorkspaceSettings | undefined;

    // Get all non-cancelled appointments for the day
    const snap = await db
      .collection(COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .where('date', '==', date)
      .get();

    const booked = snap.docs
      .map((d) => d.data() as Appointment)
      .filter((a) => a.status !== 'cancelled');

    // Mode 1: check specific slot
    if (startTime && endTime) {
      const reqStart = toMins(startTime);
      const reqEnd = toMins(endTime);
      const conflicts = booked.filter((a) => reqStart < toMins(a.endTime) && reqEnd > toMins(a.startTime));
      return NextResponse.json({ available: conflicts.length === 0, conflicts });
    }

    // Mode 2: list available slots for given duration
    const duration = durationParam ? parseInt(durationParam, 10) : 60;

    const bh = settings?.businessHours;
    const dayKey = DAY_KEYS[new Date(`${date}T12:00:00`).getDay()];

    let openMins = toMins('09:00');
    let closeMins = toMins('18:00');

    if (bh?.enabled && bh.schedule?.[dayKey]) {
      const day = bh.schedule[dayKey];
      if (!day.enabled) {
        return NextResponse.json({ slots: [] });
      }
      openMins = toMins(day.open);
      closeMins = toMins(day.close);
    }

    const slots: { startTime: string; endTime: string }[] = [];
    let cursor = openMins;

    while (cursor + duration <= closeMins) {
      const slotEnd = cursor + duration;
      const blocked = booked.some((a) => cursor < toMins(a.endTime) && slotEnd > toMins(a.startTime));
      if (!blocked) {
        slots.push({ startTime: fromMins(cursor), endTime: fromMins(slotEnd) });
      }
      cursor += 60;
    }

    return NextResponse.json({ slots });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'workspace_not_found' ? 404 : message === 'workspace_forbidden' ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? 'Internal error' : message.replaceAll('_', ' ') }, { status });
  }
}
