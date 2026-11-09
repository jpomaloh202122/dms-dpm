import { db } from '../../../lib/db.mjs';

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!/^[0-9]{1,18}$/.test(id)) return new Response('Document not found', { status: 404 });
  const record = db().prepare('SELECT filename, contents FROM documents WHERE id = ?').get(BigInt(id));
  if (!record) return new Response('Document not found', { status: 404 });
  const filename = encodeURIComponent(record.filename).replace(/['()*]/g, (char) =>
    '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
  return new Response(record.contents, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': "attachment; filename*=UTF-8''" + filename,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
