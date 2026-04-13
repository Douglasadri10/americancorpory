import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { Appointment, AppointmentStatus, TimeSlot } from '@/types/appointment';
import type { WorkspaceSettings } from '@/types/workspace';

const APPOINTMENTS_COLLECTION = 'appointments';

// Parse "HH:MM" to total minutes since midnight
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

// Format total minutes back to "HH:MM"
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Map JS day index (0=Sun) to business hours key
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export class AppointmentService {
  constructor(private db: Firestore) {}

  async getAppointments(
    workspaceId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Appointment[]> {
    const q = query(
      collection(this.db, APPOINTMENTS_COLLECTION),
      where('workspaceId', '==', workspaceId)
    );
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);

    if (dateFrom) items = items.filter((a) => a.date >= dateFrom);
    if (dateTo) items = items.filter((a) => a.date <= dateTo);

    return items
      .filter((a) => a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const snap = await getDoc(doc(this.db, APPOINTMENTS_COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Appointment;
  }

  async createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
    const id = doc(collection(this.db, APPOINTMENTS_COLLECTION)).id;
    const appointment: Appointment = { ...data, id };
    await setDoc(doc(this.db, APPOINTMENTS_COLLECTION, id), appointment);
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<void> {
    await updateDoc(doc(this.db, APPOINTMENTS_COLLECTION, id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async cancelAppointment(id: string): Promise<void> {
    await updateDoc(doc(this.db, APPOINTMENTS_COLLECTION, id), {
      status: 'cancelled' as AppointmentStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  async checkAvailability(
    workspaceId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<{ available: boolean; conflicts: Appointment[] }> {
    const appointments = await this.getAppointments(workspaceId, date, date);
    const reqStart = toMinutes(startTime);
    const reqEnd = toMinutes(endTime);

    const conflicts = appointments.filter((a) => {
      if (a.status === 'cancelled') return false;
      const aStart = toMinutes(a.startTime);
      const aEnd = toMinutes(a.endTime);
      // Overlaps if ranges intersect
      return reqStart < aEnd && reqEnd > aStart;
    });

    return { available: conflicts.length === 0, conflicts };
  }

  async getAvailableSlotsForDay(
    workspaceId: string,
    date: string,
    durationMinutes: number,
    settings?: WorkspaceSettings
  ): Promise<TimeSlot[]> {
    // Determine day-of-week open/close from business hours
    const dateObj = new Date(`${date}T12:00:00`);
    const dayKey = DAY_KEYS[dateObj.getDay()];
    const bh = settings?.businessHours;

    let dayOpen = '09:00';
    let dayClose = '18:00';

    if (bh?.enabled && bh.schedule?.[dayKey]) {
      const daySchedule = bh.schedule[dayKey];
      if (!daySchedule.enabled) return []; // closed that day
      dayOpen = daySchedule.open;
      dayClose = daySchedule.close;
    }

    const openMins = toMinutes(dayOpen);
    const closeMins = toMinutes(dayClose);

    // Get booked/blocked appointments for the day
    const booked = await this.getAppointments(workspaceId, date, date);

    const slots: TimeSlot[] = [];
    let cursor = openMins;

    while (cursor + durationMinutes <= closeMins) {
      const slotEnd = cursor + durationMinutes;
      const startStr = fromMinutes(cursor);
      const endStr = fromMinutes(slotEnd);

      // Check against existing appointments
      const blocked = booked.some((a) => {
        if (a.status === 'cancelled') return false;
        const aStart = toMinutes(a.startTime);
        const aEnd = toMinutes(a.endTime);
        return cursor < aEnd && slotEnd > aStart;
      });

      if (!blocked) {
        slots.push({ startTime: startStr, endTime: endStr });
      }

      cursor += 60; // 1-hour increments
    }

    return slots;
  }
}
