import type { Firestore } from 'firebase-admin/firestore';
import type { Workspace } from '@/types/workspace';
import type { Appointment } from '@/types/appointment';
import { getTokens, getDayBusySlots } from '@/services/googleCalendarService';

const SCHEDULE_KEYWORDS = [
  // Portuguese
  'agendar', 'agendamento', 'agenda', 'marcar', 'marcação', 'horário', 'horarios',
  'disponível', 'disponivel', 'disponibilidade', 'quando', 'reunião', 'reuniao',
  'consulta', 'visita', 'atendimento', 'appointment', 'reservar', 'reserva',
  // English
  'schedule', 'booking', 'book', 'available', 'slot', 'meeting', 'appointment', 'when',
];

function hasScheduleIntent(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SCHEDULE_KEYWORDS.some((kw) =>
    lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function fromMins(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWorkingDays(fromDate: Date, count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(fromDate);
  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildScheduleContext(params: {
  db: Firestore;
  workspaceId: string;
  messageText: string;
  workspace?: Workspace | null;
}): Promise<string> {
  const { db, workspaceId, messageText, workspace } = params;

  if (!hasScheduleIntent(messageText)) return '';

  try {
    const settings = workspace?.settings;
    const bh = settings?.businessHours;

    // Look ahead 5 working days
    const workingDays = getWorkingDays(new Date(), 5);

    // Fetch appointments for those days (Firestore)
    const dateFrom = formatDate(workingDays[0]);
    const dateTo = formatDate(workingDays[workingDays.length - 1]);

    const snap = await db
      .collection('appointments')
      .where('workspaceId', '==', workspaceId)
      .where('date', '>=', dateFrom)
      .where('date', '<=', dateTo)
      .get();

    const booked = snap.docs
      .map((d) => d.data() as Appointment)
      .filter((a) => a.status !== 'cancelled');

    // Fetch Google Calendar busy slots if integration is connected
    const googleTokens = await getTokens(db, workspaceId).catch(() => null);

    const lines: string[] = [];

    for (const day of workingDays) {
      const dateStr = formatDate(day);
      const dow = day.getDay();
      const dayKey = DAY_KEYS[dow];
      const dayLabel = DAY_SHORT_PT[dow];
      const displayDate = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      // Determine open/close for this day
      let openMins = toMins('09:00');
      let closeMins = toMins('18:00');
      let dayEnabled = true;

      if (bh?.enabled && bh.schedule?.[dayKey]) {
        const daySched = bh.schedule[dayKey];
        if (!daySched.enabled) { dayEnabled = false; }
        else {
          openMins = toMins(daySched.open);
          closeMins = toMins(daySched.close);
        }
      }

      if (!dayEnabled) continue;

      // Get Google Calendar busy slots for this day
      const googleBusy = googleTokens
        ? await getDayBusySlots(googleTokens, dateStr).catch(() => [])
        : [];

      const dayBooked = booked.filter((a) => a.date === dateStr);
      const slots: string[] = [];
      let cursor = openMins;

      while (cursor + 60 <= closeMins) {
        const slotEnd = cursor + 60;

        // Check Firestore appointments
        const blockedByFirestore = dayBooked.some(
          (a) => cursor < toMins(a.endTime) && slotEnd > toMins(a.startTime)
        );

        // Check Google Calendar busy times
        const blockedByGoogle = googleBusy.some((b) => {
          const bStart = toMins(b.start.slice(11, 16)); // extract HH:MM from ISO
          const bEnd = toMins(b.end.slice(11, 16));
          return cursor < bEnd && slotEnd > bStart;
        });

        if (!blockedByFirestore && !blockedByGoogle) slots.push(fromMins(cursor));
        cursor += 60;
      }

      if (slots.length > 0) {
        lines.push(`- ${dayLabel} ${displayDate}: ${slots.join(', ')}`);
      }
    }

    if (lines.length === 0) return '';

    return `### Horários disponíveis para agendamento\n${lines.join('\n')}\n\nQuando o cliente solicitar um horário específico, verifique se está na lista acima antes de confirmar. Nunca confirme um horário que não esteja listado.`;
  } catch {
    return '';
  }
}
