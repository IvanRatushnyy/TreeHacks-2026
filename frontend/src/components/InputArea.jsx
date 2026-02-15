import { useState, useCallback } from 'react';

export default function InputArea({
  voiceError = null,
  onGenerateSummary,
  onSendText,
  generatingSummary = false,
  onAttachDocument,
  attachedFile = null,
  onClearAttachment,
  documentGaps = null,
  onCompleteDocument,
  completingDocument = false,
}) {
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSendText?.(t);
    setText('');
  }, [text, onSendText]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div
      className="w-full flex flex-col bg-white"
      style={{
        borderTop: '1px solid var(--border-light)',
        padding: '19px 24px 18px',
        gap: '8px',
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {voiceError && (
          <span className="font-body" style={{ fontSize: '12px', color: '#dc2626' }}>
            {voiceError}
          </span>
        )}
        {onGenerateSummary && (
          <button
            type="button"
            onClick={onGenerateSummary}
            disabled={generatingSummary}
            className="font-body font-bold rounded-lg px-4 py-2 ml-auto"
            style={{
              backgroundColor: 'var(--regal-navy)',
              color: 'white',
              border: 'none',
              cursor: generatingSummary ? 'wait' : 'pointer',
              fontSize: '13px',
              opacity: generatingSummary ? 0.7 : 1,
            }}
          >
            {generatingSummary ? 'Generating…' : 'Generate summary'}
          </button>
        )}
      </div>

      {/* Text input: works in both modes (practitioner notes / patient symptoms) */}
      <div className="relative w-full" style={{ height: '80px' }}>
        <textarea
          placeholder="Type notes or answers; AI is listening to fill gaps..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-full rounded-lg font-body resize-none"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            boxShadow: 'inset 0px 2px 4px 1px rgba(0, 0, 0, 0.05)',
            padding: '17px 49px 17px 17px',
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-body-dark)',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
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
            zIndex: 1,
          }}
          title="Send"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px', color: 'white' }}
          >
            send
          </span>
        </button>
      </div>

      {/* Attach document: find missing info per our format, then complete */}
      <div className="flex items-center justify-between w-full flex-wrap gap-2" style={{ minHeight: '20px' }}>
        {attachedFile ? (
          <div className="inline-flex items-center gap-2" style={{ backgroundColor: 'rgba(19, 64, 116, 0.1)', height: '28px', padding: '0 8px', borderRadius: '4px' }}>
            <span className="font-body" style={{ color: 'var(--regal-navy)', fontSize: '12px' }}>
              {attachedFile.name}
            </span>
            <button type="button" onClick={onClearAttachment} className="font-body font-bold" style={{ color: 'var(--regal-navy)', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
          </div>
        ) : null}
        {!attachedFile && onAttachDocument && (
          <label className="font-display font-bold cursor-pointer" style={{ color: '#133f72', fontSize: '12px', lineHeight: '15px' }}>
            <input type="file" accept=".txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttachDocument(f); e.target.value = ''; }} />
            + Attach document
          </label>
        )}
        {documentGaps?.length > 0 && onCompleteDocument && (
          <button type="button" onClick={onCompleteDocument} disabled={completingDocument} className="font-body font-bold rounded px-2 py-1" style={{ fontSize: '12px', backgroundColor: 'var(--regal-navy)', color: 'white', border: 'none', cursor: completingDocument ? 'wait' : 'pointer' }}>
            {completingDocument ? 'Completing…' : 'Complete document'}
          </button>
        )}
      </div>
    </div>
  );
}
