'use server';

import { redirect } from 'next/navigation';
import { categories, routes, transaction } from '../lib/db.mjs';

export async function register(form) {
  const field = (name) => String(form.get(name) ?? '').trim();
  const direction = field('direction');
  const title = field('title');
  const category = direction ? 'Correspondence' : field('category');
  const route = Object.hasOwn(routes, direction) ? routes[direction] : null;
  const division = route?.office ?? field('division');
  const agency = field('agency');
  const file = form.get('file');
  if (!title || title.length > 160 || !categories.includes(category) ||
      !division || division.length > 100 || (direction && (!route || !agency || agency.length > 160)) ||
      !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 ||
      !file.name || file.name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(file.name)) {
    redirect('/?notice=invalid#register');
  }
  const contents = new Uint8Array(await file.arrayBuffer());
  transaction((connection) => {
    const { lastInsertRowid: id } = connection.prepare(
      'INSERT INTO documents (title, category, division, filename, contents) VALUES (?, ?, ?, ?, ?)'
    ).run(title, category, division, file.name, contents);
    if (route) {
      connection.prepare('INSERT INTO correspondence (document_id, direction, agency) VALUES (?, ?, ?)')
        .run(id, direction, agency);
      connection.prepare('INSERT INTO correspondence_events (document_id, stage) VALUES (?, 0)').run(id);
    }
  });
  redirect(direction ? '/?notice=registered#correspondence' : '/?notice=registered#documents');
}

export async function advance(id, stage) {
  if (!Number.isSafeInteger(id) || !Number.isInteger(stage)) redirect('/?notice=stale#correspondence');
  const moved = transaction((connection) => {
    const result = connection.prepare(`
      UPDATE correspondence SET stage = stage + 1
      WHERE document_id = ? AND stage = ?
        AND ((direction = 'incoming' AND stage < 2) OR (direction = 'outgoing' AND stage < 3))
    `).run(id, stage);
    if (!result.changes) return false;
    connection.prepare('INSERT INTO correspondence_events (document_id, stage) VALUES (?, ?)')
      .run(id, stage + 1);
    return true;
  });
  redirect(moved ? '/?notice=advanced#correspondence' : '/?notice=stale#correspondence');
}
