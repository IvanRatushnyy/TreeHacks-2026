import { useState, useCallback } from 'react';

/**
 * QuestionPanel — Interactive panel for selecting and managing questions
 * 
 * Gives nurses agency to:
 * - See all detected knowledge gaps
 * - Select which questions to ask
 * - Mark questions as answered
 * - Add custom questions
 * 
 * Props:
 *  - gaps (array): knowledge gaps with { id, question, field, priority, filled }
 *  - onSelectQuestion (func): called when nurse selects a question to ask
 *  - onMarkAnswered (func): called when nurse marks a question as answered
 *  - onAddQuestion (func): called when nurse adds a custom question
 *  - isVisible (bool): whether panel is visible
 *  - onClose (func): close panel
 */
export default function QuestionPanel({
  gaps = [],
  onSelectQuestion,
  onMarkAnswered,
  onAddQuestion,
  isVisible = false,
  onClose,
}) {
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddForm, setShowAddForm] = useState(false);

  // Toggle question selection
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Ask selected questions
  const handleAskSelected = useCallback(() => {
    const selectedGaps = gaps.filter(g => selectedIds.has(g.id) && !g.filled);
    selectedGaps.forEach(gap => {
      onSelectQuestion?.(gap);
    });
    setSelectedIds(new Set());
  }, [gaps, selectedIds, onSelectQuestion]);

  // Add custom question
  const handleAddCustom = useCallback(() => {
    if (customQuestion.trim()) {
      onAddQuestion?.({
        id: `custom-${Date.now()}`,
        question: customQuestion.trim(),
        field: 'custom',
        priority: 'important',
        filled: false,
      });
      setCustomQuestion('');
      setShowAddForm(false);
    }
  }, [customQuestion, onAddQuestion]);

  // Group gaps by priority
  const criticalGaps = gaps.filter(g => g.priority === 'critical' && !g.filled);
  const importantGaps = gaps.filter(g => g.priority === 'important' && !g.filled);
  const recommendedGaps = gaps.filter(g => g.priority === 'recommended' && !g.filled);
  const answeredGaps = gaps.filter(g => g.filled);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: 'min(90vw, 560px)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            backgroundColor: 'rgba(141, 169, 196, 0.1)',
            borderBottom: '1px solid rgba(141, 169, 196, 0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#134074">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
            <div>
              <h2 className="font-display font-bold text-lg" style={{ color: '#134074' }}>
                Knowledge Gaps
              </h2>
              <p className="text-sm" style={{ color: '#5A7A9A' }}>
                {gaps.filter(g => !g.filled).length} questions remaining
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#666">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-4" style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
          {/* Critical Questions */}
          {criticalGaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#DC2626' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#DC2626' }}>
                  Critical ({criticalGaps.length})
                </span>
              </div>
              <div className="space-y-2">
                {criticalGaps.map(gap => (
                  <QuestionCard
                    key={gap.id}
                    gap={gap}
                    isSelected={selectedIds.has(gap.id)}
                    onToggle={() => handleToggleSelect(gap.id)}
                    onAsk={() => onSelectQuestion?.(gap)}
                    onMarkAnswered={() => onMarkAnswered?.(gap.id)}
                    accentColor="#DC2626"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Important Questions */}
          {importantGaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F59E0B' }}>
                  Important ({importantGaps.length})
                </span>
              </div>
              <div className="space-y-2">
                {importantGaps.map(gap => (
                  <QuestionCard
                    key={gap.id}
                    gap={gap}
                    isSelected={selectedIds.has(gap.id)}
                    onToggle={() => handleToggleSelect(gap.id)}
                    onAsk={() => onSelectQuestion?.(gap)}
                    onMarkAnswered={() => onMarkAnswered?.(gap.id)}
                    accentColor="#F59E0B"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recommended Questions */}
          {recommendedGaps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8DA9C4' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8DA9C4' }}>
                  Recommended ({recommendedGaps.length})
                </span>
              </div>
              <div className="space-y-2">
                {recommendedGaps.map(gap => (
                  <QuestionCard
                    key={gap.id}
                    gap={gap}
                    isSelected={selectedIds.has(gap.id)}
                    onToggle={() => handleToggleSelect(gap.id)}
                    onAsk={() => onSelectQuestion?.(gap)}
                    onMarkAnswered={() => onMarkAnswered?.(gap.id)}
                    accentColor="#8DA9C4"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Answered Questions (collapsed) */}
          {answeredGaps.length > 0 && (
            <div style={{ opacity: 0.6 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#22C55E' }}>
                  Addressed ({answeredGaps.length})
                </span>
              </div>
              <div className="space-y-1">
                {answeredGaps.slice(0, 3).map(gap => (
                  <div
                    key={gap.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#22C55E">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span className="text-sm line-through" style={{ color: '#666' }}>
                      {gap.question}
                    </span>
                  </div>
                ))}
                {answeredGaps.length > 3 && (
                  <p className="text-xs text-center py-1" style={{ color: '#888' }}>
                    +{answeredGaps.length - 3} more addressed
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Add Custom Question */}
          {showAddForm ? (
            <div className="border rounded-lg p-3" style={{ borderColor: 'rgba(141, 169, 196, 0.3)' }}>
              <textarea
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Enter your question..."
                className="w-full text-sm p-2 border rounded resize-none"
                style={{ borderColor: 'rgba(141, 169, 196, 0.3)' }}
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => { setShowAddForm(false); setCustomQuestion(''); }}
                  className="px-3 py-1.5 text-sm rounded-lg"
                  style={{ color: '#666' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustom}
                  disabled={!customQuestion.trim()}
                  className="px-3 py-1.5 text-sm rounded-lg text-white"
                  style={{
                    backgroundColor: customQuestion.trim() ? '#134074' : '#ccc',
                    cursor: customQuestion.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Add Question
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed transition-colors hover:bg-gray-50"
              style={{ borderColor: 'rgba(141, 169, 196, 0.3)', color: '#5A7A9A' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Add Custom Question
            </button>
          )}

          {/* Empty State */}
          {gaps.filter(g => !g.filled).length === 0 && (
            <div className="text-center py-8">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#22C55E" className="mx-auto mb-3">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <h3 className="font-display font-bold mb-1" style={{ color: '#134074' }}>
                All Questions Addressed!
              </h3>
              <p className="text-sm" style={{ color: '#666' }}>
                Great job! You've gathered comprehensive patient information.
              </p>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        {selectedIds.size > 0 && (
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{
              backgroundColor: 'rgba(19, 64, 116, 0.05)',
              borderTop: '1px solid rgba(141, 169, 196, 0.2)',
            }}
          >
            <span className="text-sm" style={{ color: '#5A7A9A' }}>
              {selectedIds.size} question{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleAskSelected}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#134074' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
              Ask Selected
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * QuestionCard — Individual question item with actions
 */
function QuestionCard({ gap, isSelected, onToggle, onAsk, onMarkAnswered, accentColor }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all"
      style={{
        backgroundColor: isSelected ? `${accentColor}10` : 'rgba(255, 255, 255, 0.8)',
        border: `1px solid ${isSelected ? accentColor : 'rgba(141, 169, 196, 0.2)'}`,
      }}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5"
        style={{
          borderColor: isSelected ? accentColor : 'rgba(141, 169, 196, 0.4)',
          backgroundColor: isSelected ? accentColor : 'transparent',
        }}
      >
        {isSelected && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: '#1a1a1a' }}>
          {gap.question}
        </p>
        <p className="text-xs mt-1" style={{ color: '#888' }}>
          Field: {gap.field.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={onAsk}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Ask this question"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#5A7A9A">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </button>
        <button
          onClick={onMarkAnswered}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Mark as answered"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#22C55E">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
