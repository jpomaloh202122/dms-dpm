import { connection } from 'next/server';
import { categories, db, reference, routes } from '../lib/db.mjs';
import { advance, register } from './actions';
import RegisterForm from './register-form';

const notices = {
  invalid: 'Check the document details and choose a file up to 10 MiB.',
  registered: 'Document registered.',
  advanced: 'Correspondence updated.',
  stale: 'This case has already moved or cannot advance.',
};

export default async function Home({ searchParams }) {
  await connection();
  const params = await searchParams;
  const search = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  const category = categories.includes(params.category) ? params.category : '';
  const notice = Object.hasOwn(notices, params.notice) ? notices[params.notice] : '';
  const documents = db().prepare(`
    SELECT id, title, category, division, filename, created FROM documents
    WHERE (? = '' OR category = ?)
      AND instr(lower(title || ' ' || division || ' ' || filename || ' DPM-' || printf('%06d', id)), lower(?)) > 0
    ORDER BY id DESC
  `).all(category, category, search);
  const cases = db().prepare(`
    SELECT d.id, d.title, c.direction, c.agency, c.stage
    FROM correspondence c JOIN documents d ON d.id = c.document_id ORDER BY d.id DESC
  `).all();
  const history = new Map(cases.map(({ id }) => [id, []]));
  for (const event of db().prepare('SELECT * FROM correspondence_events ORDER BY document_id, stage').all()) {
    history.get(event.document_id)?.push(event);
  }

  return <>
    <nav aria-label="Sections"><a href="#register">Register</a><a href="#documents">Document register</a><a href="#correspondence">Correspondence queue</a></nav>
    {notice && <p role="status" className="notice">{notice}</p>}
    <section id="register"><h2>Register a document</h2><RegisterForm action={register} categories={categories} /></section>
    <section id="documents"><h2>Document register</h2>
      <form action="/#documents">
        <label>Search<input name="q" maxLength={200} defaultValue={search} placeholder="Title, division, file or reference" /></label>
        <label>Category<select name="category" defaultValue={category}><option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button>Apply filters</button><a href="/#documents">Clear filters</a>
      </form>
      <p>{documents.length} matching documents</p>
      <div className="table"><table><thead><tr>{['Reference', 'Title', 'Category', 'Division', 'Registered (UTC)', 'File'].map((item) =>
        <th key={item} scope="col">{item}</th>)}</tr></thead><tbody>
        {documents.map((item) => <tr key={item.id}><td>{reference(item.id)}</td><td>{item.title}</td>
          <td>{item.category}</td><td>{item.division}</td><td>{item.created}</td>
          <td><a href={'/documents/' + item.id}>{item.filename}</a></td></tr>)}
      </tbody></table></div>
    </section>
    <section id="correspondence"><h2>Correspondence queue</h2>
      <p>Record each office handoff here. Record external dispatch after sending the letter separately.</p>
      <div className="queues">{Object.entries(routes).map(([direction, route]) => {
        const records = cases.filter((item) => item.direction === direction);
        return <div key={direction}><h3>{direction === 'incoming' ? 'Incoming' : 'Outgoing'} · {records.length}</h3>
          {records.length === 0 && <p>No correspondence registered.</p>}
          {records.map((item) => <article key={item.id}>
            <h4>{reference(item.id)} · {item.title}</h4>
            <p>{direction === 'incoming' ? 'From' : 'To'} {item.agency}</p>
            <p><strong>{route.stages[item.stage]}</strong></p>
            <p><a href={'/documents/' + item.id}>Download correspondence</a></p>
            <details><summary>Routing history</summary><ol>{history.get(item.id).map((event) =>
              <li key={event.stage}>{route.stages[event.stage]} · {event.recorded} UTC</li>)}</ol></details>
            {route.actions[item.stage] && <form action={advance.bind(null, item.id, item.stage)}>
              <button>{route.actions[item.stage]}</button></form>}
          </article>)}
        </div>;
      })}</div>
    </section>
  </>;
}
