const chatEntries = [
  {
    time: '10:02',
    text: 'Patient entered room, complaining of mild dizziness upon standing.',
    opacity: 0.4,
  },
  {
    time: '10:03',
    text: 'Initial observation indicates pale complexion. No visible tremors.',
    opacity: 0.4,
  },
  {
    time: '10:04',
    text: 'Patient reports history of mild tachycardia. Last episode was two months ago.',
    opacity: 0.6,
  },
  {
    time: '10:05',
    text: null, // Active highlighted item
    active: true,
  },
  {
    time: '10:05',
    text: 'Denies history of smoking. Occasional alcohol consumption (socially).',
    opacity: 1,
    timeColor: '#6b7280', // darker timestamp for more recent entry
  },
  {
    time: '...',
    text: 'Listening for vitals...',
    isPlaceholder: true,
  },
];

function ActiveEntry() {
  return (
    <div
      className="bg-white rounded-sm"
      style={{
        borderLeft: '2px solid var(--regal-navy)',
        boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
        padding: '15px 18px',
      }}
    >
      <p
        className="font-body leading-relaxed"
        style={{ color: 'var(--text-heading)', fontSize: '14px', lineHeight: '22.75px' }}
      >
        {'Current medication confirmed: '}
        <span
          className="inline-block px-1"
          style={{
            backgroundColor: 'rgba(19, 64, 116, 0.1)',
            color: 'var(--regal-navy)',
          }}
        >
          Lisinopril 10mg
        </span>
        {' daily. Patient adheres'}
        <br />
        {'to schedule.'}
      </p>
    </div>
  );
}

export default function TranscriptionStream() {
  return (
    <div className="flex flex-col w-full" style={{ gap: '31px' }}>
      {/* Header row */}
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
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          REC: 00:04:12
        </span>
      </div>

      {/* Chat entries */}
      <div className="flex flex-col" style={{ gap: '23px' }}>
        {chatEntries.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-start"
            style={{
              gap: '16px',
              opacity: entry.active ? 1 : entry.isPlaceholder ? 1 : entry.opacity,
            }}
          >
            {/* Indicator dot + timestamp column */}
            <div
              className="flex items-start shrink-0 relative"
              style={{ width: '56px', paddingTop: entry.active ? '1px' : '0' }}
            >
              {entry.active && (
                <span
                  className="absolute rounded-full shrink-0"
                  style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'var(--regal-navy)',
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
                  color: entry.active ? 'var(--regal-navy)' : entry.timeColor || 'var(--text-muted)',
                  fontFamily: entry.isPlaceholder ? "'Liberation Mono', monospace" : undefined,
                }}
              >
                {entry.time}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {entry.active ? (
                <ActiveEntry />
              ) : (
                <p
                  className="font-body"
                  style={{
                    fontSize: '14px',
                    lineHeight: '22.75px',
                    color: entry.isPlaceholder
                      ? 'var(--text-muted)'
                      : entry.opacity >= 0.6
                        ? 'var(--text-body-dark)'
                        : 'var(--text-body)',
                  }}
                >
                  {entry.text}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
