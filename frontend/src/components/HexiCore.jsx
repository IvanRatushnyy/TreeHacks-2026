export default function HexiCore({ statusText = 'Verifying Context...', size = 'large' }) {
  const isLarge = size === 'large';
  const hexSize = isLarge ? 232 : 150;
  const ringScale = isLarge ? 1 : 0.65;

  return (
    <div className="flex flex-col items-center justify-center relative">
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

      {/* Hexagon with radial gradient + microphone (exact Figma SVG) */}
      <div className="relative z-10" style={{ width: hexSize, height: hexSize }}>
        <svg
          width={hexSize}
          height={hexSize}
          viewBox="0 0 231.5 231.5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* Exact radial gradient from Figma */}
            <radialGradient
              id="hexiRadialGradient"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(188.402 54.4887) rotate(125.87) scale(197.544 349.302)"
            >
              <stop stopColor="#0B2545" />
              <stop offset="0.158762" stopColor="#134074" />
              <stop offset="1" stopColor="#8DA9C4" />
            </radialGradient>
          </defs>

          {/* Hexagon path (exact from Figma) */}
          <path
            d="M90.75 14.4338C106.22 5.50212 125.28 5.50212 140.75 14.4338L190.992 43.4412C206.462 52.3729 215.992 68.8792 215.992 86.7425V144.757C215.992 162.621 206.462 179.127 190.992 188.059L140.75 217.066C125.28 225.998 106.22 225.998 90.75 217.066L40.5076 188.059C25.0375 179.127 15.5076 162.621 15.5076 144.757L15.5076 86.7425C15.5076 68.8792 25.0375 52.3729 40.5076 43.4412L90.75 14.4338Z"
            fill="url(#hexiRadialGradient)"
          />

          {/* Microphone icon (exact from Figma) */}
          <g>
            <mask id="micMask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="100" y="105" width="32" height="32">
              <rect x="100.358" y="105.283" width="30.7846" height="30.7846" fill="#D9D9D9" />
            </mask>
            <g mask="url(#micMask)">
              <path
                d="M113.024 122.119C112.276 121.37 111.902 120.462 111.902 119.393V111.697C111.902 110.628 112.276 109.719 113.024 108.971C113.773 108.223 114.681 107.849 115.75 107.849C116.819 107.849 117.727 108.223 118.476 108.971C119.224 109.719 119.598 110.628 119.598 111.697V119.393C119.598 120.462 119.224 121.37 118.476 122.119C117.727 122.867 116.819 123.241 115.75 123.241C114.681 123.241 113.773 122.867 113.024 122.119ZM114.467 132.22V128.275C112.244 127.976 110.405 126.982 108.952 125.293C107.498 123.604 106.771 121.638 106.771 119.393H109.337C109.337 121.167 109.962 122.68 111.212 123.93C112.463 125.181 113.976 125.806 115.75 125.806C117.524 125.806 119.037 125.181 120.288 123.93C121.538 122.68 122.163 121.167 122.163 119.393H124.729C124.729 121.638 124.002 123.604 122.548 125.293C121.095 126.982 119.256 127.976 117.033 128.275V132.22H114.467ZM116.664 120.307C116.91 120.061 117.033 119.756 117.033 119.393V111.697C117.033 111.333 116.91 111.029 116.664 110.783C116.418 110.537 116.113 110.414 115.75 110.414C115.387 110.414 115.082 110.537 114.836 110.783C114.59 111.029 114.467 111.333 114.467 111.697V119.393C114.467 119.756 114.59 120.061 114.836 120.307C115.082 120.553 115.387 120.676 115.75 120.676C116.113 120.676 116.418 120.553 116.664 120.307Z"
                fill="white"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Status text */}
      <div
        className="font-display text-center capitalize mt-2 relative z-10"
        style={{
          color: 'var(--regal-navy)',
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '2.1px',
        }}
      >
        {statusText}
      </div>
    </div>
  );
}
