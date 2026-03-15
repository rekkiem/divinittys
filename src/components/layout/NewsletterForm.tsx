'use client';

import { FormEvent, useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      });
      if (!res.ok) throw new Error();
      setStatus('ok');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="text-sm text-charcoal-300">Newsletter</label>
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="tu@email.com"
          className="flex-1 px-3 py-2 rounded-lg bg-charcoal-500 border border-charcoal-400 text-sm"
        />
        <button className="px-3 py-2 rounded-lg bg-primary-500 text-white text-sm" disabled={status === 'loading'}>
          Suscribir
        </button>
      </div>
      {status === 'ok' && <p className="text-xs text-green-300">¡Gracias por suscribirte!</p>}
      {status === 'error' && <p className="text-xs text-rose-300">No pudimos procesar tu solicitud.</p>}
    </form>
  );
}
