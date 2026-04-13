import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type { Lead, LeadFilter, LeadStatus, LeadActivity } from '@/types/lead';

const LEADS_COLLECTION = 'leads';

export class LeadService {
  constructor(private db: Firestore) {}

  async getLead(leadId: string): Promise<Lead | null> {
    const ref = doc(this.db, LEADS_COLLECTION, leadId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Lead;
  }

  async getLeads(
    workspaceId: string,
    filter: LeadFilter = {},
    pageSize = 50
  ): Promise<Lead[]> {
    // Single equality filter — no composite index needed; sort in memory
    const q = query(
      collection(this.db, LEADS_COLLECTION),
      where('workspaceId', '==', workspaceId)
    );

    const snap = await getDocs(q);
    let leads = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[];

    if (filter.status && filter.status !== 'all') {
      leads = leads.filter((l) => l.status === filter.status);
    }
    if (filter.source && filter.source !== 'all') {
      leads = leads.filter((l) => l.source === filter.source);
    }
    if (filter.assignedTo) {
      leads = leads.filter((l) => l.assignedTo === filter.assignedTo);
    }

    leads.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return leads.slice(0, pageSize);
  }

  async createLead(lead: Omit<Lead, 'id'>): Promise<Lead> {
    const id = doc(collection(this.db, LEADS_COLLECTION)).id;
    const data: Lead = { ...lead, id };
    await setDoc(doc(this.db, LEADS_COLLECTION, id), data);
    return data;
  }

  async updateLead(leadId: string, updates: Partial<Lead>): Promise<void> {
    await updateDoc(doc(this.db, LEADS_COLLECTION, leadId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateStatus(
    leadId: string,
    status: LeadStatus,
    performedBy: string,
    performedByName: string
  ): Promise<void> {
    const lead = await this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const activity: LeadActivity = {
      id: doc(collection(this.db, LEADS_COLLECTION)).id,
      type: 'status_change',
      description: `Status alterado de "${lead.status}" para "${status}"`,
      performedBy,
      performedByName,
      metadata: { from: lead.status, to: status },
      createdAt: new Date().toISOString(),
    };

    await updateDoc(doc(this.db, LEADS_COLLECTION, leadId), {
      status,
      activities: [...(lead.activities ?? []), activity],
      updatedAt: new Date().toISOString(),
    });
  }

  async addActivity(leadId: string, activity: Omit<LeadActivity, 'id'>): Promise<void> {
    const lead = await this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const newActivity: LeadActivity = {
      ...activity,
      id: doc(collection(this.db, LEADS_COLLECTION)).id,
    };

    await updateDoc(doc(this.db, LEADS_COLLECTION, leadId), {
      activities: [...(lead.activities ?? []), newActivity],
      lastContactAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async addNote(
    leadId: string,
    note: string,
    performedBy: string,
    performedByName: string
  ): Promise<void> {
    await this.addActivity(leadId, {
      type: 'note',
      description: note,
      performedBy,
      performedByName,
      createdAt: new Date().toISOString(),
    });
  }

  async assignLead(
    leadId: string,
    agentUid: string,
    agentName: string
  ): Promise<void> {
    await updateDoc(doc(this.db, LEADS_COLLECTION, leadId), {
      assignedTo: agentUid,
      assignedToName: agentName,
      updatedAt: new Date().toISOString(),
    });
  }

  async linkConversation(leadId: string, conversationId: string): Promise<void> {
    const lead = await this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversationIds = Array.from(new Set([...(lead.conversationIds ?? []), conversationId]));

    await updateDoc(doc(this.db, LEADS_COLLECTION, leadId), {
      conversationIds,
      updatedAt: new Date().toISOString(),
    });
  }

  async findByContact(
    workspaceId: string,
    contactId: string,
    channel: 'instagram' | 'facebook' | 'whatsapp'
  ): Promise<Lead | null> {
    const fieldMap: Record<string, string> = {
      instagram: 'instagramId',
      facebook: 'facebookId',
      whatsapp: 'whatsappPhone',
    };

    const q = query(
      collection(this.db, LEADS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      where(fieldMap[channel], '==', contactId),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Lead;
  }

  async getStats(workspaceId: string): Promise<{
    total: number;
    new: number;
    won: number;
    lost: number;
    totalValue: number;
  }> {
    const q = query(
      collection(this.db, LEADS_COLLECTION),
      where('workspaceId', '==', workspaceId)
    );

    const snap = await getDocs(q);
    const leads = snap.docs.map((d) => d.data() as Lead);

    return {
      total: leads.length,
      new: leads.filter((l) => l.status === 'new').length,
      won: leads.filter((l) => l.status === 'won').length,
      lost: leads.filter((l) => l.status === 'lost').length,
      totalValue: leads.reduce((acc, l) => acc + (l.dealValue ?? 0), 0),
    };
  }
}
