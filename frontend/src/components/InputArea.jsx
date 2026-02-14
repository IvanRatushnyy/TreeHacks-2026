import { useState, useEffect, useRef } from 'react';

/**
 * InputArea — editable textarea for transcription / clinical notes.
 *
 * Props:
 *  - transcript  (string) : live transcription text (empty for now)
 *  - isListening (bool)   : whether voice input is active
 */
export default function InputArea({ transcript = '', isListening = false }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  // When transcript text arrives from parent, append it
  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript]);

  // Auto-scroll textarea to bottom when value changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [value]);

  const placeholder = isListening
    ? 'Listening...'
    : 'Override transcription or append clinical notes...';

  return (
    <div
      className="w-full flex flex-col bg-white"
      style={{
        borderTop: '1px solid var(--border-light)',
        padding: '19px 24px 18px',
        gap: '8px',
      }}
    >
      {/* Textarea wrapper with send button */}
      <div className="relative w-full" style={{ height: '80px' }}>
        <textarea
          ref={textareaRef}
          className="w-full h-full rounded-lg font-body"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            padding: '17px 49px 17px 17px',
            fontSize: '16px',
            lineHeight: '22.75px',
            color: isListening && !value
              ? 'var(--text-placeholder)'
              : 'var(--text-primary)',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            ...(isListening && !value
              ? { animation: 'listeningBlink 1.5s ease-in-out infinite' }
              : {}),
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        {/* Send button */}
        <button
          className="absolute flex items-center justify-center"
          style={{
            backgroundColor: '#133f72',
            borderRadius: '4px',
            width: '28.25px',
            height: '26.5px',
            bottom: '12px',
            right: '12px',
            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
          }}
          type="button"
          aria-label="Send"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px', color: 'white' }}
          >
            send
          </span>
        </button>
      </div>

      {/* File tag + Add Data row */}
      <div
        className="flex items-center justify-between w-full"
        style={{ height: '20px' }}
      >
        {/* Attached file tag */}
        <div
          className="inline-flex items-center"
          style={{
            backgroundColor: 'rgba(19, 64, 116, 0.1)',
            height: '20px',
            padding: '0 4px',
          }}
        >
          <span
            className="font-body"
            style={{
              color: 'var(--regal-navy)',
              fontSize: '12px',
              lineHeight: '22.75px',
            }}
          >
            MRI.png
          </span>
          <span
            className="font-body font-bold cursor-pointer"
            style={{
              color: 'var(--regal-navy)',
              fontSize: '12px',
              lineHeight: '22.75px',
              marginLeft: '8px',
            }}
          >
            x
          </span>
        </div>

        {/* Add Data link */}
        <span
          className="font-display font-bold cursor-pointer"
          style={{
            color: '#133f72',
            fontSize: '12px',
            lineHeight: '15px',
          }}
        >
          + ADD DATA
        </span>
      </div>
    </div>
  );
}
