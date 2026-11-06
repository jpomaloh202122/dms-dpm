"""Local DPM document register pilot. Run with Python 3.10 or later."""
import html
import os
import re
import sqlite3
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit

DATABASE = Path(os.environ.get("DMS_DATABASE", "dms.sqlite3"))
CATEGORIES = ("Correspondence", "Policy", "Circular", "Memo", "Report", "Other")
MAX_UPLOAD = 10 * 1024 * 1024


@contextmanager
def database():
    conn = sqlite3.connect(DATABASE)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def escape(value):
    return html.escape(str(value), quote=True)


class Register(BaseHTTPRequestHandler):
    def log_request(self, code="-", size="-"):
        self.log_message("%s %s %s", self.command, urlsplit(self.path).path, code)

    def respond(self, status, body, content_type="text/html; charset=utf-8", headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}":
            return self.send_error(403)
        url = urlsplit(self.path)
        if url.path == "/upload.js":
            return self.respond(200, SCRIPT.encode(), "text/javascript; charset=utf-8")
        download = re.fullmatch(r"/documents/([0-9]{1,18})", url.path)
        if download:
            with database() as conn:
                row = conn.execute("SELECT filename, contents FROM documents WHERE id = ?", (download[1],)).fetchone()
            if row is None:
                return self.send_error(404)
            return self.respond(200, row[1], "application/octet-stream", {
                "Content-Disposition": "attachment; filename*=UTF-8''" + quote(row[0], safe="")
            })
        if url.path != "/":
            return self.send_error(404)
        query = parse_qs(url.query)
        search = query.get("q", [""])[0].strip()[:200]
        category = query.get("category", [""])[0]
        with database() as conn:
            rows = conn.execute("""
                SELECT id, title, category, division, filename, created
                FROM documents
                WHERE (? = '' OR category = ?)
                  AND instr(lower(title || ' ' || division || ' ' || filename ||
                      ' DPM-' || printf('%06d', id)), lower(?)) > 0
                ORDER BY id DESC
            """, (category, category, search)).fetchall()
        records = "".join(
            f"<tr><td>DPM-{i:06d}</td><td>{escape(title)}</td><td>{escape(cat)}</td>"
            f"<td>{escape(division)}</td><td>{escape(created)} UTC</td>"
            f"<td><a href='/documents/{i}'>Download {escape(filename)}</a></td></tr>"
            for i, title, cat, division, filename, created in rows
        ) or "<tr><td colspan='6'>No matching documents.</td></tr>"
        options = "".join(f"<option>{item}</option>" for item in CATEGORIES)
        filters = "".join(
            f"<option{' selected' if item == category else ''}>{item}</option>"
            for item in CATEGORIES
        )
        self.respond(200, PAGE.format(records=records, options=options, filters=filters,
                                      search=escape(search), count=len(rows)).encode())

    def do_POST(self):
        origin = f"http://127.0.0.1:{self.server.server_port}"
        if self.headers.get("Host") != origin.split("//")[1] or self.headers.get("Origin") != origin:
            return self.send_error(403)
        url = urlsplit(self.path)
        if url.path != "/documents":
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_error(400)
        if not 0 < length <= MAX_UPLOAD:
            return self.send_error(413, "Choose a file between 1 byte and 10 MiB")
        params = parse_qs(url.query)
        title, category, division, filename = (
            params.get(field, [""])[0].strip()
            for field in ("title", "category", "division", "filename")
        )
        if (not 0 < len(title) <= 160 or not 0 < len(division) <= 100
                or category not in CATEGORIES or not 0 < len(filename) <= 255
                or any(ord(char) < 32 or char in "/\\\x7f" for char in filename)):
            return self.send_error(400, "Check the document details")
        self.connection.settimeout(15)
        try:
            contents = self.rfile.read(length)
        except TimeoutError:
            return self.send_error(408)
        if len(contents) != length:
            return self.send_error(400, "Upload incomplete")
        with database() as conn:
            conn.execute("INSERT INTO documents (title, category, division, filename, contents) VALUES (?, ?, ?, ?, ?)",
                         (title, category, division, filename, contents))
        self.respond(201, b"Document registered", "text/plain; charset=utf-8")


SCRIPT = """
const form = document.querySelector('#upload');
const status = document.querySelector('#status');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const file = data.get('file');
  if (!file.size || file.size > 10 * 1024 * 1024) {
    status.textContent = 'Choose a file between 1 byte and 10 MiB.';
    return;
  }
  data.delete('file');
  const params = new URLSearchParams(data);
  params.set('filename', file.name);
  const button = form.querySelector('button');
  button.disabled = true;
  status.textContent = 'Registering document…';
  try {
    const response = await fetch('/documents?' + params, {method: 'POST', body: file});
    if (!response.ok) throw new Error();
    window.location.assign('/');
  } catch {
    status.textContent = 'Upload failed. Check the document details and try again.';
    button.disabled = false;
  }
});
"""

PAGE = """<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DPM Document Management</title>
<style>
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #f4f5f7; color: #182031; font: 16px system-ui, sans-serif; }}
header {{ background: #202838; color: white; border-bottom: 4px solid #e8b64d; padding: 24px max(5vw, 20px); }}
header p {{ margin: 0; color: #ffe09a; font-size: .9rem; }}
h1 {{ margin: 5px 0 0; }}
main {{ max-width: 1200px; margin: 28px auto; padding: 0 20px; }}
section {{ background: white; padding: 22px; margin-bottom: 20px; border: 1px solid #dce0e6; border-radius: 12px; }}
h2 {{ margin-top: 0; }}
form {{ display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }}
label {{ display: grid; gap: 5px; }}
input, select, button {{ font: inherit; max-width: 100%; padding: 8px; border: 1px solid #9ca6b5; border-radius: 5px; }}
button {{ background: #26334a; color: white; cursor: pointer; }}
table {{ border-collapse: collapse; width: 100%; text-align: left; }}
th, td {{ padding: 10px; border-bottom: 1px solid #dce0e6; overflow-wrap: anywhere; }}
.table {{ overflow: auto; }}
</style>
<header><p>Department of Personnel Management · Local pilot</p><h1>Document Management System</h1></header>
<main>
<section><h2>Register a document</h2>
<form id="upload"><label>Title<input name="title" maxlength="160" required></label>
<label>Division<input name="division" maxlength="100" required></label>
<label>Category<select name="category" required>{options}</select></label>
<label>File (up to 10 MiB)<input name="file" type="file" required></label>
<button>Register document</button></form><p id="status" role="status"></p>
</section>
<section><h2>Document register</h2>
<form action="/"><label>Search<input name="q" maxlength="200" value="{search}" placeholder="Title, division, file or reference"></label>
<label>Category<select name="category"><option value="">All categories</option>{filters}</select></label>
<button>Apply filters</button><a href="/">Clear filters</a></form>
<p>{count} matching documents</p>
<div class="table"><table><thead><tr><th>Reference</th><th>Title</th><th>Category</th><th>Division</th><th>Registered</th><th>File</th></tr></thead><tbody>{records}</tbody></table></div>
</section></main><script src="/upload.js" defer></script></html>
"""


def main():
    with database() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                division TEXT NOT NULL,
                filename TEXT NOT NULL,
                contents BLOB NOT NULL,
                created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
    port = int(os.environ.get("DMS_PORT", "8000"))
    with ThreadingHTTPServer(("127.0.0.1", port), Register) as server:
        print(f"DPM DMS local pilot: http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
