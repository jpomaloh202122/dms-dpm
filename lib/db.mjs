import { DatabaseSync } from 'node:sqlite';

export const categories = ['Correspondence', 'Policy', 'Circular', 'Memo', 'Report', 'Other'];
export const routes = {
  incoming: {
    office: 'Secretary’s Office',
    stages: ['Received by Secretary’s Office', 'Referred to Payroll Office', 'Payroll action completed'],
    actions: ['Refer to Payroll Office', 'Mark Payroll action complete'],
  },
  outgoing: {
    office: 'Payroll Office',
    stages: ['Prepared by Payroll Office', 'Submitted to Secretary’s Office', 'Cleared for dispatch', 'Dispatched externally'],
    actions: ['Submit to Secretary’s Office', 'Clear for dispatch', 'Record external dispatch'],
  },
};

let database;
export function db() {
  if (!database) {
    const connection = new DatabaseSync(process.env.DMS_DATABASE || 'dms.sqlite3');
    try {
      connection.exec(`PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                division TEXT NOT NULL,
                filename TEXT NOT NULL,
                contents BLOB NOT NULL,
                created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS correspondence (
                document_id INTEGER PRIMARY KEY REFERENCES documents(id),
                direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
                agency TEXT NOT NULL,
                stage INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS correspondence_events (
                document_id INTEGER NOT NULL REFERENCES correspondence(document_id),
                stage INTEGER NOT NULL,
                recorded TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (document_id, stage)
            );
        
      `);
      database = connection;
    } catch (error) {
      connection.close();
      throw error;
    }
  }
  return database;
}

export function transaction(operation) {
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try {
    const result = operation(connection);
    connection.exec('COMMIT');
    return result;
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}

export function reference(id) {
  return 'DPM-' + String(id).padStart(6, '0');
}
