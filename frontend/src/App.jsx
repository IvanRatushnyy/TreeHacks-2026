import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import HexiCore from './components/HexiCore';
import TranscriptionStream from './components/TranscriptionStream';
import InputArea from './components/InputArea';
import VitalsGrid from './components/VitalsGrid';
import PatientSummaryModal from './components/PatientSummaryModal';
import StartScreen from './components/StartScreen';
import { useVoiceSession } from './hooks/useVoiceSession';
import { chatComplete, putSummary, persistSummary, getTtsAudio, documentsAnalyze, documentsComplete } from './api';

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Prefer a more natural-sounding voice; slightly slower rate to sound less robotic. */
function speakWithBrowserTTS(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  u.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const preferred = voices.find((v) => /Google|Samantha|Karen|Daniel|Microsoft|Natural|Premium/i.test(v.name))
      || voices.find((v) => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;
  }
  window.speechSynthesis.speak(u);
}

function SpeakerIconSmall({ muted }) {
  if (muted) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export default function App() {
  const [userStarted, setUserStarted] = useState(null);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [summaryInsights, setSummaryInsights] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [documentGaps, setDocumentGaps] = useState(null);
  const [completingDocument, setCompletingDocument] = useState(false);
  const sessionIdRef = useRef(`session-${Date.now()}`);
  const seqRef = useRef(0);
  const lastSpokenRef = useRef('');
  const audioRef = useRef(null);

  const onAddUserEntry = useCallback((entry) => {
    seqRef.current += 1;
    setConversation((prev) => [...prev, { ...entry, seq: seqRef.current, speaker: 'practitioner' }]);
  }, []);

  const onValidateResponse = useCallback((data) => {
    const text = data.complete ? (data.basis || 'Session complete. No further follow-ups needed.') : (data.suggestions || []).map((s) => s.question).join('\n');
    seqRef.current += 1;
    setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text, speaker: 'ai', complete: data.complete, seq: seqRef.current }]);
  }, []);

  const {
    isRecording,
    interimText,
    suggestions,
    basis,
    complete,
    error: voiceError,
    recordingDuration,
    getTranscript,
    validateTranscript,
    startRecording,
    stopRecording,
    isSupported: isVoiceSupported,
  } = useVoiceSession({
    role: 'practitioner',
    onValidateResponse,
    onAddUserEntry,
  });

  const getFullTranscript = useCallback(() => {
    return conversation.filter((e) => e.speaker !== 'ai').map((e) => e.text).filter(Boolean).join('\n');
  }, [conversation]);

  const onAttachDocument = useCallback(
    async (file) => {
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.txt')) {
        try {
          const text = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result ?? '');
            r.onerror = () => reject(new Error('Failed to read file'));
            r.readAsText(file);
          });
          setDocumentText(text);
          setAttachedFile(file);
          setDocumentGaps(null);
          const out = await documentsAnalyze(text);
          if (out.error) {
            seqRef.current += 1;
            setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: `Document analysis failed: ${out.error}`, speaker: 'ai', seq: seqRef.current }]);
            return;
          }
          setDocumentGaps(out.gaps || []);
          const gapQuestions = (out.gaps || []).map((g) => g.question);
          if (gapQuestions.length > 0) {
            seqRef.current += 1;
            const msg = `Document attached. Missing information (ask these to complete the note):\n\n${gapQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
            setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: msg, speaker: 'ai', seq: seqRef.current }]);
          } else {
            seqRef.current += 1;
            setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: (out.summary || 'Document meets our format; no gaps found.'), speaker: 'ai', seq: seqRef.current }]);
          }
        } catch (e) {
          seqRef.current += 1;
          setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: `Could not analyze document: ${e.message}`, speaker: 'ai', seq: seqRef.current }]);
        }
      } else if (name.endsWith('.pdf')) {
        seqRef.current += 1;
        setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: 'PDF not supported. Please use a .txt file or paste the note as text.', speaker: 'ai', seq: seqRef.current }]);
      } else {
        setAttachedFile(file);
        setDocumentText('');
        setDocumentGaps(null);
      }
    },
    []
  );

  const onClearAttachment = useCallback(() => {
    setAttachedFile(null);
    setDocumentText('');
    setDocumentGaps(null);
  }, []);

  const onCompleteDocument = useCallback(async () => {
    if (!documentText.trim()) return;
    setCompletingDocument(true);
    try {
      const transcript = getFullTranscript();
      const out = await documentsComplete(documentText, transcript);
      if (out.error) {
        seqRef.current += 1;
        setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: `Complete failed: ${out.error}`, speaker: 'ai', seq: seqRef.current }]);
        return;
      }
      const completed = out.completed_document || documentText;
      seqRef.current += 1;
      setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: `Completed document:\n\n${completed}`, speaker: 'ai', isCompletedDoc: true, seq: seqRef.current }]);
      onClearAttachment();
    } catch (e) {
      seqRef.current += 1;
      setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: `Could not complete document: ${e.message}`, speaker: 'ai', seq: seqRef.current }]);
    } finally {
      setCompletingDocument(false);
    }
  }, [documentText, getFullTranscript, onClearAttachment]);

  useEffect(() => {
    if (!suggestions?.length) {
      lastSpokenRef.current = '';
      return;
    }
    if (!speakerOn) return;
    const text = suggestions.map((s) => s.question).join('. ');
    if (text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;
    let cancelled = false;
    getTtsAudio(text).then((blob) => {
      if (cancelled || !blob) {
        speakWithBrowserTTS(text);
        return;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (_) {}
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => speakWithBrowserTTS(text));
    }).catch(() => speakWithBrowserTTS(text));
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [speakerOn, suggestions]);

  const handleSendText = useCallback(
    (text) => {
      const t = text.trim();
      if (!t) return;
      seqRef.current += 1;
      setConversation((prev) => {
        const next = [...prev, { id: Date.now(), time: formatTime(), text: t, isInterim: false, speaker: 'practitioner', seq: seqRef.current }];
        const full = getTranscript() + '\n' + next.filter((e) => e.speaker !== 'ai').map((e) => e.text).join('\n');
        setTimeout(() => validateTranscript(full), 0);
        return next;
      });
    },
    [getTranscript, validateTranscript]
  );

  const combinedEntries = [...conversation].sort((a, b) => (a.seq || 0) - (b.seq || 0));

  const handleStopWithInsights = useCallback(async () => {
    stopRecording();
    const fromConversation = getFullTranscript();
    const voiceRemaining = (getTranscript() || '').trim();
    const full = voiceRemaining ? [voiceRemaining, fromConversation].filter(Boolean).join('\n\n') : fromConversation;
    if (!full.trim()) return;
    try {
      const out = await chatComplete(full);
      const note = out?.suggested_note || '';
      const rec = out?.recommendations || '';
      const gaps = out?.remaining_gaps || [];
      seqRef.current += 1;
      const insightText = [note, rec, gaps.length ? `Remaining gaps: ${gaps.join('; ')}` : ''].filter(Boolean).join('\n\n');
      setConversation((prev) => [...prev, { id: Date.now(), time: formatTime(), text: insightText, speaker: 'ai', complete: true, isSummaryInsight: true, seq: seqRef.current }]);
      setSummaryInsights({ note, recommendations: rec, remaining_gaps: gaps });
    } catch (_) {}
  }, [stopRecording, getFullTranscript, getTranscript]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) handleStopWithInsights();
    else startRecording();
  }, [isRecording, startRecording, handleStopWithInsights]);

  const handleGenerateSummary = useCallback(async () => {
    const fullTranscript = getFullTranscript();
    if (!fullTranscript.trim()) return;
    setGeneratingSummary(true);
    try {
      const out = await chatComplete(fullTranscript);
      const note = out?.suggested_note || '';
      const rec = out?.recommendations || '';
      const sid = sessionIdRef.current;
      await putSummary(sid, note);
      try {
        await persistSummary(sid);
      } catch (_) {}
      setSummaryDoc(rec ? `${note}\n\nRecommendations: ${rec}` : note);
      setSummaryInsights({ note, recommendations: rec, remaining_gaps: out?.remaining_gaps || [] });
    } catch (e) {
      setSummaryDoc(`Error: ${e.message}`);
    } finally {
      setGeneratingSummary(false);
    }
  }, [getFullTranscript]);

  const handleNewChat = useCallback(() => {
    setConversation([]);
    setSummaryDoc(null);
    setSummaryInsights(null);
    setAttachedFile(null);
    setDocumentText('');
    setDocumentGaps(null);
    sessionIdRef.current = `session-${Date.now()}`;
    seqRef.current = 0;
  }, []);

  if (!userStarted) {
    return <StartScreen onSubmit={setUserStarted} />;
  }

  const statusText = isRecording ? 'Listening...' : 'Ready To Help!';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      <Header />

      <main
        className="flex flex-1 min-h-0 overflow-hidden"
        style={{
          border: '1px solid var(--border-medium)',
        }}
      >
        <section
          className="hidden lg:flex flex-col items-center justify-center relative shrink-0"
          style={{
            width: '32%',
            backgroundColor: 'rgba(141, 169, 196, 0.01)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={!isVoiceSupported}
            className="flex flex-col items-center justify-center w-full h-full cursor-pointer border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-regal-navy disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minHeight: '280px' }}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <HexiCore statusText={statusText} size="large" isRecording={isRecording} />
          </button>
          <div className="absolute bottom-4 left-4 z-10">
            <button
              type="button"
              onClick={() => setSpeakerOn((v) => !v)}
              className="flex items-center justify-center rounded-lg border transition-all"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: speakerOn ? 'var(--regal-navy)' : 'var(--bg-input)',
                color: speakerOn ? 'white' : 'var(--text-muted)',
                borderColor: 'var(--border-medium)',
                cursor: 'pointer',
              }}
              title={speakerOn ? 'Speaker on' : 'Speaker off'}
            >
              <SpeakerIconSmall muted={!speakerOn} />
            </button>
          </div>
        </section>

        <section
          className="hidden lg:flex flex-col flex-1 min-w-0 relative"
          style={{ backgroundColor: 'var(--bg-panel-right)' }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-px z-10"
            style={{ backgroundColor: 'var(--border-medium)' }}
          />

          <div className="flex-1 overflow-y-auto px-12 py-10">
            <TranscriptionStream
              entries={combinedEntries}
              interimText={interimText}
              suggestions={suggestions}
              basis={basis}
              complete={complete}
              isRecording={isRecording}
              recordingDuration={recordingDuration}
            />
          </div>

          <InputArea
            voiceError={voiceError}
            onGenerateSummary={handleGenerateSummary}
            onSendText={handleSendText}
            generatingSummary={generatingSummary}
            onAttachDocument={onAttachDocument}
            attachedFile={attachedFile}
            onClearAttachment={onClearAttachment}
            documentGaps={documentGaps}
            onCompleteDocument={onCompleteDocument}
            completingDocument={completingDocument}
          />
        </section>

        <section className="flex lg:hidden flex-col flex-1 min-h-0 w-full relative">
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={!isVoiceSupported}
            className="shrink-0 flex flex-col items-center justify-center relative border-0 bg-transparent cursor-pointer py-6"
            style={{ backgroundColor: 'rgba(141, 169, 196, 0.01)', minHeight: '160px' }}
          >
            <HexiCore statusText={statusText} size="large" isRecording={isRecording} />
          </button>
          <div className="absolute top-24 left-4 z-10">
            <button
              type="button"
              onClick={() => setSpeakerOn((v) => !v)}
              className="flex items-center justify-center rounded-lg border"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: speakerOn ? 'var(--regal-navy)' : 'var(--bg-input)',
                color: speakerOn ? 'white' : 'var(--text-muted)',
                borderColor: 'var(--border-medium)',
                cursor: 'pointer',
              }}
              title={speakerOn ? 'Speaker on' : 'Speaker off'}
            >
              <SpeakerIconSmall muted={!speakerOn} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            <TranscriptionStream
              entries={combinedEntries}
              interimText={interimText}
              suggestions={suggestions}
              basis={basis}
              complete={complete}
              isRecording={isRecording}
              recordingDuration={recordingDuration}
            />
          </div>
          <InputArea
            voiceError={voiceError}
            onGenerateSummary={handleGenerateSummary}
            onSendText={handleSendText}
            generatingSummary={generatingSummary}
            onAttachDocument={onAttachDocument}
            attachedFile={attachedFile}
            onClearAttachment={onClearAttachment}
            documentGaps={documentGaps}
            onCompleteDocument={onCompleteDocument}
            completingDocument={completingDocument}
          />
        </section>
      </main>

      <VitalsGrid />

      {summaryDoc && (
        <PatientSummaryModal
          summary={summaryDoc}
          sessionId={sessionIdRef.current}
          transcriptWithSpeakers={combinedEntries.map((e) => `${e.speaker === 'ai' ? 'AI' : 'Practitioner'}: ${(e.text || '').replace(/\n/g, ' ')}`).join('\n')}
          onClose={() => setSummaryDoc(null)}
          onNewChat={handleNewChat}
        />
      )}
    </div>
  );
}
