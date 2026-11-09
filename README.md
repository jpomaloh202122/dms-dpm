# DPM Document Management System

This Next.js pilot is for local testing with sample documents. Both offices use the same queue. Staff send outbound letters separately and record dispatch in the app.

## Run locally

Install Node.js 24 or later, then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. To run the production build locally, use `npm run build` and `npm start`.

The app uses `dms.sqlite3` by default. To test records from the Python pilot, stop it and make a backup copy of its SQLite database. Start Next.js with `DMS_DATABASE=/absolute/path/to/copy.sqlite3 npm run dev`. The existing documents, attachments, case stages and history use the same schema.

Use **Incoming** to register an agency letter in the Secretary’s Office, refer it to Payroll and record completion. Use **Outgoing** for letters prepared by Payroll, submitted to the Secretary’s Office, cleared for dispatch and marked as sent.
