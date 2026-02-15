/**
 * Vitals footer: bento-style equal-width cells. Each cell uses flex: 1 1 0%
 * so they share width equally and scale down when the footer is constrained.
 * Icons: Google Material Symbols (standardized).
 */
const vitals = [
  { label: 'Heart Rate', value: '88', unit: 'bpm' },
  { label: 'Blood Pressure', value: '120/80', unit: 'mmHg' },
  { label: 'Temp', value: '98.6', unit: '°F' },
  { label: 'SpO2', value: '99', unit: '%' },
];

export default function VitalsGrid() {
  return (
    <footer
      className="w-full bg-white hidden lg:flex shrink-0"
      style={{
        borderTop: '1px solid var(--border-medium)',
      }}
    >
      <div className="flex flex-1 items-stretch w-full min-w-0">
        {vitals.map((vital, idx) => (
          <div
            key={vital.label}
            className="flex flex-col justify-center min-w-0 flex-1"
            style={{
              flex: '1 1 0%',
              borderLeft: idx > 0 ? '1px solid var(--border-light)' : 'none',
              height: '95px',
              padding: '12px 16px',
              paddingLeft: idx > 0 ? '17px' : '24px',
            }}
          >
            {/* Label row */}
            <div style={{ marginBottom: '4px' }}>
              <span
                className="font-display font-bold uppercase truncate block"
                style={{
                  color: 'var(--text-label)',
                  fontSize: '12px',
                  lineHeight: '16px',
                  letterSpacing: '0.6px',
                  minWidth: 0,
                }}
              >
                {vital.label}
              </span>
            </div>

            {/* Value + unit row */}
            <div className="flex items-baseline min-w-0" style={{ gap: '4px' }}>
              <span
                className="font-body font-bold truncate"
                style={{
                  color: '#133f72',
                  fontSize: 'clamp(18px, 2.2vw, 30px)',
                  lineHeight: '36px',
                  letterSpacing: '-0.75px',
                }}
              >
                {vital.value}
              </span>
              <span
                className="font-body font-medium shrink-0"
                style={{
                  color: 'var(--text-label)',
                  fontSize: '14px',
                  lineHeight: '20px',
                }}
              >
                {vital.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
