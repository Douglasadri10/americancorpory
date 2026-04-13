export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Fluxo legado desativado. Use /api/channels/manual/inspect e conclua pela sessão de conexão.',
    },
    { status: 410 }
  );
}
