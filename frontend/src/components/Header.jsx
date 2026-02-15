/**
 * Logo mark: navy square with white hexagon overlay (creates bracket corners)
 * Exact SVG from Figma design
 */
function LogoMark({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <rect y="0.5" width="20" height="19" fill="#134074" />
      <path
        d="M9 0.57735C9.6188 0.220085 10.3812 0.220085 11 0.57735L17.6603 4.42265C18.2791 4.77992 18.6603 5.44017 18.6603 6.1547V13.8453C18.6603 14.5598 18.2791 15.2201 17.6603 15.5774L11 19.4226C10.3812 19.7799 9.6188 19.7799 9 19.4226L2.33975 15.5774C1.72094 15.2201 1.33975 14.5598 1.33975 13.8453V6.1547C1.33975 5.44017 1.72094 4.77992 2.33975 4.42265L9 0.57735Z"
        fill="white"
      />
    </svg>
  );
}

export default function Header() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white"
      style={{
        height: '64px',
        padding: '0 32px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo area */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        {/* Desktop: show logo mark */}
        <div className="hidden lg:block">
          <LogoMark />
        </div>

        {/* Brand name */}
        <span
          className="font-display font-medium capitalize"
          style={{
            color: '#0b1116',
            fontSize: '14px',
            lineHeight: '20px',
            letterSpacing: '-0.49px',
          }}
        >
          Hexi
        </span>
      </div>

      {/* Desktop navigation */}
      <nav className="hidden md:flex items-center" style={{ gap: '24px' }}>
        {['Dr. S. Vance', 'Settings', 'Logout'].map((item) => (
          <span
            key={item}
            className="font-body font-medium uppercase cursor-pointer"
            style={{
              color: 'var(--text-dim)',
              fontSize: '12px',
              lineHeight: '16px',
              letterSpacing: '0.3px',
            }}
          >
            {item}
          </span>
        ))}
      </nav>

      {/* Mobile: logo mark on the right */}
      <div className="flex md:hidden">
        <LogoMark />
      </div>
    </header>
  );
}
