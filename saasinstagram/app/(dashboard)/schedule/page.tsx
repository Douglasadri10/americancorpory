'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { Plus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useActiveWorkspaceId } from '@/hooks/useActiveWorkspace';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { toast } from 'sonner';
import type { Appointment } from '@/types/appointment';

const HOUR_START = 7;   // 07:00
const HOUR_END   = 21;  // 21:00
const TOTAL_HOURS = HOUR_END - HOUR_START;
const ROW_PX = 64; // px per hour

const DAYS_PT  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(d: Date): string { return d.toISOString().slice(0, 10); }

function getWeekDays(base: Date): Date[] {
  const dow = base.getDay();
  const mon = new Date(base);
  mon.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function topPercent(startTime: string): number {
  const mins = timeToMinutes(startTime) - HOUR_START * 60;
  return Math.max(0, (mins / (TOTAL_HOURS * 60)) * 100);
}

function heightPercent(startTime: string, endTime: string): number {
  const dur = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(2, (dur / (TOTAL_HOURS * 60)) * 100);
}

const STATUS_COLOR: Record<Appointment['status'], string> = {
  booked:    'bg-accent border-accent/60 text-white',
  available: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  blocked:   'bg-amber-50 border-amber-200 text-amber-700',
  cancelled: 'bg-red-50 border-red-200 text-red-400 opacity-50',
};

async function apiCall(path: string, options: RequestInit = {}) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? 'Erro na API');
  return data;
}

interface GoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  date: string;
  allDay: boolean;
}

export default function SchedulePage() {
  const workspaceId = useActiveWorkspaceId();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const weekDays = getWeekDays(currentWeek);
  const gridRef = useRef<HTMLDivElement>(null);

  // Current time
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [newNotes, setNewNotes] = useState('');
  const [newStatus, setNewStatus] = useState<Appointment['status']>('booked');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const dateFrom = formatDate(weekDays[0]);
      const dateTo   = formatDate(weekDays[6]);
      const [apptData, gcData] = await Promise.allSettled([
        apiCall(`/api/appointments?workspaceId=${workspaceId}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        apiCall(`/api/appointments/google-events?workspaceId=${workspaceId}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
      ]);
      if (apptData.status === 'fulfilled') setAppointments((apptData.value.appointments as Appointment[]) ?? []);
      if (gcData.status === 'fulfilled') setGoogleEvents((gcData.value.events as GoogleEvent[]) ?? []);
    } catch { toast.error('Erro ao carregar agenda'); }
    finally  { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, currentWeek]);

  useEffect(() => { void load(); }, [load]);

  // Scroll to ~8am on mount
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = ROW_PX * (8 - HOUR_START);
    }
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate || !newStart || !newEnd || !workspaceId) {
      toast.error('Preencha título, data e horários.'); return;
    }
    if (newStart >= newEnd) { toast.error('Início deve ser antes do término.'); return; }
    setSaving(true);
    try {
      await apiCall('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, title: newTitle, date: newDate, startTime: newStart, endTime: newEnd, notes: newNotes, status: newStatus, bookedByAI: false }),
      });
      toast.success('Compromisso criado!');
      setShowModal(false);
      setNewTitle(''); setNewDate(''); setNewStart('09:00'); setNewEnd('10:00'); setNewNotes('');
      void load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error(msg === 'time slot unavailable' ? 'Horário já ocupado.' : `Erro: ${msg}`);
    } finally { setSaving(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await apiCall(`/api/appointments/${id}`, { method: 'DELETE' });
      toast.success('Compromisso cancelado.');
      void load();
    } catch { toast.error('Erro ao cancelar.'); }
  };

  const byDate = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    (acc[a.date] ??= []).push(a); return acc;
  }, {});

  const gcByDate = googleEvents.reduce<Record<string, GoogleEvent[]>>((acc, e) => {
    if (e.date) (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  const today    = formatDate(new Date());
  const todayIdx = weekDays.findIndex((d) => formatDate(d) === today);
  const nowTop   = ((nowMinutes - HOUR_START * 60) / (TOTAL_HOURS * 60)) * 100;
  const isThisWeek = todayIdx !== -1;

  const inputClass = 'w-full bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent';

  // Month/year label for header
  const monthLabel = (() => {
    const first = weekDays[0];
    const last  = weekDays[6];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTHS_PT[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${MONTHS_PT[first.getMonth()]} – ${MONTHS_PT[last.getMonth()]} ${last.getFullYear()}`;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Agenda"
        subtitle={monthLabel}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowModal(true)}
            className="w-full justify-center sm:w-auto"
          >
            Novo compromisso
          </Button>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-border px-4 py-3 md:px-6">
        <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())} className="text-xs whitespace-nowrap">
          Hoje
        </Button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentWeek((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentWeek((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold capitalize text-text-primary">{monthLabel}</span>
      </div>

      {/* ── Calendar ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Mobile: Agenda view */}
        <div className="lg:hidden flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : (
              <>
                {weekDays.map((day) => {
                  const dateStr = formatDate(day);
                  const dayAppts = byDate[dateStr] ?? [];
                  const dayGoogleEvts = gcByDate[dateStr] ?? [];
                  const isToday = dateStr === today;
                  if (dayAppts.length === 0 && dayGoogleEvts.length === 0) return null;
                  return (
                    <div key={dateStr}>
                      <h3 className={clsx('text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2', isToday ? 'text-accent' : 'text-text-muted')}>
                        {DAYS_PT[day.getDay()]}, {day.getDate()} {MONTHS_PT[day.getMonth()]}
                        {isToday && <span className="text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full normal-case tracking-normal font-medium">Hoje</span>}
                      </h3>
                      <div className="space-y-2">
                        {[...dayAppts.map((a) => ({ ...a, _type: 'appt' as const })), ...dayGoogleEvts.map((e) => ({ ...e, _type: 'google' as const }))]
                          .sort((a, b) => (('startTime' in a ? a.startTime : a.start) ?? '').localeCompare(('startTime' in b ? b.startTime : b.start) ?? ''))
                          .map((item) => {
                            if (item._type === 'appt') {
                              const appt = item as Appointment & { _type: 'appt' };
                              return (
                                <div key={appt.id} className={clsx('rounded-xl border px-3 py-2.5 text-sm flex items-start justify-between gap-2', STATUS_COLOR[appt.status])}>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{appt.title}</p>
                                    {appt.contactName && <p className="text-xs opacity-75 mt-0.5 truncate">{appt.contactName}</p>}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs opacity-75 whitespace-nowrap">{appt.startTime}–{appt.endTime}</span>
                                    <button onClick={() => void handleCancel(appt.id)} className="p-1 rounded hover:bg-black/20" title="Cancelar">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            const evt = item as GoogleEvent & { _type: 'google' };
                            return (
                              <div key={`gc-${evt.id}`} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-blue-400 truncate">📅 {evt.title}</span>
                                  {!evt.allDay && <span className="text-xs text-blue-400/75 shrink-0">{evt.start?.slice(11, 16)}–{evt.end?.slice(11, 16)}</span>}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
                {weekDays.every((d) => {
                  const ds = formatDate(d);
                  return (byDate[ds]?.length ?? 0) === 0 && (gcByDate[ds]?.length ?? 0) === 0;
                }) && (
                  <div className="text-center py-16">
                    <p className="text-sm text-text-muted">Nenhum compromisso nesta semana</p>
                    <Button size="sm" className="mt-3" onClick={() => setShowModal(true)}>
                      Novo compromisso
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Desktop: Week grid */}
        <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto">
            <div className="flex min-h-full min-w-[720px] flex-col">
            {/* Day headers */}
            <div className="flex shrink-0 border-b border-border">
              <div className="w-14 shrink-0" />
              {weekDays.map((day) => {
                const isToday = formatDate(day) === today;
                return (
                  <div key={day.toISOString()} className="flex-1 border-l border-border py-2 text-center first:border-l-0">
                    <p className="text-xs uppercase tracking-wide text-text-muted">{DAYS_PT[day.getDay()]}</p>
                    <div className={clsx(
                      'mx-auto mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                      isToday ? 'bg-accent text-white' : 'text-text-primary'
                    )}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={gridRef} className="relative flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              ) : (
                <div className="flex" style={{ height: `${TOTAL_HOURS * ROW_PX}px` }}>
                  {/* Hour labels */}
                  <div className="relative w-14 shrink-0">
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div key={i} style={{ top: `${i * ROW_PX}px`, height: `${ROW_PX}px` }} className="absolute flex w-full items-start justify-end pr-2 pt-0.5">
                        <span className="text-[10px] text-text-muted tabular-nums">
                          {String(HOUR_START + i).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  <div className="relative flex flex-1">
                    {/* Current time line */}
                    {isThisWeek && nowTop >= 0 && nowTop <= 100 && (
                      <div
                        className="pointer-events-none absolute z-20 flex items-center"
                        style={{ top: `${nowTop}%`, left: `${(todayIdx / 7) * 100}%`, width: `${100 / 7}%` }}
                      >
                        <div className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        <div className="h-px flex-1 bg-red-500" />
                      </div>
                    )}

                    {weekDays.map((day) => {
                      const dateStr   = formatDate(day);
                      const dayAppts  = byDate[dateStr] ?? [];
                      const isToday   = dateStr === today;
                      return (
                        <div
                          key={dateStr}
                          className={clsx('relative flex-1 border-l border-border', isToday && 'bg-accent-subtle/5')}
                          style={{ height: `${TOTAL_HOURS * ROW_PX}px` }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-appointment]')) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const relY = e.clientY - rect.top;
                            const pct = relY / rect.height;
                            const totalMinutes = HOUR_START * 60 + Math.round(pct * TOTAL_HOURS * 60 / 30) * 30;
                            const h = Math.floor(totalMinutes / 60);
                            const m = totalMinutes % 60;
                            const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            const endH = h + 1;
                            const endStr = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            setNewDate(dateStr);
                            setNewStart(startStr);
                            setNewEnd(endStr);
                            setShowModal(true);
                          }}
                        >
                          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                            <div key={i} style={{ top: `${i * ROW_PX}px` }} className="absolute w-full border-t border-border/40" />
                          ))}
                          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                            <div key={`h${i}`} style={{ top: `${i * ROW_PX + ROW_PX / 2}px` }} className="absolute w-full border-t border-border/20 border-dashed" />
                          ))}

                          {dayAppts.map((a) => {
                            const top    = topPercent(a.startTime);
                            const height = heightPercent(a.startTime, a.endTime);
                            return (
                              <div
                                key={a.id}
                                data-appointment="1"
                                className={clsx(
                                  'group absolute left-1 right-1 z-10 cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 transition-opacity hover:opacity-90',
                                  STATUS_COLOR[a.status]
                                )}
                                style={{ top: `${top}%`, height: `${height}%`, minHeight: '22px' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="truncate text-[11px] font-semibold leading-tight">{a.title}</p>
                                <p className="text-[10px] leading-tight opacity-75">{a.startTime}–{a.endTime}</p>
                                {a.contactName && (
                                  <p className="truncate text-[10px] leading-tight opacity-60">{a.contactName}</p>
                                )}
                                <button
                                  data-appointment="1"
                                  onClick={(e) => { e.stopPropagation(); void handleCancel(a.id); }}
                                  className="absolute right-1 top-1 hidden rounded p-0.5 hover:bg-black/20 group-hover:flex"
                                  title="Cancelar"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            );
                          })}

                          {(gcByDate[dateStr] ?? []).filter(e => !e.allDay).map((e) => {
                            const top    = topPercent(e.start);
                            const height = heightPercent(e.start, e.end);
                            return (
                              <div
                                key={`gc-${e.id}`}
                                data-appointment="1"
                                className="absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 opacity-80 transition-opacity hover:opacity-100"
                                style={{
                                  top: `${top}%`,
                                  height: `${height}%`,
                                  minHeight: '22px',
                                  left: '4px',
                                  right: '4px',
                                  backgroundColor: 'rgba(30, 100, 210, 0.25)',
                                  borderColor: 'rgba(66, 133, 244, 0.6)',
                                }}
                                title={`Google: ${e.title}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-[10px] leading-tight text-blue-300">📅 {e.title}</p>
                                <p className="text-[10px] leading-tight text-blue-400/70">{e.start}–{e.end}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── New Appointment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card pb-safe shadow-2xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Novo compromisso</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Título *</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Reunião com cliente" autoFocus className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Data *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputClass} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-text-muted block mb-1">Início *</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-text-muted block mb-1">Término *</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as Appointment['status'])} className={inputClass}>
                  <option value="booked">Agendado</option>
                  <option value="available">Disponível</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Observações</label>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Detalhes opcionais..." className={clsx(inputClass, 'resize-none')} />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={handleCreate}>Criar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
