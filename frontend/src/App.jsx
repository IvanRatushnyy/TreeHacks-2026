import { useState, useRef, useCallback, useEffect } from 'react';
import HexiCore from './components/HexiCore';
import TranscriptionStream from './components/TranscriptionStream';
import InputArea from './components/InputArea';

export default function App() {
  /* ============================
   *  Voice-input state
   * ============================ */
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState('');

  // Refs to persist audio objects across renders without causing re-renders
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafIdRef = useRef(null);

  // HexiCore ref — exposes addContext(amount) and resetContext()
  const hexiRef = useRef(null);
  const wasListeningRef = useRef(false);
  const isTogglingRef = useRef(false); // debounce flag

  // When user stops listening, bump the context darkness
  useEffect(() => {
    if (wasListeningRef.current && !isListening) {
      hexiRef.current?.addContext(0.15);
    }
    wasListeningRef.current = isListening;
  }, [isListening]);

  /* ---------- Audio level loop ---------- */
  const startAudioLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      // RMS amplitude normalised to 0-1
      const rms =
        Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length) / 255;
      setAudioLevel(rms);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  /* ---------- Start listening ---------- */
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      startAudioLoop();
    } catch (err) {
      console.error('Microphone access denied or unavailable:', err);
    }
  }, [startAudioLoop]);

  /* ---------- Stop listening ---------- */
  const stopListening = useCallback(() => {
    // Cancel animation frame loop
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
    setIsListening(false);
  }, []);

  /* ---------- Toggle handler (passed to HexiCore) ---------- */
  const handleToggleListening = useCallback(() => {
    // Debounce: prevent rapid toggling (200ms minimum between clicks)
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setTimeout(() => { isTogglingRef.current = false; }, 200);

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* ===== MAIN CONTENT ===== */}
      <main
        className="flex flex-1 min-h-0 overflow-hidden"
        style={{
          border: '1px solid var(--border-medium)',
        }}
      >
        {/* ---------- DESKTOP: Left Panel (Hexi Visualization) ---------- */}
        <section
          className="hidden lg:flex flex-col items-center justify-center relative shrink-0"
          style={{
            width: '32%',
            backgroundColor: 'rgba(141, 169, 196, 0.01)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <HexiCore
            ref={hexiRef}
            isListening={isListening}
            audioLevel={audioLevel}
            onToggleListening={handleToggleListening}
          />
        </section>

        {/* ---------- DESKTOP: Right Panel (Transcription Stream) ---------- */}
        <section
          className="hidden lg:flex flex-col flex-1 min-w-0 relative"
          style={{ backgroundColor: 'var(--bg-panel-right)' }}
        >
          {/* Vertical divider line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px z-10"
            style={{ backgroundColor: 'var(--border-medium)' }}
          />

          {/* Scrollable chat content */}
          <div className="flex-1 overflow-y-auto px-12 py-10">
            <TranscriptionStream />
          </div>

          {/* Input area (pinned to bottom of right panel) */}
          <InputArea transcript={transcript} isListening={isListening} />
        </section>

        {/* ---------- MOBILE/TABLET: Full-screen centered layout ---------- */}
        <section className="flex lg:hidden flex-col flex-1 min-h-0 w-full relative">
          {/* Centered Hexi area */}
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(141, 169, 196, 0.01)' }}
          >
            <HexiCore
              ref={hexiRef}
              isListening={isListening}
              audioLevel={audioLevel}
              onToggleListening={handleToggleListening}
            />
          </div>

          {/* Mobile input area at bottom */}
          <InputArea transcript={transcript} isListening={isListening} />
        </section>
      </main>
    </div>
  );
}
