import { useRef, useEffect } from 'react';

function ChatEntry({ entry, isActive }) {
  const speakerLabel = entry.speaker === 'ai' ? 'AI' : 'Practitioner';
  const isAi = entry.speaker === 'ai';
  return (
    <div
      className="flex items-start"
      style={{
        gap: '16px',
        opacity: entry.isInterim ? 0.85 : 1,
      }}
    >
      <div
        className="flex items-start shrink-0 relative"
        style={{ width: '56px', paddingTop: isActive ? '1px' : '0' }}
      >
        {isActive && (
          <span
            className="absolute rounded-full shrink-0"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: isAi ? 'var(--regal-navy)' : 'var(--regal-navy)',
              left: '-5px',
              top: '9px',
            }}
          />
        )}
        <span
          className="font-display"
          style={{
            fontSize: '12px',
            lineHeight: '16px',
            paddingTop: '4px',
            color: isActive ? 'var(--regal-navy)' : 'var(--text-muted)',
          }}
        >
          {entry.time}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="font-body font-bold"
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isAi ? 'var(--regal-navy)' : 'var(--text-muted)',
            display: 'block',
            marginBottom: '2px',
          }}
        >
          {speakerLabel}
        </span>
        <p
          className="font-body"
          style={{
            fontSize: '14px',
            lineHeight: '22.75px',
            color: entry.isInterim ? 'var(--text-muted)' : 'var(--text-body-dark)',
            fontStyle: entry.isInterim ? 'italic' : 'normal',
            ...(isAi && entry.complete ? { fontWeight: 600, color: 'var(--regal-navy)' } : {}),
          }}
        >
          {entry.text}
        </p>
      </div>
    </div>
  );
}

function SuggestionBlock({ suggestion }) {
  return (
    <div
      className="rounded-sm"
      style={{
        borderLeft: '2px solid var(--regal-navy)',
        backgroundColor: 'rgba(19, 64, 116, 0.06)',
        padding: '12px 16px',
        marginTop: '4px',
      }}
    >
      <p className="font-body" style={{ fontSize: '13px', color: 'var(--text-heading)', marginBottom: '4px' }}>
        {suggestion.question}
      </p>
      {suggestion.rationale && (
        <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {suggestion.rationale}
        </p>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TranscriptionStream({
  entries = [],
  interimText = '',
  suggestions = [],
  basis = '',
  complete = false,
  isRecording = false,
  recordingDuration = 0,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, suggestions, complete]);

  const hasLiveContent = entries.length > 0 || isRecording;

  return (
    <div className="flex flex-col w-full" style={{ gap: '31px' }}>
      <div
        className="flex items-center justify-between"
        style={{
          paddingBottom: '17px',
          borderBottom: '1px solid var(--border-divider)',
        }}
      >
        <span
          className="font-body font-bold uppercase"
          style={{
            color: 'var(--text-muted)',
            fontSize: '12px',
            letterSpacing: '1.8px',
          }}
        >
          Live Chat
        </span>
        <span
          className="font-display"
          style={{
            color: isRecording ? 'var(--regal-navy)' : 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          {isRecording ? `REC: ${formatDuration(recordingDuration)}` : complete ? 'Complete' : (hasLiveContent ? 'Paused' : '—')}
        </span>
      </div>

      <div ref={scrollRef} className="flex flex-col overflow-y-auto flex-1 min-h-0" style={{ gap: '23px' }}>
        {entries.map((entry, idx) => (
          <ChatEntry
            key={entry.id || idx}
            entry={entry}
            isActive={idx === entries.length - 1 && !entry.isInterim}
          />
        ))}
        {isRecording && entries.length === 0 && !interimText && (
          <p className="font-body" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Listening... AI is always recording. Doctor takes precedence.
          </p>
        )}
        {isRecording && interimText && (
          <p className="font-body italic" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {interimText}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-col" style={{ gap: '8px', marginTop: '8px' }}>
            <span
              className="font-body font-bold"
              style={{ fontSize: '12px', color: 'var(--regal-navy)', textTransform: 'uppercase' }}
            >
              Follow-up questions
            </span>
            {suggestions.map((s, i) => (
              <SuggestionBlock key={i} suggestion={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
