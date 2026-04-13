import { google, calendar_v3 } from 'googleapis';
import type { Firestore } from 'firebase-admin/firestore';
import type { Appointment } from '@/types/appointment';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface GoogleCalendarTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  calendarId: string; // which calendar to use (usually 'primary')
  connectedEmail: string;
  connectedAt: string;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

export function buildGoogleAuthUrl(workspaceId: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token every time
    scope: SCOPES,
    state: workspaceId,
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ tokens: GoogleCalendarTokens; email: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get the connected user's email
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email ?? 'unknown';

  return {
    tokens: {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      calendarId: 'primary',
      connectedEmail: email,
      connectedAt: new Date().toISOString(),
    },
    email,
  };
}

async function getCalendarClient(tokens: GoogleCalendarTokens): Promise<calendar_v3.Calendar> {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function saveTokens(
  db: Firestore,
  workspaceId: string,
  tokens: GoogleCalendarTokens
): Promise<void> {
  await db.collection('workspaces').doc(workspaceId).update({
    'integrations.googleCalendar': tokens,
    updatedAt: new Date().toISOString(),
  });
}

export async function getTokens(
  db: Firestore,
  workspaceId: string
): Promise<GoogleCalendarTokens | null> {
  const snap = await db.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return (data?.integrations?.googleCalendar as GoogleCalendarTokens) ?? null;
}

export async function disconnectGoogleCalendar(
  db: Firestore,
  workspaceId: string
): Promise<void> {
  await db.collection('workspaces').doc(workspaceId).update({
    'integrations.googleCalendar': null,
    updatedAt: new Date().toISOString(),
  });
}

/** Create a Google Calendar event from an HannaAI appointment */
export async function createGoogleEvent(
  tokens: GoogleCalendarTokens,
  appointment: Appointment
): Promise<string | null> {
  try {
    const calendar = await getCalendarClient(tokens);
    const event = await calendar.events.insert({
      calendarId: tokens.calendarId,
      requestBody: {
        summary: appointment.title,
        description: [
          appointment.description,
          appointment.contactName ? `Cliente: ${appointment.contactName}` : '',
          appointment.notes,
          appointment.bookedByAI ? 'Agendado por IA — HannaAI' : 'HannaAI',
        ]
          .filter(Boolean)
          .join('\n'),
        start: {
          dateTime: `${appointment.date}T${appointment.startTime}:00`,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: `${appointment.date}T${appointment.endTime}:00`,
          timeZone: 'America/Sao_Paulo',
        },
        attendees: appointment.contactName
          ? [{ displayName: appointment.contactName }]
          : undefined,
        extendedProperties: {
          private: {
            omnichatId: appointment.id,
            workspaceId: appointment.workspaceId,
          },
        },
      },
    });
    return event.data.id ?? null;
  } catch {
    return null;
  }
}

/** Delete a Google Calendar event by its event ID */
export async function deleteGoogleEvent(
  tokens: GoogleCalendarTokens,
  googleEventId: string
): Promise<void> {
  try {
    const calendar = await getCalendarClient(tokens);
    await calendar.events.delete({
      calendarId: tokens.calendarId,
      eventId: googleEventId,
    });
  } catch {
    // Ignore if event was already deleted
  }
}

/** Check free/busy for a time range — returns true if the slot is free */
export async function checkFreeBusy(
  tokens: GoogleCalendarTokens,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ free: boolean; conflicts: { start: string; end: string }[] }> {
  try {
    const calendar = await getCalendarClient(tokens);
    const timeMin = new Date(`${date}T${startTime}:00`).toISOString();
    const timeMax = new Date(`${date}T${endTime}:00`).toISOString();

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'America/Sao_Paulo',
        items: [{ id: tokens.calendarId }],
      },
    });

    const busy = res.data.calendars?.[tokens.calendarId]?.busy ?? [];
    const conflicts = busy.map((b) => ({ start: b.start ?? '', end: b.end ?? '' }));
    return { free: conflicts.length === 0, conflicts };
  } catch {
    return { free: true, conflicts: [] }; // fail open
  }
}

/** Fetch all events from Google Calendar for a date range */
export async function getCalendarEvents(
  tokens: GoogleCalendarTokens,
  dateFrom: string,
  dateTo: string
): Promise<{ id: string; title: string; start: string; end: string; allDay: boolean; color?: string }[]> {
  try {
    const calendar = await getCalendarClient(tokens);
    const timeMin = new Date(`${dateFrom}T00:00:00`).toISOString();
    const timeMax = new Date(`${dateTo}T23:59:59`).toISOString();

    const res = await calendar.events.list({
      calendarId: tokens.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    return (res.data.items ?? []).map((event) => {
      const allDay = !event.start?.dateTime;
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        : '00:00';
      const end = event.end?.dateTime
        ? new Date(event.end.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        : '23:59';
      const date = allDay
        ? (event.start?.date ?? dateFrom)
        : new Date(event.start?.dateTime ?? '').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-').replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) => `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);

      return {
        id: event.id ?? '',
        title: event.summary ?? '(sem título)',
        start,
        end,
        allDay,
        date,
        color: event.colorId ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

/** Get busy slots for a full day from Google Calendar */
export async function getDayBusySlots(
  tokens: GoogleCalendarTokens,
  date: string
): Promise<{ start: string; end: string }[]> {
  try {
    const calendar = await getCalendarClient(tokens);
    const timeMin = new Date(`${date}T00:00:00`).toISOString();
    const timeMax = new Date(`${date}T23:59:59`).toISOString();

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'America/Sao_Paulo',
        items: [{ id: tokens.calendarId }],
      },
    });

    return (res.data.calendars?.[tokens.calendarId]?.busy ?? []).map((b) => ({
      start: b.start ?? '',
      end: b.end ?? '',
    }));
  } catch {
    return [];
  }
}
