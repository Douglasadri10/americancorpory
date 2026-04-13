import type { Firestore } from 'firebase-admin/firestore';

export async function getOwnedWorkspace(
  db: Firestore,
  workspaceId: string,
  ownerUid: string
) {
  const workspaceSnap = await db.collection('workspaces').doc(workspaceId).get();

  if (!workspaceSnap.exists) {
    throw new Error('workspace_not_found');
  }

  if (workspaceSnap.data()?.ownerUid !== ownerUid) {
    throw new Error('workspace_forbidden');
  }

  return workspaceSnap;
}

export async function getOwnedChannel(
  db: Firestore,
  channelId: string,
  ownerUid: string
) {
  const channelSnap = await db.collection('channels').doc(channelId).get();

  if (!channelSnap.exists) {
    throw new Error('channel_not_found');
  }

  const channelData = channelSnap.data();
  const workspaceId = channelData?.workspaceId as string | undefined;

  if (!workspaceId) {
    throw new Error('channel_workspace_missing');
  }

  await getOwnedWorkspace(db, workspaceId, ownerUid);

  return {
    channelSnap,
    channelData,
  };
}

export async function getOwnedConversation(
  db: Firestore,
  conversationId: string,
  ownerUid: string
) {
  const conversationSnap = await db.collection('conversations').doc(conversationId).get();

  if (!conversationSnap.exists) {
    throw new Error('conversation_not_found');
  }

  const conversationData = conversationSnap.data();
  const workspaceId = conversationData?.workspaceId as string | undefined;

  if (!workspaceId) {
    throw new Error('conversation_workspace_missing');
  }

  await getOwnedWorkspace(db, workspaceId, ownerUid);

  return {
    conversationSnap,
    conversationData,
  };
}

export async function getOwnedAutomation(
  db: Firestore,
  automationId: string,
  ownerUid: string
) {
  const automationSnap = await db.collection('automations').doc(automationId).get();

  if (!automationSnap.exists) {
    throw new Error('automation_not_found');
  }

  const automationData = automationSnap.data();
  const workspaceId = automationData?.workspaceId as string | undefined;

  if (!workspaceId) {
    throw new Error('automation_workspace_missing');
  }

  await getOwnedWorkspace(db, workspaceId, ownerUid);

  return {
    automationSnap,
    automationData,
  };
}
