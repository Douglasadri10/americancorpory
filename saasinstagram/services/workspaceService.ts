import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Workspace, WorkspaceMember, WorkspaceMemberRole, WorkspaceSettings } from '@/types/workspace';
import { PLANS } from '@/lib/stripe/plans';

const WORKSPACES_COLLECTION = 'workspaces';

export class WorkspaceService {
  constructor(private db: Firestore) {}

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const ref = doc(this.db, WORKSPACES_COLLECTION, workspaceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Workspace;
  }

  async getUserWorkspaces(uid: string): Promise<Workspace[]> {
    const q = query(
      collection(this.db, WORKSPACES_COLLECTION),
      where('members', 'array-contains-any', [{ uid }])
    );
    // Fallback: query by ownerUid if the above doesn't return results
    const ownerQuery = query(
      collection(this.db, WORKSPACES_COLLECTION),
      where('ownerUid', '==', uid)
    );
    const snap = await getDocs(ownerQuery);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workspace));
  }

  async createWorkspace(params: {
    name: string;
    ownerUid: string;
    ownerEmail: string;
    ownerDisplayName: string;
  }): Promise<Workspace> {
    const id = doc(collection(this.db, WORKSPACES_COLLECTION)).id;
    const slug = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const now = new Date().toISOString();
    const freePlan = PLANS.free;

    const workspace: Workspace = {
      id,
      name: params.name,
      slug: `${slug}-${id.slice(0, 6)}`,
      ownerUid: params.ownerUid,
      members: [
        {
          uid: params.ownerUid,
          email: params.ownerEmail,
          displayName: params.ownerDisplayName,
          role: 'owner',
          joinedAt: now,
          isActive: true,
        },
      ],
      plan: {
        id: 'free',
        status: 'active',
      },
      limits: freePlan.limits,
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        businessHours: {
          enabled: false,
          schedule: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '09:00', close: '13:00', enabled: false },
            sunday: { open: '09:00', close: '13:00', enabled: false },
          },
        },
        autoAssignment: { enabled: false, strategy: 'round_robin' },
        notifications: {
          newConversation: true,
          newMessage: true,
          assignedToMe: true,
        },
      },
      usage: {
        conversationsThisMonth: 0,
        aiMessagesThisMonth: 0,
        aiInteractionsThisMonth: 0,
        lastResetAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(this.db, WORKSPACES_COLLECTION, id), workspace);
    return workspace;
  }

  async updateWorkspace(
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'logoURL' | 'settings'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateSettings(
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      settings: { ...workspace.settings, ...settings },
      updatedAt: new Date().toISOString(),
    });
  }

  async addMember(
    workspaceId: string,
    member: Omit<WorkspaceMember, 'joinedAt' | 'isActive'>
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const existingIndex = workspace.members.findIndex((m) => m.uid === member.uid);
    if (existingIndex >= 0) {
      workspace.members[existingIndex] = {
        ...workspace.members[existingIndex],
        ...member,
        isActive: true,
      };
    } else {
      workspace.members.push({
        ...member,
        joinedAt: new Date().toISOString(),
        isActive: true,
      });
    }

    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      members: workspace.members,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateMemberRole(
    workspaceId: string,
    memberUid: string,
    role: WorkspaceMemberRole
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const members = workspace.members.map((m) =>
      m.uid === memberUid ? { ...m, role } : m
    );

    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      members,
      updatedAt: new Date().toISOString(),
    });
  }

  async removeMember(workspaceId: string, memberUid: string): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const members = workspace.members.map((m) =>
      m.uid === memberUid ? { ...m, isActive: false } : m
    );

    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      members,
      updatedAt: new Date().toISOString(),
    });
  }

  async incrementUsage(
    workspaceId: string,
    field: 'conversationsThisMonth' | 'aiMessagesThisMonth',
    amount = 1
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return;

    const usage = { ...workspace.usage };

    // Reset if new month
    const lastReset = new Date(usage.lastResetAt);
    const now = new Date();
    if (
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getFullYear() !== now.getFullYear()
    ) {
      usage.conversationsThisMonth = 0;
      usage.aiMessagesThisMonth = 0;
      usage.lastResetAt = now.toISOString();
    }

    usage[field] += amount;

    await updateDoc(doc(this.db, WORKSPACES_COLLECTION, workspaceId), {
      usage,
      updatedAt: now.toISOString(),
    });
  }
}
