import Header from './components/Header';
import HexiCore from './components/HexiCore';
import TranscriptionStream from './components/TranscriptionStream';
import InputArea from './components/InputArea';
import VitalsGrid from './components/VitalsGrid';

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* ===== HEADER ===== */}
      <Header />

      {/* ===== MAIN CONTENT ===== */}
      <main
        className="flex flex-1 min-h-0 overflow-hidden"
        style={{
          marginTop: '64px',
          border: '1px solid var(--border-medium)',
        }}
      >
        {/* ---------- DESKTOP: Left Panel (Hexi Visualization) ---------- */}
        <section
          className="hidden lg:flex flex-col items-center justify-center relative shrink-0"
          style={{
            width: '40%',
            backgroundColor: 'rgba(141, 169, 196, 0.01)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <HexiCore statusText="Verifying Context..." size="large" />
        </section>

        {/* ---------- DESKTOP: Right Panel (Transcription Stream) ---------- */}
        <section
          className="hidden lg:flex flex-col flex-1 min-w-0 relative"
          style={{ backgroundColor: 'var(--bg-panel-right)' }}
        >
          {/* Vertical divider line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px z-10"
            style={{ backgroundColor: 'var(--border-subtle)' }}
          />

          {/* Scrollable chat content */}
          <div className="flex-1 overflow-y-auto px-12 py-10">
            <TranscriptionStream />
          </div>

          {/* Input area (pinned to bottom of right panel) */}
          <InputArea />
        </section>

        {/* ---------- MOBILE/TABLET: Full-screen centered layout ---------- */}
        <section className="flex lg:hidden flex-col flex-1 min-h-0 w-full relative">
          {/* Centered Hexi area */}
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(141, 169, 196, 0.01)' }}
          >
            <HexiCore statusText="Hello There!" size="large" />
          </div>

          {/* Mobile input area at bottom */}
          <InputArea />
        </section>
      </main>

      {/* ===== FOOTER: Vitals Grid (Desktop only) ===== */}
      <VitalsGrid />
    </div>
  );
}
