'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Registering…' : 'Register document'}</button>;
}

export default function RegisterForm({ action, categories }) {
  const [direction, setDirection] = useState('');
  return <form action={action}>
    <label>Route<select name="direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
      <option value="">General register</option>
      <option value="incoming">Incoming · Agency → Secretary → Payroll</option>
      <option value="outgoing">Outgoing · Payroll → Secretary → Agency</option>
    </select></label>
    <label>Title<input name="title" maxLength={160} required /></label>
    {direction ? <label>{direction === 'incoming' ? 'Sending agency' : 'Receiving agency'}
      <input key={direction} name="agency" maxLength={160} required />
    </label> : <>
      <label>Division<input name="division" maxLength={100} required /></label>
      <label>Category<select name="category">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
    </>}
    <label>File (up to 10 MiB)<input name="file" type="file" required /></label>
    <Submit />
  </form>;
}
