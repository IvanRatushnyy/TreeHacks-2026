import { useState } from 'react';

export default function StartScreen({ onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = (name || '').trim();
    const em = (email || '').trim();
    if (!n || !em) {
      setTouched(true);
      return;
    }
    onSubmit({ name: n, email: em });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-panel-right)' }}
    >
      <div
        className="rounded-xl bg-white shadow-lg flex flex-col w-full max-w-md p-8"
        style={{ border: '1px solid var(--border-medium)' }}
      >
        <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--regal-navy)' }}>
          Start a chat
        </h2>
        <p className="font-body text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Name and email are required before starting. Each chat is a new session.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="font-body font-medium block mb-1" style={{ fontSize: '13px', color: 'var(--text-heading)' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg font-body px-3 py-2"
              style={{
                border: `1px solid ${touched && !name.trim() ? '#dc2626' : 'var(--border-medium)'}`,
                fontSize: '14px',
              }}
            />
            {touched && !name.trim() && (
              <span className="font-body text-xs" style={{ color: '#dc2626' }}>Required</span>
            )}
          </div>
          <div>
            <label className="font-body font-medium block mb-1" style={{ fontSize: '13px', color: 'var(--text-heading)' }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg font-body px-3 py-2"
              style={{
                border: `1px solid ${touched && !email.trim() ? '#dc2626' : 'var(--border-medium)'}`,
                fontSize: '14px',
              }}
            />
            {touched && !email.trim() && (
              <span className="font-body text-xs" style={{ color: '#dc2626' }}>Required</span>
            )}
          </div>
          <button
            type="submit"
            className="font-body font-bold rounded-lg py-2.5 px-4 w-full"
            style={{
              backgroundColor: 'var(--regal-navy)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Start chat
          </button>
        </form>
      </div>
    </div>
  );
}
