import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const source = process.env.DMS_DATABASE || 'dms.sqlite3';
const directory = process.env.DMS_BACKUP_DIRECTORY || '/backups';
mkdirSync(directory, { recursive: true });
const destination = resolve(directory, 'dms-' + new Date().toISOString().replaceAll(':', '-') + '.sqlite3');
const database = new DatabaseSync(source, { readOnly: true });
try {
  database.exec('PRAGMA busy_timeout = 30000');
  database.prepare('VACUUM INTO ?').run(destination);
  console.log(destination);
} finally {
  database.close();
}
