export type AppointmentStatus = 'available' | 'booked' | 'blocked' | 'cancelled';

export interface Appointment {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  date: string;           // "2026-04-10"
  startTime: string;      // "09:00"
  endTime: string;        // "10:00"
  durationMinutes: number;
  status: AppointmentStatus;
  // Booking context
  leadId?: string;
  leadName?: string;
  conversationId?: string;
  contactName?: string;
  channel?: string;
  bookedByAI: boolean;
  notes?: string;
  googleEventId?: string; // Google Calendar event ID (if synced)
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: AppointmentStatus | 'all';
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}
