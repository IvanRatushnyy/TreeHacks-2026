import { useCallback } from 'react';

const DISCLAIMER = 'This is not medical advice. Always consult a qualified healthcare provider for diagnosis and treatment.';

export default function PatientSummaryModal({ summary, sessionId, onClose, onNewChat, transcriptWithSpeakers = '' }) {
  const handleExport = useCallback(() => {
    const parts = [`Summary\n${'='.repeat(40)}\n\n${summary || ''}`];
    if (transcriptWithSpeakers) {
      parts.push(`\n\nTranscript (by speaker)\n${'='.repeat(40)}\n\n${transcriptWithSpeakers}`);
    }
    const body = parts.join('');
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${sessionId || 'session'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [summary, sessionId, transcriptWithSpeakers]);

  const handleCopy = useCallback(() => {
    if (summary) navigator.clipboard.writeText(summary);
  }, [summary]);

  const handleSendToDoctor = useCallback(() => {
    const subject = encodeURIComponent('Patient summary from Hexi');
    const body = encodeURIComponent(summary || '');
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }, [summary]);

  if (!summary) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl bg-white shadow-lg flex flex-col max-h-[85vh] w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: '1px solid var(--border-medium)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="font-display font-bold" style={{ fontSize: '16px', color: 'var(--regal-navy)' }}>
            Your summary
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none p-1 opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="font-body whitespace-pre-wrap" style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--text-body-dark)' }}>
            {summary}
          </p>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t flex-wrap" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={handleExport}
            className="font-body font-bold rounded-lg px-4 py-2"
            style={{ backgroundColor: 'var(--regal-navy)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Export (.txt)
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="font-body font-bold rounded-lg px-4 py-2"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--regal-navy)', border: '1px solid var(--border-medium)', cursor: 'pointer', fontSize: '13px' }}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={handleSendToDoctor}
            className="font-body font-bold rounded-lg px-4 py-2"
            style={{ backgroundColor: 'var(--regal-navy)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            Send to doctor
          </button>
          {onNewChat && (
            <button
              type="button"
              onClick={() => { onNewChat(); onClose(); }}
              className="font-body font-bold rounded-lg px-4 py-2"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--regal-navy)', border: '1px solid var(--border-medium)', cursor: 'pointer', fontSize: '13px' }}
            >
              New chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
