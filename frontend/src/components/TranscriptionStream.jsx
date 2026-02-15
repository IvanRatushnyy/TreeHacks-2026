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
    <p
      className="font-body leading-relaxed"
      style={{
        color: '#133f72',
        fontSize: 'clamp(12px, 1.7vw, 24px)',
        lineHeight: '1.35',
      }}
    >
      {'Current medication confirmed: '}
      <span style={{ color: '#133f72' }}>
        Lisinopril 10mg
      </span>
      {' daily. Patient adheres'}
      <br />
      {'to schedule.'}
    </p>
  );
}

export default function TranscriptionStream() {
  return (
    <div className="flex flex-col w-full" style={{ gap: '31px' }}>
      {/* Header row: "Hexi" title left; Export label + icons right */}
      <div
        className="flex items-center justify-between"
        style={{
          paddingBottom: '17px',
          borderBottom: '1px solid var(--border-divider)',
        }}
      >
        {/* Title with logo — styled like footer vitals numbers */}
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

        {/* Export — label above, icons below, width aligned with icon span */}
        <div className="flex flex-col items-center shrink-0" style={{ gap: '4px' }}>
          <span
            className="font-display font-bold uppercase block"
            style={{
              color: 'var(--text-label)',
              fontSize: '12px',
              lineHeight: '16px',
              letterSpacing: '0.6px',
              width: '64px', // 22 + 10 + 22 + 10 = spans both icons + gap
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

      {/* Chat entries */}
      <div className="flex flex-col" style={{ gap: '23px' }}>
        {chatEntries.map((entry, idx) => (
          <div
            key={idx}
            className="flex flex-col"
            style={{
              gap: '6px',
              opacity: entry.active ? 1 : entry.isPlaceholder ? 1 : entry.opacity,
            }}
          >
            {/* Timestamp above — with indicator dot if active */}
            <div className="flex items-center" style={{ gap: '8px' }}>
              {entry.active && (
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'var(--regal-navy)',
                  }}
                />
              )}
              <span
                className="font-display"
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  color: entry.active ? '#133f72' : entry.isPlaceholder ? 'var(--text-muted)' : '#000000',
                  fontFamily: entry.isPlaceholder ? "'Liberation Mono', monospace" : undefined,
                }}
              >
                {entry.time}
              </span>
            </div>

            {/* Content below timestamp */}
            <div>
              {entry.active ? (
                <ActiveEntry />
              ) : (
                <p
                  className="font-body"
                  style={{
                    fontSize: 'clamp(12px, 1.7vw, 24px)',
                    lineHeight: '1.35',
                    color: entry.isPlaceholder ? 'var(--text-muted)' : '#000000',
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
