# DPM Document Management System

A Next.js web app for registering documents and tracking correspondence between external agencies, the Secretary’s Office and Payroll Office.

## Development

Install Node.js 24 or later and run these commands from the repository directory.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 in a browser on the computer running the app.

## Production build

```sh
npm run build
npm start
```

The default start command binds to 127.0.0.1 for local testing.

## Application and storage

Next.js serves the dashboard, registration forms, search, downloads and correspondence actions. Node.js provides SQLite through its built-in module. The database is created automatically at `dms.sqlite3`.

To select another database location, set `DMS_DATABASE` to an absolute file path before starting the app. Existing register databases use the same schema and can be opened directly. Back up an existing database before changing its location.

## Correspondence workflows

- Incoming correspondence is registered by the Secretary’s Office, referred to Payroll Office and marked complete after Payroll action.
- Outgoing correspondence is prepared by Payroll Office, submitted to the Secretary’s Office, cleared for dispatch and marked as sent.
- Staff send outbound letters separately and record dispatch in the app.
- The dashboard shows pending office handoffs and completed correspondence. Filters support office, route, status, reference, title and agency.
- Uploaded files are limited to 10 MiB and stored with their document records. Each routing step is recorded in the case history.

The pilot uses one shared queue for local testing with sample documents.
