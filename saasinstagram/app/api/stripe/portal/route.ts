export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/firebase/request-auth';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createPortalSession } from '@/lib/stripe/client';

export async function POST(request: NextRequest) {
  const decoded = await authenticateRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments not configured. Contact support.' }, { status: 503 });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('workspaces')
      .where('ownerUid', '==', decoded.uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const data = snap.docs[0].data();
    const stripeCustomerId = data.plan?.stripeCustomerId as string | undefined;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription. Please subscribe to a plan first.' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const session = await createPortalSession(stripeCustomerId, `${appUrl}/billing`);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('stripe/portal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
