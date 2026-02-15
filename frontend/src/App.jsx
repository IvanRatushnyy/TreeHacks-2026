import { useState, useRef, useCallback, useEffect } from 'react';
import HexiCore from './components/HexiCore';
import KnowledgeGlobe from './components/KnowledgeGlobe';
import TranscriptionStream from './components/TranscriptionStream';
import InputArea from './components/InputArea';
import QuestionPanel from './components/QuestionPanel';
import LiteraturePanel from './components/LiteraturePanel';
import { useVoiceSession } from './hooks/useVoiceSession';
import { chatComplete, detectKnowledgeGaps, getNextQuestion } from './api';

// Pre-cached demo data for Margaret Chen DLBCL case
const DEMO_CASE = {
  patient: {
    name: 'Margaret Chen',
    age: 67,
    mrn: 'MC-2024-0892',
  },
  pathologyReport: `PATHOLOGY REPORT
Patient: Margaret Chen | DOB: 03/15/1957 | MRN: MC-2024-0892

SPECIMEN: Left cervical lymph node, excisional biopsy

DIAGNOSIS: Diffuse Large B-Cell Lymphoma, GCB subtype

MICROSCOPIC DESCRIPTION:
- Architecture: Complete effacement of nodal architecture by sheets of large atypical lymphoid cells
- Cell morphology: Large cells with vesicular nuclei, prominent nucleoli, moderate cytoplasm
- Mitotic activity: High (>15 mitoses per HPF)
- Necrosis: Focal areas present

IMMUNOHISTOCHEMISTRY:
- CD20: Positive (strong, diffuse)
- CD10: Positive
- BCL6: Positive
- MUM1: Negative
- Ki-67: 85%
- BCL2: Positive (60% of cells)
- MYC: Positive (45% of cells)
- TP53: Wild-type pattern

MOLECULAR STUDIES:
- FISH: BCL2 rearrangement POSITIVE, MYC rearrangement NEGATIVE
- Cell of Origin (Hans Algorithm): Germinal Center B-cell (GCB) subtype

STAGE: III-A (bilateral cervical, mediastinal, para-aortic involvement)

ADDITIONAL PATIENT FACTORS:
- Cardiac: LVEF 52% (mild reduction)
- Renal: eGFR 48 mL/min (CKD Stage 3a)
- Previous: Hypertension, Type 2 Diabetes

CLINICAL CORRELATION RECOMMENDED for treatment planning.`,
  knowledgeGaps: [
    { 
      id: 1, 
      topic: "Lymph Nodes",
      questions: [
        "Has the patient noticed any new swollen lymph nodes or lumps?",
        "Are any lymph nodes painful or tender?",
        "How long have the swollen nodes been present?"
      ],
      field: "lymphadenopathy", 
      priority: "critical", 
      position: { lat: 40, lng: -30 }, 
      filled: false 
    },
    { 
      id: 2, 
      topic: "B Symptoms",
      questions: [
        "Have you experienced any night sweats or fevers?",
        "Do you wake up drenched in sweat?",
        "Have you had unexplained fevers over 38°C?"
      ],
      field: "b_symptoms", 
      priority: "critical", 
      position: { lat: -20, lng: 45 }, 
      filled: false 
    },
    { 
      id: 3, 
      topic: "Weight Loss",
      questions: [
        "How much weight have you lost in the past 6 months?",
        "Has your appetite changed recently?",
        "Have you been trying to lose weight?"
      ],
      field: "weight_loss", 
      priority: "critical", 
      position: { lat: 60, lng: 120 }, 
      filled: false 
    },
    { 
      id: 4, 
      topic: "Energy Levels",
      questions: [
        "How would you rate your energy levels lately?",
        "Do you feel more fatigued than usual?",
        "Can you complete your daily activities?"
      ],
      field: "fatigue", 
      priority: "important", 
      position: { lat: -45, lng: -90 }, 
      filled: false 
    },
    { 
      id: 5, 
      topic: "Cardiac Medications",
      questions: [
        "Are you currently taking any heart or blood pressure medications?",
        "What is your current blood pressure medication regimen?",
        "Have you had any recent changes to cardiac medications?"
      ],
      field: "cardiac_meds", 
      priority: "critical", 
      position: { lat: 15, lng: 170 }, 
      filled: false 
    },
    { 
      id: 6, 
      topic: "Kidney Function",
      questions: [
        "How has your kidney function been monitored recently?",
        "Do you know your last creatinine level?",
        "Have you noticed changes in urination?"
      ],
      field: "renal_function", 
      priority: "important", 
      position: { lat: -60, lng: -150 }, 
      filled: false 
    },
    { 
      id: 7, 
      topic: "Drug Allergies",
      questions: [
        "Do you have any allergies to chemotherapy drugs?",
        "Have you had any previous reactions to medications?",
        "Are you allergic to any antibiotics?"
      ],
      field: "allergies", 
      priority: "critical", 
      position: { lat: 30, lng: 90 }, 
      filled: false 
    },
  ],
};

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

  /* ============================
   *  UI Panel States
   * ============================ */
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [questionPanelVisible, setQuestionPanelVisible] = useState(false);
  const [literaturePanelVisible, setLiteraturePanelVisible] = useState(false);
  const [literatureQuery, setLiteratureQuery] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);

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
  const [pendingQuestion, setPendingQuestion] = useState(null); // { text, time } - question awaiting answer

  // Handler for voice transcription entries
  const handleAddUserEntry = useCallback((entry) => {
    // When user provides input, commit pending question to entries first
    if (pendingQuestion) {
      const questionEntry = {
        id: Date.now() - 1,
        time: pendingQuestion.time,
        text: pendingQuestion.text,
        speaker: 'ai',
        isQuestion: true,
        isInterim: false,
      };
      setConversationEntries((prev) => [...prev, questionEntry]);
      setPendingQuestion(null);
    }
    setConversationEntries((prev) => [
      ...prev,
      { ...entry, speaker: 'user' }
    ]);
  }, [pendingQuestion]);

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
  const globeRef = useRef(null);
  const wasListeningRef = useRef(false);

  /* ============================
   *  Knowledge Gap State
   * ============================ */
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);
  const [globeVisible, setGlobeVisible] = useState(false);
  const [globeDarkness, setGlobeDarkness] = useState(0);

  // Calculate darkness based on filled gaps
  useEffect(() => {
    if (knowledgeGaps.length === 0) {
      setGlobeDarkness(0);
      // Reset hexagon when no gaps
      hexiRef.current?.setContext?.(0);
      return;
    }
    const filledCount = knowledgeGaps.filter(g => g.filled).length;
    const newDarkness = filledCount / knowledgeGaps.length;
    setGlobeDarkness(newDarkness);
    
    // Sync hexagon darkness with globe using setContext for direct control
    hexiRef.current?.setContext?.(newDarkness);
  }, [knowledgeGaps]);

  // Show globe when gaps are detected
  useEffect(() => {
    if (knowledgeGaps.length > 0 && !globeVisible) {
      // Small delay before showing globe for smooth animation
      const timer = setTimeout(() => setGlobeVisible(true), 300);
      return () => clearTimeout(timer);
    } else if (knowledgeGaps.length === 0 && globeVisible) {
      setGlobeVisible(false);
    }
  }, [knowledgeGaps.length, globeVisible]);

  // Handle gap click - set pending question (can be changed until user answers)
  const handleGapClick = useCallback((gap) => {
    console.log('[App] Gap clicked:', gap);
    // Set as pending question - will fade in/out if changed
    setPendingQuestion({
      text: gap.question,
      time: formatTime(),
    });
  }, []);

  // Fill a gap (called when AI recognizes an answer)
  const fillGap = useCallback((gapId) => {
    setKnowledgeGaps((prev) =>
      prev.map((g) => (g.id === gapId ? { ...g, filled: true, filledAt: Date.now() } : g))
    );
  }, []);

  // Helper to format topic name from field
  const formatTopicName = (field) => {
    if (!field) return null;
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Demo function to test globe visualization (fallback)
  const demoGlobe = useCallback(() => {
    const demoGaps = [
      { 
        id: 1, 
        topic: "Chief Complaint",
        questions: [
          "What brings you in today?",
          "How would you describe your main concern?",
          "When did this issue start bothering you?"
        ],
        field: "chief_complaint", 
        priority: "critical", 
        position: { lat: 40, lng: -30 }, 
        filled: false 
      },
      { 
        id: 2, 
        topic: "Symptom Onset",
        questions: [
          "When did this start?",
          "Was the onset sudden or gradual?",
          "What were you doing when it started?"
        ],
        field: "onset", 
        priority: "critical", 
        position: { lat: -20, lng: 45 }, 
        filled: false 
      },
      { 
        id: 3, 
        topic: "Medications",
        questions: [
          "Are you taking any medications?",
          "Do you take any over-the-counter medications?",
          "Have you recently started or stopped any medications?"
        ],
        field: "medications", 
        priority: "critical", 
        position: { lat: 60, lng: 120 }, 
        filled: false 
      },
      { 
        id: 4, 
        topic: "Pain Level",
        questions: [
          "On a scale of 0-10, how would you rate your discomfort?",
          "Does anything make the pain better or worse?",
          "How would you describe the pain?"
        ],
        field: "severity", 
        priority: "important", 
        position: { lat: -45, lng: -90 }, 
        filled: false 
      },
      { 
        id: 5, 
        topic: "Allergies",
        questions: [
          "Any allergies to medications?",
          "Have you had any allergic reactions before?",
          "Are you allergic to any foods or environmental factors?"
        ],
        field: "allergies", 
        priority: "critical", 
        position: { lat: 15, lng: 170 }, 
        filled: false 
      },
      { 
        id: 6, 
        topic: "Medical History",
        questions: [
          "Do you have any medical conditions I should know about?",
          "Have you been hospitalized before?",
          "Do you have any chronic conditions?"
        ],
        field: "pmh", 
        priority: "important", 
        position: { lat: -60, lng: -150 }, 
        filled: false 
      },
    ];
    setKnowledgeGaps(demoGaps);
    
    // Add AI message about gaps
    const aiEntry = {
      id: Date.now(),
      time: formatTime(),
      text: "Let me help gather some information. I've highlighted key questions we need to address - you can see them on the globe below.",
      speaker: 'ai',
      isInterim: false,
    };
    setConversationEntries((prev) => [...prev, aiEntry]);
  }, []);

  // Detect knowledge gaps using the API
  const analyzeKnowledgeGaps = useCallback(async () => {
    // Build transcript from conversation entries
    const transcript = conversationEntries
      .map(e => `[${e.speaker}] ${e.text}`)
      .join('\n');
    
    try {
      const result = await detectKnowledgeGaps(transcript, [], 'general');
      if (result.gaps && result.gaps.length > 0) {
        // Transform gaps to include topic and questions array
        const transformedGaps = result.gaps.map((g, idx) => {
          // Generate topic name from field or question
          const topicName = g.topic || formatTopicName(g.field) || 'General Info';
          
          // Generate questions array - use existing questions or create from single question
          const questions = g.questions || [
            g.question,
            `Can you provide more details about ${topicName.toLowerCase()}?`,
            `Is there anything else about ${topicName.toLowerCase()} we should know?`
          ];
          
          return {
            ...g,
            topic: topicName,
            questions: questions,
            filled: false,
            position: {
              lat: (Math.random() - 0.5) * 120,
              lng: (idx / result.gaps.length) * 360 - 180,
            },
          };
        });
        
        setKnowledgeGaps(transformedGaps);
        
        // Add AI message about gaps
        const aiEntry = {
          id: Date.now(),
          time: formatTime(),
          text: result.next_question || "I've identified some information we still need. The markers on the globe show what's missing.",
          speaker: 'ai',
          isInterim: false,
        };
        setConversationEntries((prev) => [...prev, aiEntry]);
      } else if (result.complete) {
        // All gaps filled!
        const aiEntry = {
          id: Date.now(),
          time: formatTime(),
          text: "Great! We have all the information we need. Is there anything else you'd like to add?",
          speaker: 'ai',
          isInterim: false,
        };
        setConversationEntries((prev) => [...prev, aiEntry]);
      }
    } catch (err) {
      console.error('[App] Failed to analyze knowledge gaps:', err);
      // Fall back to demo data if API fails
      demoGlobe();
    }
  }, [conversationEntries, demoGlobe, formatTopicName]);

  // Load Margaret Chen demo case (for TreeHacks demo)
  const loadDemoCase = useCallback(() => {
    setIsDemoMode(true);
    
    // Set file content from demo pathology report
    const fileData = {
      name: 'pathology_report_margaret_chen.txt',
      size: DEMO_CASE.pathologyReport.length,
      type: 'text/plain',
      lastModified: Date.now(),
    };
    setUploadedFile(fileData);
    setFileContent(DEMO_CASE.pathologyReport);
    
    // Load pre-cached knowledge gaps
    setKnowledgeGaps(DEMO_CASE.knowledgeGaps);
    
    // Add initial AI message
    const aiEntry = {
      id: Date.now(),
      time: formatTime(),
      text: `I've loaded the pathology report for ${DEMO_CASE.patient.name}, age ${DEMO_CASE.patient.age}. The diagnosis is Diffuse Large B-Cell Lymphoma, GCB subtype. I've identified ${DEMO_CASE.knowledgeGaps.length} key questions we need to address before treatment planning. You can click on any marker on the globe or use the Questions panel to see what information we still need.`,
      speaker: 'ai',
      isInterim: false,
    };
    setConversationEntries([aiEntry]);
  }, []);

  // Handle marking a question as answered
  const handleMarkAnswered = useCallback((gapId) => {
    fillGap(gapId);
  }, [fillGap]);

  // Handle adding a custom question
  const handleAddQuestion = useCallback((newGap) => {
    // Generate a position for the new gap
    const angle = Math.random() * 360;
    const lat = (Math.random() - 0.5) * 120;
    const lng = angle - 180;
    
    const gapWithPosition = {
      ...newGap,
      position: { lat, lng },
    };
    
    setKnowledgeGaps(prev => [...prev, gapWithPosition]);
  }, []);

  // Handle opening literature search
  const handleOpenLiterature = useCallback((query = '') => {
    setLiteratureQuery(query || (isDemoMode ? 'DLBCL GCB treatment' : ''));
    setLiteraturePanelVisible(true);
  }, [isDemoMode]);

  // Handle adding literature finding to discussion
  const handleAddLiteratureToDiscussion = useCallback((result) => {
    const aiEntry = {
      id: Date.now(),
      time: formatTime(),
      text: `📚 **Research Finding**: ${result.title}\n\n${result.keyFindings?.join('\n• ') || result.abstract}\n\n_Source: ${result.journal} (${result.year}) - DOI: ${result.doi}_`,
      speaker: 'ai',
      isInterim: false,
      isLiterature: true,
    };
    setConversationEntries((prev) => [...prev, aiEntry]);
    setLiteraturePanelVisible(false);
  }, []);

  // Demo function to fill a random gap (for testing)
  const demoFillGap = useCallback(() => {
    const unfilledGaps = knowledgeGaps.filter(g => !g.filled);
    if (unfilledGaps.length > 0) {
      const randomGap = unfilledGaps[Math.floor(Math.random() * unfilledGaps.length)];
      fillGap(randomGap.id);
      
      // Add user response
      const userEntry = {
        id: Date.now(),
        time: formatTime(),
        text: `Regarding "${randomGap.question}" - I've provided the information.`,
        speaker: 'user',
        isInterim: false,
      };
      setConversationEntries((prev) => [...prev, userEntry]);
    }
  }, [knowledgeGaps, fillGap]);

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

  /* ---------- Pause/Resume handler (needs audio functions) ---------- */
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      // Resume recording
      setIsPaused(false);
      startListeningWithAudio();
    } else {
      // Pause recording
      setIsPaused(true);
      stopListeningWithAudio();
    }
  }, [isPaused, startListeningWithAudio, stopListeningWithAudio]);

  /* ---------- Handle selecting a question (needs audio functions) ---------- */
  const handleSelectQuestion = useCallback((gap) => {
    // Pause voice if recording
    if (isRecording && !isPaused) {
      setIsPaused(true);
      stopListeningWithAudio();
    }
    
    // Add the question to conversation as AI entry
    const aiEntry = {
      id: Date.now(),
      time: formatTime(),
      text: gap.question,
      speaker: 'ai',
      isInterim: false,
      isQuestion: true,
      gapId: gap.id,
    };
    setConversationEntries((prev) => [...prev, aiEntry]);
    setQuestionPanelVisible(false);
  }, [isRecording, isPaused, stopListeningWithAudio]);

  /* ---------- Send message handler ---------- */
  const handleSendMessage = useCallback(async (message) => {
    if (!message.trim()) return;

    // If there's a pending question, commit it first
    if (pendingQuestion) {
      const questionEntry = {
        id: Date.now() - 1,
        time: pendingQuestion.time,
        text: pendingQuestion.text,
        speaker: 'ai',
        isQuestion: true,
        isInterim: false,
      };
      setConversationEntries((prev) => [...prev, questionEntry]);
      setPendingQuestion(null);
    }

    // Add user message to conversation
    const userEntry = {
      id: Date.now(),
      time: formatTime(),
      text: message,
      speaker: 'user',
      isInterim: false,
    };
    setConversationEntries((prev) => [...prev, userEntry]);

    // Check if this message fills any existing gaps
    if (knowledgeGaps.length > 0) {
      const unfilledGaps = knowledgeGaps.filter(g => !g.filled);
      // Simple keyword matching for demo - in production, use AI to determine
      unfilledGaps.forEach(gap => {
        const keywords = gap.field.toLowerCase().split(/\s+/);
        const msgLower = message.toLowerCase();
        if (keywords.some(kw => msgLower.includes(kw))) {
          fillGap(gap.id);
        }
      });
    }

    // Get AI response
    setIsProcessing(true);
    try {
      const fullTranscript = [...conversationEntries, userEntry]
        .filter(e => e.speaker === 'user')
        .map(e => e.text)
        .join('\n');
      
      const response = await chatComplete(fullTranscript, fileContent);
      
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

        // Extract remaining gaps and add to globe if not already present
        if (response.remaining_gaps?.length > 0 && knowledgeGaps.length === 0) {
          // Generate positions distributed around the globe
          const newGaps = response.remaining_gaps.map((gap, idx) => {
            const angle = (idx / response.remaining_gaps.length) * 360;
            const lat = (Math.random() - 0.5) * 60; // -30 to 30 latitude
            const lng = angle - 180; // Distribute evenly
            
            return {
              id: `gap-${Date.now()}-${idx}`,
              question: typeof gap === 'string' ? gap : gap.question || gap,
              field: typeof gap === 'string' ? gap.split(' ')[0] : gap.field || 'info',
              priority: idx === 0 ? 'critical' : idx < 3 ? 'important' : 'recommended',
              position: { lat, lng },
              filled: false,
            };
          });
          setKnowledgeGaps(newGaps);
        }
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [conversationEntries, fileContent, knowledgeGaps, fillGap, pendingQuestion]);

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
          {/* Top toolbar with control buttons */}
          <div
            className="absolute top-4 left-4 right-4 flex justify-between items-center z-10"
          >
            {/* Left side buttons */}
            <div className="flex items-center gap-2">
              {/* Demo Case button (for TreeHacks) */}
              <button
                onClick={loadDemoCase}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-display transition-all"
                style={{
                  backgroundColor: isDemoMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(19, 64, 116, 0.1)',
                  border: `1px solid ${isDemoMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(19, 64, 116, 0.3)'}`,
                  color: isDemoMode ? '#15803D' : '#134074',
                }}
                title="Load Demo Case"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                {isDemoMode ? 'Demo Active' : 'Demo'}
              </button>

              {/* Analyze Gaps button */}
              <button
                onClick={analyzeKnowledgeGaps}
                disabled={conversationEntries.length === 0 && !isDemoMode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-display transition-all"
                style={{
                  backgroundColor: (conversationEntries.length > 0 || isDemoMode) ? 'rgba(141, 169, 196, 0.15)' : 'rgba(141, 169, 196, 0.05)',
                  border: '1px solid rgba(141, 169, 196, 0.3)',
                  color: (conversationEntries.length > 0 || isDemoMode) ? '#5A7A9A' : '#B0C4D8',
                  cursor: (conversationEntries.length > 0 || isDemoMode) ? 'pointer' : 'not-allowed',
                  opacity: (conversationEntries.length > 0 || isDemoMode) ? 1 : 0.6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Analyze
              </button>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              {/* Literature Search button */}
              <button
                onClick={() => handleOpenLiterature()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-display transition-all"
                style={{
                  backgroundColor: 'rgba(141, 169, 196, 0.15)',
                  border: '1px solid rgba(141, 169, 196, 0.3)',
                  color: '#5A7A9A',
                }}
                title="Search Medical Literature"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </button>

              {/* Mute button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-display transition-all"
                style={{
                  backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(141, 169, 196, 0.15)',
                  border: `1px solid ${isMuted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(141, 169, 196, 0.3)'}`,
                  color: isMuted ? '#EF4444' : '#5A7A9A',
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Hexagon container - always absolute for smooth transition */}
          <div
            className="flex flex-col items-center"
            style={{
              position: 'absolute',
              top: globeVisible ? `calc(70px + ${isDemoMode ? '10px' : '0px'})` : '50%',
              left: '50%',
              transform: globeVisible 
                ? 'translate(-50%, 0) scale(0.75)' 
                : 'translate(-50%, -50%) scale(1)',
              transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 20,
            }}
          >
            <HexiCore
              ref={hexiRef}
              isListening={isRecording}
              audioLevel={audioLevel}
              onToggleListening={handleToggleListening}
            />
          </div>

          {/* Knowledge Globe - bottom aligned */}
          <div
            className="absolute flex items-end justify-center"
            style={{
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: globeVisible ? 1 : 0,
              pointerEvents: globeVisible ? 'auto' : 'none',
              transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <KnowledgeGlobe
              ref={globeRef}
              gaps={knowledgeGaps}
              darkness={globeDarkness}
              visible={globeVisible}
              onGapClick={handleGapClick}
              size={312}
            />
          </div>

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
              onSuggestionClick={handleGapClick}
              pendingQuestion={pendingQuestion}
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
          {/* Mobile toolbar */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            {/* Left buttons */}
            <div className="flex items-center gap-1">
              {/* Demo button */}
              <button
                onClick={loadDemoCase}
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{
                  backgroundColor: isDemoMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(19, 64, 116, 0.1)',
                  border: `1px solid ${isDemoMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(19, 64, 116, 0.3)'}`,
                  color: isDemoMode ? '#15803D' : '#134074',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </button>
              
              {/* Questions button */}
              {knowledgeGaps.length > 0 && (
                <button
                  onClick={() => setQuestionPanelVisible(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg relative"
                  style={{
                    backgroundColor: 'rgba(141, 169, 196, 0.15)',
                    border: '1px solid rgba(141, 169, 196, 0.3)',
                    color: '#5A7A9A',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {knowledgeGaps.filter(g => !g.filled).length}
                  </span>
                </button>
              )}
            </div>

            {/* Right buttons */}
            <div className="flex items-center gap-1">
              {/* Pause button (when recording) */}
              {isRecording && (
                <button
                  onClick={handleTogglePause}
                  className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{
                    backgroundColor: isPaused ? 'rgba(34, 197, 94, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    border: `1px solid ${isPaused ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                    color: isPaused ? '#15803D' : '#D97706',
                  }}
                >
                  {isPaused ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  )}
                </button>
              )}
              
              {/* Mute button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{
                  backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(141, 169, 196, 0.1)',
                  border: `1px solid ${isMuted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(141, 169, 196, 0.3)'}`,
                  color: isMuted ? '#EF4444' : '#5A7A9A',
                }}
              >
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Centered Hexi area with globe */}
          <div
            className="flex-1 flex flex-col items-center justify-center overflow-y-auto"
            style={{ backgroundColor: 'rgba(141, 169, 196, 0.01)' }}
          >
            <div 
              className="flex flex-col items-center"
              style={{
                transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: globeVisible ? 'translateY(-200px) scale(0.65)' : 'translateY(0) scale(1)',
              }}
            >
              <HexiCore
                ref={hexiRef}
                isListening={isRecording}
                audioLevel={audioLevel}
                onToggleListening={handleToggleListening}
              />
            </div>

            {/* Mobile Globe */}
            <div
              style={{
                marginTop: globeVisible ? '20px' : '0px',
                opacity: globeVisible ? 1 : 0,
                transform: globeVisible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
                transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                pointerEvents: globeVisible ? 'auto' : 'none',
              }}
            >
              <KnowledgeGlobe
                gaps={knowledgeGaps}
                darkness={globeDarkness}
                visible={globeVisible}
                onGapClick={handleGapClick}
                size={240}
              />
            </div>
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

      {/* ===== MODAL PANELS ===== */}
      
      {/* Question Selection Panel */}
      <QuestionPanel
        gaps={knowledgeGaps}
        onSelectQuestion={handleSelectQuestion}
        onMarkAnswered={handleMarkAnswered}
        onAddQuestion={handleAddQuestion}
        isVisible={questionPanelVisible}
        onClose={() => setQuestionPanelVisible(false)}
      />

      {/* Literature Search Panel */}
      <LiteraturePanel
        query={literatureQuery}
        isVisible={literaturePanelVisible}
        onClose={() => setLiteraturePanelVisible(false)}
        onAddToDiscussion={handleAddLiteratureToDiscussion}
      />

      {/* Pause Overlay (shows when paused during recording) */}
      {isPaused && (
        <div
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.95)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <span className="text-white font-medium text-sm">Recording Paused</span>
          <button
            onClick={handleTogglePause}
            className="ml-2 px-3 py-1 bg-white text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
          >
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
