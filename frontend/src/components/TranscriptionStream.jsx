import { useEffect, useRef } from 'react';

/**
 * TranscriptionStream — displays conversation entries with timestamps
 *
 * Props:
 *  - entries     (array)  : conversation entries [{ id, time, text, speaker, isInterim }]
 *  - interimText (string) : current interim transcription text
 *  - isRecording (bool)   : whether currently recording
 *  - suggestions (array)  : AI suggestions for missing info
 */
export default function TranscriptionStream({ 
  entries = [], 
  interimText = '',
  isRecording = false,
  suggestions = [],
}) {
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, interimText]);

  const hasContent = entries.length > 0 || interimText;

  // Group entries by minute - only show timestamp when minute changes
  const shouldShowTimestamp = (entry, index) => {
    if (index === 0) return true;
    const prevEntry = entries[index - 1];
    // Show timestamp if minute changed or speaker changed to AI
    return entry.time !== prevEntry.time || (entry.speaker === 'ai' && prevEntry.speaker !== 'ai');
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Header row: "Hexi" title left; Export label + icons right - ABSOLUTE POSITIONED */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between"
        style={{
          paddingBottom: '17px',
          borderBottom: '1px solid var(--border-divider)',
          backgroundColor: 'var(--bg-panel-right)',
        }}
      >
        {/* Title with logo */}
        <div className="flex items-center" style={{ gap: '10px' }}>
          <svg width="24" height="23" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
            <path d="M9.14941 0C9.09893 0.0237414 9.04883 0.0489571 9 0.0771484L2.33984 3.92285C1.72117 4.28005 1.33999 4.93993 1.33984 5.6543V13.3457C1.33999 14.0601 1.72117 14.7199 2.33984 15.0771L9 18.9229C9.04883 18.951 9.09893 18.9763 9.14941 19H0V0H9.14941ZM20 19H10.8506C10.9011 18.9763 10.9512 18.951 11 18.9229L17.6602 15.0771C18.2788 14.7199 18.66 14.0601 18.6602 13.3457V5.6543C18.66 4.93993 18.2788 4.28005 17.6602 3.92285L11 0.0771484C10.9512 0.0489571 10.9011 0.0237414 10.8506 0H20V19Z" fill="#133F72" />
          </svg>
          <span
            className="font-body font-bold truncate"
            style={{
              color: 'rgb(19, 63, 114)',
              fontSize: 'clamp(18px, 2.2vw, 30px)',
              lineHeight: '36px',
              letterSpacing: '-0.75px',
            }}
          >
            Hexi
          </span>
        </div>

        {/* Export — label above, icons below */}
        <div className="flex flex-col items-center shrink-0" style={{ gap: '4px' }}>
          <span
            className="font-display font-bold uppercase block"
            style={{
              color: 'var(--text-label)',
              fontSize: '12px',
              lineHeight: '16px',
              letterSpacing: '0.6px',
              width: '64px',
              textAlign: 'center',
            }}
          >
            Export
          </span>
          <div className="flex items-center" style={{ gap: '10px' }}>
            <span
              className="material-symbols-outlined cursor-pointer"
              style={{
                fontSize: '22px',
                color: 'var(--text-label)',
                lineHeight: 1,
              }}
              title="Export as PDF"
              aria-label="Export as PDF"
            >
              picture_as_pdf
            </span>
            <span
              className="material-symbols-outlined cursor-pointer"
              style={{
                fontSize: '22px',
                color: 'var(--text-label)',
                lineHeight: 1,
              }}
              title="Attach email"
              aria-label="Attach email"
            >
              attach_email
            </span>
          </div>
        </div>
      </div>

      {/* Spacer for absolute header */}
      <div style={{ height: '75px' }} />

      {/* Chat entries */}
      <div className="flex flex-col" style={{ gap: '12px' }}>
        {!hasContent && !isRecording && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px' }}
            >
              mic
            </span>
            <p
              className="font-body"
              style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '300px' }}
            >
              Click the hexagon to start recording, or type a message below
            </p>
          </div>
        )}

        {entries.map((entry, index) => {
          const showTimestamp = shouldShowTimestamp(entry, index);
          const isQuestion = entry.isQuestion;
          const isLiterature = entry.isLiterature;
          
          return (
            <div
              key={entry.id}
              className="flex flex-col"
              style={{ 
                gap: '6px',
              }}
            >
              {/* Timestamp with speaker indicator - only show when minute changes */}
              {showTimestamp && (
                <div className="flex items-center" style={{ gap: '8px' }}>
                  {entry.speaker === 'ai' && (
                    <span
                      className="rounded-full shrink-0"
                      style={{
                        width: '6px',
                        height: '6px',
                        backgroundColor: isQuestion ? '#F59E0B' : isLiterature ? '#22C55E' : 'var(--regal-navy)',
                      }}
                    />
                  )}
                  <span
                    className="font-display"
                    style={{
                      fontSize: '12px',
                      lineHeight: '16px',
                      color: entry.speaker === 'ai' ? '#133f72' : '#6b7280',
                    }}
                  >
                    {entry.time}
                    {entry.speaker === 'ai' && (isQuestion ? ' • Question' : isLiterature ? ' • Research' : ' • Hexi')}
                  </span>
                </div>
              )}

              {/* Question Card styling */}
              {isQuestion ? (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B" className="shrink-0 mt-0.5">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                    </svg>
                    <p
                      className="font-body leading-relaxed"
                      style={{
                        fontSize: 'clamp(13px, 1.6vw, 20px)',
                        lineHeight: '1.4',
                        color: '#92400E',
                        fontWeight: 500,
                      }}
                    >
                      {entry.text.trim()}
                    </p>
                  </div>
                </div>
              ) : isLiterature ? (
                /* Literature Card styling */
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.06)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#22C55E" className="shrink-0 mt-0.5">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    <div
                      className="font-body leading-relaxed"
                      style={{
                        fontSize: 'clamp(12px, 1.5vw, 18px)',
                        lineHeight: '1.5',
                        color: '#15803D',
                      }}
                    >
                      {/* Parse markdown-style content */}
                      {entry.text.split('\n').map((line, i) => {
                        if (line.startsWith('📚 **')) {
                          const title = line.replace('📚 **Research Finding**: ', '').replace('**', '');
                          return <h4 key={i} className="font-semibold mb-2">{title}</h4>;
                        } else if (line.startsWith('• ')) {
                          return <p key={i} className="ml-2">{line}</p>;
                        } else if (line.startsWith('_Source:')) {
                          return <p key={i} className="text-xs mt-2 opacity-70 italic">{line.replace(/_/g, '')}</p>;
                        } else {
                          return <p key={i}>{line}</p>;
                        }
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard message */
                <p
                  className="font-body leading-relaxed"
                  style={{
                    fontSize: 'clamp(12px, 1.7vw, 24px)',
                    lineHeight: '1.35',
                    color: entry.speaker === 'ai' ? '#133f72' : '#000000',
                    whiteSpace: 'pre-wrap',
                    margin: '0',
                    padding: '0',
                  }}
                >
                  {entry.text.trim()}
                </p>
              )}
            </div>
          );
        })}

        {/* Interim text (currently being spoken) */}
        {interimText && (
          <div className="flex flex-col" style={{ gap: '6px', opacity: 0.6 }}>
            <span
              className="font-display"
              style={{
                fontSize: '12px',
                lineHeight: '16px',
                color: '#133f72',
              }}
            >
              ...
            </span>
            <p
              className="font-body leading-relaxed italic"
              style={{
                fontSize: 'clamp(12px, 1.7vw, 24px)',
                lineHeight: '1.35',
                color: '#133f72',
                margin: '0',
                padding: '0',
              }}
            >
              {interimText.trim()}
            </p>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && !interimText && entries.length > 0 && (
          <div className="flex items-center" style={{ gap: '8px' }}>
            <span
              className="rounded-full shrink-0 animate-pulse"
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: 'var(--regal-navy)',
              }}
            />
            <span
              className="font-display"
              style={{
                fontSize: '12px',
                lineHeight: '16px',
                color: 'var(--text-muted)',
                fontFamily: "'Liberation Mono', monospace",
              }}
            >
              Listening...
            </span>
          </div>
        )}

        {/* Suggestions from AI */}
        {suggestions.length > 0 && (
          <div
            className="mt-4 p-4 rounded-lg"
            style={{
              backgroundColor: 'rgba(19, 64, 116, 0.05)',
              border: '1px solid rgba(19, 64, 116, 0.1)',
            }}
          >
            <p
              className="font-display font-bold uppercase mb-2"
              style={{
                fontSize: '11px',
                color: 'var(--text-label)',
                letterSpacing: '0.5px',
              }}
            >
              Suggested Questions
            </p>
            <ul className="space-y-2">
              {suggestions.map((sug, idx) => (
                <li
                  key={idx}
                  className="font-body"
                  style={{
                    fontSize: '14px',
                    color: 'var(--text-body-dark)',
                  }}
                >
                  • {sug.question}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
