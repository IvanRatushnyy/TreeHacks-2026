export default function InputArea() {
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
        <div
          className="w-full h-full rounded-lg font-body"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            boxShadow: 'inset 0px 2px 4px 1px rgba(0, 0, 0, 0.05)',
            padding: '17px 49px 17px 17px',
            fontSize: '14px',
            lineHeight: '20px',
            color: 'var(--text-placeholder)',
          }}
        >
          Override transcription or append clinical notes...
        </div>

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
            padding: '8px',
          }}
        >
          <svg width="12.25" height="10.5" viewBox="0 0 12.25 10.5" fill="none">
            <path
              d="M0 10.5V6.42578L8.75 5.25L0 4.07422V0L12.25 5.25L0 10.5Z"
              fill="white"
            />
          </svg>
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
