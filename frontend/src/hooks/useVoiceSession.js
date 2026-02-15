import { useState, useRef, useCallback, useEffect } from 'react';
import { validateSnippet } from '../api';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useVoiceSession(options = {}) {
  const { role = 'patient', onValidateResponse, onAddUserEntry } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [basis, setBasis] = useState('');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recognitionRef = useRef(null);
  const userWantsRecordingRef = useRef(false);
  const accumulatedRef = useRef('');
  const validateTimeoutRef = useRef(null);
  const lastValidateRef = useRef(0);
  const recordingStartRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingDuration(0);
      return;
    }
    recordingStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setRecordingDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const sendValidate = useCallback(async (text) => {
    const t = (text || '').trim();
    if (!t || t.length < 3) return;
    if (Date.now() - lastValidateRef.current < 1500) return;
    lastValidateRef.current = Date.now();
    try {
      const data = await validateSnippet(t, true, role);
      const sugs = data.suggestions || [];
      const bas = data.basis || '';
      const comp = !!data.complete;
      setSuggestions(sugs);
      setBasis(bas);
      setComplete(comp);
      onValidateResponse?.({ suggestions: sugs, basis: bas, complete: comp });
    } catch (e) {
      setSuggestions([{ question: 'Could not reach API. Is the backend running?', rationale: e.message, priority: 'recommended' }]);
      setBasis('');
      setComplete(false);
      onValidateResponse?.({ suggestions: [], basis: '', complete: false });
    }
  }, [role, onValidateResponse]);

  const startRecording = useCallback(() => {
    setError(null);
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalText) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalText;
        const entry = { id: Date.now() + Math.random(), time: formatTime(), text: finalText, isInterim: false };
        if (onAddUserEntry) onAddUserEntry(entry);
        else setEntries((prev) => [...prev, entry]);
        setInterimText('');
        clearTimeout(validateTimeoutRef.current);
        validateTimeoutRef.current = setTimeout(() => sendValidate(accumulatedRef.current), 400);
      }
      if (interim) {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      setError(event.error || 'Speech recognition error');
    };

    recognition.onend = () => {
      if (!userWantsRecordingRef.current) return;
      if (recognitionRef.current !== recognition) return;
      // Keep listening: restart immediately to avoid missing audio
      try {
        const next = new SpeechRecognition();
        next.continuous = true;
        next.interimResults = true;
        next.lang = 'en-US';
        next.maxAlternatives = 1;
        next.onresult = recognition.onresult;
        next.onerror = recognition.onerror;
        next.onend = recognition.onend;
        recognitionRef.current = next;
        next.start();
      } catch (_) {
        userWantsRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      userWantsRecordingRef.current = true;
      setIsRecording(true);
      if (!onAddUserEntry) setEntries([]);
      setInterimText('');
      setSuggestions([]);
      setBasis('');
      setComplete(false);
      accumulatedRef.current = '';
    } catch (e) {
      userWantsRecordingRef.current = false;
      setError(e.message || 'Could not start microphone');
    }
  }, [sendValidate]);

  const stopRecording = useCallback(() => {
    userWantsRecordingRef.current = false;
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
      validateTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const getTranscript = useCallback(() => accumulatedRef.current || '', []);

  const validateTranscript = useCallback(
    (text) => {
      sendValidate(text || accumulatedRef.current);
    },
    [sendValidate]
  );

  return {
    isRecording,
    entries,
    interimText,
    suggestions,
    basis,
    complete,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
    getTranscript,
    validateTranscript,
    isSupported: !!SpeechRecognition,
  };
}
