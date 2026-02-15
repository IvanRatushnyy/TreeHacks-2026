export default function HexiCore({ statusText = 'Verifying Context...', size = 'large', isRecording = false }) {
  const isLarge = size === 'large';
  const hexSize = isLarge ? 232 : 150;
  const ringScale = isLarge ? 1 : 0.65;

  return (
    <div
      className="flex flex-col items-center justify-center relative"
      style={{
        outline: isRecording ? '3px solid #dc2626' : 'none',
        outlineOffset: '8px',
        borderRadius: '8px',
      }}
    >
      {/* Concentric Rings (from Figma: #133F72 at 15% opacity) */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: `${360 * ringScale}px`,
          height: `${360 * ringScale}px`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -48%)',
        }}
      >
        {/* Outer ring (360px) */}
        <svg
          width={360 * ringScale}
          height={360 * ringScale}
          viewBox="0 0 360 360"
          fill="none"
          className="absolute"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <circle cx="180" cy="180" r="179" stroke="#133F72" strokeOpacity="0.15" strokeWidth="1" />
        </svg>
        {/* Middle ring (300px) */}
        <svg
          width={300 * ringScale}
          height={300 * ringScale}
          viewBox="0 0 300 300"
          fill="none"
          className="absolute"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <circle cx="150" cy="150" r="149" stroke="#133F72" strokeOpacity="0.15" strokeWidth="1" />
        </svg>
        {/* Inner ring (240px) */}
        <svg
          width={240 * ringScale}
          height={240 * ringScale}
          viewBox="0 0 240 240"
          fill="none"
          className="absolute"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <circle cx="120" cy="120" r="119.5" stroke="#133F72" strokeOpacity="0.15" strokeWidth="1" />
        </svg>
      </div>

      {/* Status text */}
      <span
        className="font-display text-center"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '2.1px',
          color: 'var(--regal-navy)',
          marginTop: '8px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
