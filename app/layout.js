import './style.css';

export const metadata = { title: 'DPM Document Management', robots: { index: false, follow: false } };

export default function Layout({ children }) {
  return <html lang="en"><body>
    <header><div><small>DEPARTMENT OF PERSONNEL MANAGEMENT · LOCAL PILOT</small><h1>Document Management System</h1></div></header>
    <main>{children}</main>
  </body></html>;
}
