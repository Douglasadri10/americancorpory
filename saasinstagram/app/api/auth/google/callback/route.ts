import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, saveTokens } from '@/services/googleCalendarService';
import { getAdminFirestore as getFirebaseAdminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const workspaceId = searchParams.get('state'); // passed via OAuth state param
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (error || !code || !workspaceId) {
    return NextResponse.redirect(
      `${appUrl}/settings?section=integrations&google=error`
    );
  }

  try {
    const db = getFirebaseAdminDb();
    const { tokens } = await exchangeCodeForTokens(code);
    await saveTokens(db, workspaceId, tokens);

    return NextResponse.redirect(
      `${appUrl}/settings?section=integrations&google=connected`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google-callback] error:', msg);
    return NextResponse.redirect(
      `${appUrl}/settings?section=integrations&google=error&msg=${encodeURIComponent(msg)}`
    );
  }
}
