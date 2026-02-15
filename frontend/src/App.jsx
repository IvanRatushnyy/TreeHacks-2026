import { useState, useRef, useCallback, useEffect } from 'react';
import HexiCore from './components/HexiCore';
import TranscriptionStream from './components/TranscriptionStream';
import InputArea from './components/InputArea';
import { useVoiceSession } from './hooks/useVoiceSession';
import { chatComplete } from './api';

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  /* ============================
   *  File upload state
   * ============================ */
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  // Load file from localStorage on mount
  useEffect(() => {
    const storedFile = localStorage.getItem('hexi_uploaded_file');
    const storedContent = localStorage.getItem('hexi_file_content');
    if (storedFile) {
      try {
        const fileData = JSON.parse(storedFile);
        setUploadedFile(fileData);
        if (storedContent) setFileContent(storedContent);
      } catch (e) {
        console.error('[App] Failed to parse stored file:', e);
      }
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((file, content) => {
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
    setUploadedFile(fileData);
    setFileContent(content);
    localStorage.setItem('hexi_uploaded_file', JSON.stringify(fileData));
    if (content) localStorage.setItem('hexi_file_content', content);
  }, []);

  // Handle file removal
  const handleFileRemove = useCallback(() => {
    setUploadedFile(null);
    setFileContent(null);
    localStorage.removeItem('hexi_uploaded_file');
    localStorage.removeItem('hexi_file_content');
  }, []);

  /* ============================
   *  Conversation entries state
   * ============================ */
  const [conversationEntries, setConversationEntries] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handler for voice transcription entries
  const handleAddUserEntry = useCallback((entry) => {
    setConversationEntries((prev) => [
      ...prev,
      { ...entry, speaker: 'user' }
    ]);
  }, []);

  /* ============================
   *  Voice session hook
   * ============================ */
  const {
    isRecording,
    interimText,
    suggestions,
    complete,
    error: voiceError,
    startRecording,
    stopRecording,
    getTranscript,
    isSupported: isVoiceSupported,
  } = useVoiceSession({
    role: 'patient',
    onAddUserEntry: handleAddUserEntry,
  });

  /* ============================
   *  Audio visualization state
   * ============================ */
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafIdRef = useRef(null);

  // HexiCore ref — exposes addContext(amount) and resetContext()
  const hexiRef = useRef(null);
  const wasListeningRef = useRef(false);
  const isTogglingRef = useRef(false);

  // When user stops listening, bump the context darkness
  useEffect(() => {
    if (wasListeningRef.current && !isRecording) {
      hexiRef.current?.addContext(0.15);
    }
    wasListeningRef.current = isRecording;
  }, [isRecording]);

  /* ---------- Audio level loop ---------- */
  const startAudioLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length) / 255;
      setAudioLevel(rms);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  /* ---------- Start listening with audio visualization ---------- */
  const startListeningWithAudio = useCallback(async () => {
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

      startAudioLoop();
      startRecording();
    } catch (err) {
      console.error('Microphone access denied or unavailable:', err);
    }
  }, [startAudioLoop, startRecording]);

  /* ---------- Stop listening ---------- */
  const stopListeningWithAudio = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    stopRecording();
  }, [stopRecording]);

  /* ---------- Toggle handler ---------- */
  const handleToggleListening = useCallback(() => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setTimeout(() => { isTogglingRef.current = false; }, 200);

    if (isRecording) {
      stopListeningWithAudio();
    } else {
      startListeningWithAudio();
    }
  }, [isRecording, startListeningWithAudio, stopListeningWithAudio]);

  /* ---------- Send message handler ---------- */
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim()) return;

    // Add user message to conversation
    const userEntry = {
      id: Date.now(),
      time: formatTime(),
      text: message,
      speaker: 'user',
      isInterim: false,
    };
    setConversationEntries((prev) => [...prev, userEntry]);

    // Get AI response
    setIsProcessing(true);
    try {
      const fullTranscript = [...conversationEntries, userEntry]
        .filter(e => e.speaker === 'user')
        .map(e => e.text)
        .join('\n');
      
      const response = await chatComplete(fullTranscript);
      
      if (response?.suggested_note || response?.recommendations) {
        const aiText = [
          response.suggested_note,
          response.recommendations,
          response.remaining_gaps?.length ? `Remaining gaps: ${response.remaining_gaps.join('; ')}` : ''
        ].filter(Boolean).join('\n\n');

        const aiEntry = {
          id: Date.now() + 1,
          time: formatTime(),
          text: aiText,
          speaker: 'ai',
          isInterim: false,
        };
        setConversationEntries((prev) => [...prev, aiEntry]);
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [conversationEntries]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      stopListeningWithAudio();
    };
  }, [stopListeningWithAudio]);

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
            isListening={isRecording}
            audioLevel={audioLevel}
            onToggleListening={handleToggleListening}
          />
          {voiceError && (
            <p className="absolute bottom-4 text-red-500 text-sm px-4 text-center">
              {voiceError}
            </p>
          )}
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
          <div className="flex-1 overflow-y-auto px-12 py-10 relative">
            <TranscriptionStream 
              entries={conversationEntries}
              interimText={interimText}
              isRecording={isRecording}
              suggestions={suggestions}
            />
          </div>

          {/* Input area (pinned to bottom of right panel) */}
          <InputArea 
            isListening={isRecording}
            uploadedFile={uploadedFile}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
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
              isListening={isRecording}
              audioLevel={audioLevel}
              onToggleListening={handleToggleListening}
            />
          </div>

          {/* Mobile input area at bottom */}
          <InputArea 
            isListening={isRecording}
            uploadedFile={uploadedFile}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
        </section>
      </main>
    </div>
  );
}
