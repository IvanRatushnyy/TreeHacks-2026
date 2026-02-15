import { useState, useEffect, useRef } from 'react';

// Allowed file types
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.doc', '.docx', '.rtf', '.odt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * InputArea — editable textarea with file upload and send functionality.
 *
 * Props:
 *  - isListening    (bool)   : whether voice input is active
 *  - uploadedFile   (object) : current uploaded file metadata
 *  - onFileUpload   (func)   : callback when file is uploaded (file, content)
 *  - onFileRemove   (func)   : callback when file is removed
 *  - onSendMessage  (func)   : callback when message is sent
 *  - isProcessing   (bool)   : whether AI is processing
 */
export default function InputArea({ 
  isListening = false,
  uploadedFile = null,
  onFileUpload,
  onFileRemove,
  onSendMessage,
  isProcessing = false,
}) {
  const [value, setValue] = useState('');
  const [showFilePill, setShowFilePill] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fade in file pill when file is uploaded
  useEffect(() => {
    if (uploadedFile) {
      const timer = setTimeout(() => setShowFilePill(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowFilePill(false);
    }
  }, [uploadedFile]);

  // Auto-scroll textarea to bottom when value changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [value]);

  const placeholder = isListening
    ? 'Listening...'
    : 'Type a message or clinical notes...';

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasValidExt) {
      alert(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    // Read file content
    const reader = new FileReader();
    
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      reader.onload = (ev) => {
        onFileUpload?.(file, ev.target?.result);
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.pdf')) {
      reader.onload = (ev) => {
        onFileUpload?.(file, ev.target?.result);
      };
      reader.readAsDataURL(file);
    } else {
      // For other document types, just store metadata
      onFileUpload?.(file, `Document: ${file.name}`);
    }

    // Reset input
    e.target.value = '';
  };

  // Handle send
  const handleSend = () => {
    if (value.trim() && !isProcessing) {
      onSendMessage?.(value.trim());
      setValue('');
    }
  };

  // Handle Enter key (Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="w-full flex flex-col bg-white"
      style={{
        borderTop: '1px solid var(--border-light)',
        padding: '19px 24px 18px',
        gap: '8px',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Textarea wrapper with + icon, file pill, and send button */}
      <div className="relative w-full" style={{ height: '140px' }}>
        <textarea
          ref={textareaRef}
          className="w-full h-full rounded-lg font-body"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            padding: '17px 17px 50px 17px',
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
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
        />

        {/* White background overlay for bottom controls - inside textarea bounds */}
        <div
          className="absolute"
          style={{
            bottom: '1px',
            left: '1px',
            right: '1px',
            height: '44px',
            backgroundColor: '#ffffff',
            borderBottomLeftRadius: '7px',
            borderBottomRightRadius: '7px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Bottom left: + icon and file pill */}
        <div
          className="absolute flex items-center"
          style={{
            bottom: '12px',
            left: '12px',
            gap: '8px',
            zIndex: 1,
          }}
        >
          {/* + icon button */}
          <button
            className="flex items-center justify-center"
            style={{
              width: '20px',
              height: '20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0',
            }}
            type="button"
            aria-label="Add file"
            onClick={() => fileInputRef.current?.click()}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '20px', color: '#133f72' }}
            >
              add
            </span>
          </button>

          {/* File pill */}
          {uploadedFile && (
            <div
              className="inline-flex items-center"
              style={{
                backgroundColor: 'rgba(19, 64, 116, 0.1)',
                height: '20px',
                padding: '0 8px',
                borderRadius: '4px',
                opacity: showFilePill ? 1 : 0,
                transition: 'opacity 0.3s ease-out',
              }}
            >
              <span
                className="font-body truncate"
                style={{
                  color: 'var(--regal-navy)',
                  fontSize: '12px',
                  lineHeight: '22.75px',
                  maxWidth: '150px',
                }}
              >
                {uploadedFile.name}
              </span>
              <button
                className="font-body font-bold cursor-pointer"
                style={{
                  color: 'var(--regal-navy)',
                  fontSize: '12px',
                  lineHeight: '22.75px',
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                }}
                onClick={onFileRemove}
                type="button"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          className="absolute flex items-center justify-center"
          style={{
            backgroundColor: isProcessing ? '#9ca3af' : '#133f72',
            borderRadius: '4px',
            width: '28.25px',
            height: '26.5px',
            bottom: '12px',
            right: '12px',
            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
            border: 'none',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            padding: '0',
            zIndex: 1,
          }}
          type="button"
          aria-label="Send"
          onClick={handleSend}
          disabled={isProcessing || !value.trim()}
        >
          {isProcessing ? (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', color: 'white', animation: 'spin 1s linear infinite' }}
            >
              progress_activity
            </span>
          ) : (
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', color: 'white' }}
            >
              send
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
