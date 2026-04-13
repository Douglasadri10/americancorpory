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
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { Message, MessageStatus, SendMessagePayload } from '@/types/message';

const MESSAGES_COLLECTION = 'messages';

export class MessageService {
  constructor(private db: Firestore) {}

  async getMessage(messageId: string): Promise<Message | null> {
    const ref = doc(this.db, MESSAGES_COLLECTION, messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Message;
  }

  async getConversationMessages(
    conversationId: string,
    pageSize = 50
  ): Promise<Message[]> {
    const q = query(
      collection(this.db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc'),
      limit(pageSize)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
  }

  subscribeToMessages(
    conversationId: string,
    onUpdate: (messages: Message[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(this.db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    return onSnapshot(
      q,
      (snap) => {
        const messages = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Message[];
        onUpdate(messages);
      },
      (error) => {
        onError?.(error);
      }
    );
  }

  async createMessage(message: Omit<Message, 'id'>): Promise<Message> {
    const id = doc(collection(this.db, MESSAGES_COLLECTION)).id;
    const data: Message = { ...message, id };
    await setDoc(doc(this.db, MESSAGES_COLLECTION, id), data);
    return data;
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<void> {
    const updates: Partial<Message> = {
      status,
      statusUpdatedAt: timestamp ?? new Date().toISOString(),
    };

    if (status === 'delivered') updates.deliveredAt = timestamp ?? new Date().toISOString();
    if (status === 'read') updates.readAt = timestamp ?? new Date().toISOString();
    if (status === 'failed') updates.errorMessage = 'Delivery failed';

    await updateDoc(doc(this.db, MESSAGES_COLLECTION, messageId), updates);
  }

  async updateMessageStatusByExternalId(
    externalId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<void> {
    const q = query(
      collection(this.db, MESSAGES_COLLECTION),
      where('externalId', '==', externalId),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    await this.updateMessageStatus(snap.docs[0].id, status, timestamp);
  }

  async markConversationMessagesRead(conversationId: string): Promise<void> {
    const q = query(
      collection(this.db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      where('direction', '==', 'inbound'),
      where('status', '!=', 'read')
    );

    const snap = await getDocs(q);
    const now = new Date().toISOString();

    const updates = snap.docs.map((d) =>
      updateDoc(d.ref, { status: 'read', readAt: now, statusUpdatedAt: now })
    );

    await Promise.all(updates);
  }

  async getMessageByExternalId(externalId: string): Promise<Message | null> {
    const q = query(
      collection(this.db, MESSAGES_COLLECTION),
      where('externalId', '==', externalId),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Message;
  }

  /**
   * Send a message via API route (client-side).
   */
  async sendViaAPI(
    payload: SendMessagePayload & { workspaceId: string }
  ): Promise<Message> {
    const user = getFirebaseAuth().currentUser;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (user) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error ?? 'Failed to send message');
    }

    return response.json() as Promise<Message>;
  }
}
