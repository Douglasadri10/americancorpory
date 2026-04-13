import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  type Firestore,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Conversation, ConversationFilter, ConversationStatus } from '@/types/conversation';

const CONVERSATIONS_COLLECTION = 'conversations';
const PAGE_SIZE = 25;

export class ConversationService {
  constructor(private db: Firestore) {}

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const ref = doc(this.db, CONVERSATIONS_COLLECTION, conversationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Conversation;
  }

  async getConversations(
    workspaceId: string,
    filter: ConversationFilter = {},
    lastDoc?: DocumentSnapshot,
    pageSize = PAGE_SIZE
  ): Promise<{ conversations: Conversation[]; lastDoc: DocumentSnapshot | null }> {
    let q = query(
      collection(this.db, CONVERSATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('updatedAt', 'desc'),
      limit(pageSize)
    );

    if (filter.status && filter.status !== 'all') {
      q = query(q, where('status', '==', filter.status));
    }

    if (filter.channel && filter.channel !== 'all') {
      q = query(q, where('channel', '==', filter.channel));
    }

    if (filter.assignedTo && filter.assignedTo !== 'unassigned') {
      q = query(q, where('assignedTo', '==', filter.assignedTo));
    } else if (filter.assignedTo === 'unassigned') {
      q = query(q, where('assignedTo', '==', null));
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);
    const conversations = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Conversation[];

    return {
      conversations,
      lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    };
  }

  subscribeToConversations(
    workspaceId: string,
    filter: ConversationFilter,
    onUpdate: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    let q = query(
      collection(this.db, CONVERSATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('updatedAt', 'desc'),
      limit(PAGE_SIZE)
    );

    if (filter.status && filter.status !== 'all') {
      q = query(q, where('status', '==', filter.status));
    }

    if (filter.channel && filter.channel !== 'all') {
      q = query(q, where('channel', '==', filter.channel));
    }

    return onSnapshot(
      q,
      (snap) => {
        const conversations = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Conversation[];
        onUpdate(conversations);
      },
      (error) => {
        onError?.(error);
      }
    );
  }

  async createConversation(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    const id = doc(collection(this.db, CONVERSATIONS_COLLECTION)).id;
    const data: Conversation = { ...conversation, id };
    await setDoc(doc(this.db, CONVERSATIONS_COLLECTION, id), data);
    return data;
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<void> {
    const updates: Partial<Conversation> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
    }

    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), updates);
  }

  async assignAgent(
    conversationId: string,
    agentUid: string,
    agentName: string
  ): Promise<void> {
    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      assignedTo: agentUid,
      assignedToName: agentName,
      updatedAt: new Date().toISOString(),
    });
  }

  async unassign(conversationId: string): Promise<void> {
    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      assignedTo: null,
      assignedToName: null,
      updatedAt: new Date().toISOString(),
    });
  }

  async markAsRead(conversationId: string): Promise<void> {
    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  async addTag(conversationId: string, tag: { id: string; label: string; color: string }): Promise<void> {
    const conv = await this.getConversation(conversationId);
    if (!conv) return;

    const tags = [...(conv.tags ?? [])];
    if (!tags.find((t) => t.id === tag.id)) {
      tags.push(tag);
    }

    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      tags,
      updatedAt: new Date().toISOString(),
    });
  }

  async removeTag(conversationId: string, tagId: string): Promise<void> {
    const conv = await this.getConversation(conversationId);
    if (!conv) return;

    const tags = (conv.tags ?? []).filter((t) => t.id !== tagId);

    await updateDoc(doc(this.db, CONVERSATIONS_COLLECTION, conversationId), {
      tags,
      updatedAt: new Date().toISOString(),
    });
  }

  async findByExternalId(
    workspaceId: string,
    externalId: string
  ): Promise<Conversation | null> {
    const q = query(
      collection(this.db, CONVERSATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      where('externalId', '==', externalId),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Conversation;
  }

  async findByContactId(
    workspaceId: string,
    contactId: string,
    channel: string
  ): Promise<Conversation | null> {
    const q = query(
      collection(this.db, CONVERSATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      where('contact.id', '==', contactId),
      where('channel', '==', channel),
      where('status', '!=', 'resolved'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Conversation;
  }

  async getStats(workspaceId: string): Promise<{
    total: number;
    open: number;
    pending: number;
    resolved: number;
    unassigned: number;
  }> {
    const allQuery = query(
      collection(this.db, CONVERSATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId)
    );
    const allSnap = await getDocs(allQuery);
    const all = allSnap.docs.map((d) => d.data() as Conversation);

    return {
      total: all.length,
      open: all.filter((c) => c.status === 'open').length,
      pending: all.filter((c) => c.status === 'pending').length,
      resolved: all.filter((c) => c.status === 'resolved').length,
      unassigned: all.filter((c) => !c.assignedTo).length,
    };
  }
}
