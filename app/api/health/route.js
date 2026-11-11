import { db } from '../../../lib/db.mjs';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    db().prepare('SELECT 1 FROM documents LIMIT 1').get();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
