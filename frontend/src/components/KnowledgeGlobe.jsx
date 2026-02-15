import { useRef, useEffect, useState, forwardRef, useCallback } from 'react';

/**
 * KnowledgeGlobe — 3D animated globe with rotating topic points
 * 
 * Features:
 *  - Glassy transparent 3D globe (20% opacity)
 *  - Blue topic points (#134074) that orbit the globe
 *  - Hover shows specific topic name in tooltip
 *  - Click shows questions BELOW the globe with + buttons on right
 *  - Fade transitions between topics
 *  - Fixed height question area to prevent layout shift
 */

const KnowledgeGlobe = forwardRef(function KnowledgeGlobe(
  { gaps = [], darkness = 0, visible = false, onGapClick, size = 320 },
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const globeRotationRef = useRef(0);
  
  const [pointsRotation, setPointsRotation] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredGap, setHoveredGap] = useState(null);
  const [selectedGap, setSelectedGap] = useState(null);
  const [hoveredQuestionIdx, setHoveredQuestionIdx] = useState(null);
  const [fadeState, setFadeState] = useState('visible'); // 'visible', 'fading-out', 'fading-in'
  const [displayedGap, setDisplayedGap] = useState(null);
  const [addedQuestionIdx, setAddedQuestionIdx] = useState(null); // Track which question was added

  // Globe and orbit sizing
  const globeRadius = size / 2 - 30;
  const radius = globeRadius + 15; // Points orbit slightly outside globe
  const center = size / 2;
  const pointRadius = 8;

  // Blue color from palette
  const blueColor = '#134074';
  const filledColor = '#22C55E';

  // Handle fade transitions when selectedGap changes
  useEffect(() => {
    if (selectedGap && displayedGap && selectedGap.id !== displayedGap.id) {
      // Different gap selected - fade out then in, reset added question
      setFadeState('fading-out');
      setAddedQuestionIdx(null);
      const timer = setTimeout(() => {
        setDisplayedGap(selectedGap);
        setFadeState('fading-in');
        setTimeout(() => setFadeState('visible'), 50);
      }, 200);
      return () => clearTimeout(timer);
    } else if (selectedGap && !displayedGap) {
      // New gap selected from none, reset added question
      setDisplayedGap(selectedGap);
      setAddedQuestionIdx(null);
      setFadeState('fading-in');
      setTimeout(() => setFadeState('visible'), 50);
    } else if (!selectedGap && displayedGap) {
      // Gap deselected - fade out
      setFadeState('fading-out');
      setAddedQuestionIdx(null);
      const timer = setTimeout(() => {
        setDisplayedGap(null);
        setFadeState('visible');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedGap, displayedGap]);

  // Draw glassy 3D globe on canvas
  useEffect(() => {
    if (!visible) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animationFrame;
    
    const drawGlobe = (time) => {
      ctx.clearRect(0, 0, size, size);
      
      // Update globe rotation
      globeRotationRef.current += 0.003;
      const rot = globeRotationRef.current;
      
      // Draw glassy globe with 20% transparency
      const gradient = ctx.createRadialGradient(
        center - globeRadius * 0.3,
        center - globeRadius * 0.3,
        0,
        center,
        center,
        globeRadius
      );
      
      // Glassy transparent gradient (20% opacity)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      gradient.addColorStop(0.3, 'rgba(200, 215, 230, 0.20)');
      gradient.addColorStop(0.6, 'rgba(141, 169, 196, 0.15)');
      gradient.addColorStop(0.85, 'rgba(90, 122, 154, 0.12)');
      gradient.addColorStop(1, 'rgba(19, 64, 116, 0.10)');
      
      // Main globe
      ctx.beginPath();
      ctx.arc(center, center, globeRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Subtle rotating highlight for glassy 3D effect
      const highlightX = center + Math.cos(rot) * globeRadius * 0.2;
      const highlightY = center + Math.sin(rot * 0.7) * globeRadius * 0.15;
      
      const highlight = ctx.createRadialGradient(
        highlightX - globeRadius * 0.4,
        highlightY - globeRadius * 0.4,
        0,
        highlightX,
        highlightY,
        globeRadius * 0.8
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      highlight.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(center, center, globeRadius, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      
      // Animated latitude lines (very subtle for glass effect)
      ctx.strokeStyle = 'rgba(141, 169, 196, 0.08)';
      ctx.lineWidth = 1;
      
      for (let i = -2; i <= 2; i++) {
        const latOffset = i * 0.3;
        const y = center + Math.sin(latOffset) * globeRadius * 0.8;
        const radiusAtLat = Math.cos(latOffset) * globeRadius * 0.95;
        
        if (radiusAtLat > 0) {
          ctx.beginPath();
          ctx.ellipse(center, y, radiusAtLat, radiusAtLat * 0.15, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      
      // Animated longitude lines (rotating, subtle)
      for (let i = 0; i < 6; i++) {
        const lng = (i / 6) * Math.PI + rot;
        ctx.beginPath();
        ctx.ellipse(center, center, Math.abs(Math.sin(lng)) * globeRadius * 0.95, globeRadius * 0.95, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Subtle border ring (no glow/shadow)
      ctx.beginPath();
      ctx.arc(center, center, globeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(141, 169, 196, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      animationFrame = requestAnimationFrame(drawGlobe);
    };
    
    animationFrame = requestAnimationFrame(drawGlobe);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [visible, size, center, globeRadius]);

  // Animation loop for points rotation
  useEffect(() => {
    if (!visible) return;

    const animate = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Rotate by default, stop when hovering (slower rotation)
      if (!isHovering) {
        setPointsRotation(prev => (prev + delta * 0.003) % 360);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible, isHovering]);

  // Calculate point positions on circumference
  const getPointPosition = useCallback((index, total) => {
    const angleOffset = pointsRotation * (Math.PI / 180);
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2 + angleOffset;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      angle,
    };
  }, [pointsRotation, radius, center]);

  // Handle point hover
  const handlePointHover = useCallback((gap) => {
    setHoveredGap(gap);
    setIsHovering(true);
  }, []);

  const handlePointLeave = useCallback(() => {
    setHoveredGap(null);
    setIsHovering(false);
  }, []);

  // Handle point click - show questions below
  const handlePointClick = useCallback((gap, e) => {
    e.stopPropagation();
    if (selectedGap?.id === gap.id) {
      setSelectedGap(null);
    } else {
      setSelectedGap(gap);
    }
  }, [selectedGap]);

  // Handle adding question to chat with fade effect
  const handleAddQuestion = useCallback((question, idx) => {
    if (selectedGap) {
      // If there's already an added question, fade it out first
      if (addedQuestionIdx !== null && addedQuestionIdx !== idx) {
        setAddedQuestionIdx(null);
        // Small delay before showing new one
        setTimeout(() => {
          setAddedQuestionIdx(idx);
          onGapClick?.({ ...selectedGap, question });
        }, 150);
      } else {
        setAddedQuestionIdx(idx);
        onGapClick?.({ ...selectedGap, question });
      }
    }
  }, [selectedGap, onGapClick, addedQuestionIdx]);

  // Close when clicking outside
  const handleContainerClick = useCallback(() => {
    setSelectedGap(null);
  }, []);

  if (!visible) return null;

  const totalGaps = gaps.length;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
      style={{ width: size }}
      onClick={handleContainerClick}
    >
      {/* Globe container - no shadow */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Canvas for glassy 3D globe */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: size, height: size }}
        />

        {/* Topic points - blue circles */}
        {gaps.map((gap, index) => {
          const pos = getPointPosition(index, totalGaps);
          const isFilled = gap.filled;
          const isSelected = selectedGap?.id === gap.id;
          const isHovered = hoveredGap?.id === gap.id;
          
          const color = isFilled ? filledColor : blueColor;
          const isActive = isSelected || isHovered;

          return (
            <div
              key={gap.id}
              className="absolute"
              style={{
                left: pos.x - pointRadius,
                top: pos.y - pointRadius,
                width: pointRadius * 2,
                height: pointRadius * 2,
                zIndex: isActive ? 30 : 10,
              }}
              onMouseEnter={() => handlePointHover(gap)}
              onMouseLeave={handlePointLeave}
              onClick={(e) => handlePointClick(gap, e)}
            >
              {/* Point circle - blue */}
              <div
                className="w-full h-full rounded-full cursor-pointer transition-all duration-200"
                style={{
                  backgroundColor: isActive ? color : `${color}60`,
                  border: `2px solid ${color}`,
                  transform: isActive ? 'scale(1.4)' : 'scale(1)',
                }}
              >
                {isFilled && (
                  <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 24 24" 
                    fill="white"
                    className="p-0.5"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </div>

              {/* Tooltip on hover - shows specific topic */}
              {isHovered && !isSelected && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                  style={{
                    bottom: pointRadius * 2 + 8,
                    zIndex: 50,
                  }}
                >
                  <div
                    className="px-3 py-1.5 rounded-lg font-display text-sm font-medium"
                    style={{
                      backgroundColor: '#134074',
                      color: 'white',
                    }}
                  >
                    {gap.topic || gap.field || 'Topic'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fixed height questions area - maintains layout, centered to globe */}
      <div
        style={{
          width: size,
          minHeight: '160px',
          marginTop: '32px',
          paddingLeft: '8px',
          paddingRight: '8px',
        }}
      >
        {/* Questions panel with fade transition */}
        <div
          style={{
            opacity: fadeState === 'fading-out' ? 0 : fadeState === 'fading-in' ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          {displayedGap ? (
            <div onClick={(e) => e.stopPropagation()}>
              {/* Topic header - no bullet */}
              <span
                className="font-display font-bold text-sm uppercase tracking-wide block mb-3"
                style={{ color: '#134074' }}
              >
                {displayedGap.topic || displayedGap.field || 'Topic'}
              </span>

              {/* Questions list - left aligned with title, + icon overflows left */}
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {(displayedGap.questions || [displayedGap.question]).map((question, idx) => (
                  <li
                    key={idx}
                    className="flex items-start cursor-pointer"
                    style={{
                      padding: '4px 0',
                      position: 'relative',
                      opacity: addedQuestionIdx === idx ? 0.5 : 1,
                      transition: 'opacity 0.15s ease-in-out',
                    }}
                    onMouseEnter={() => setHoveredQuestionIdx(idx)}
                    onMouseLeave={() => setHoveredQuestionIdx(null)}
                    onClick={() => handleAddQuestion(question, idx)}
                  >
                    {/* + button on left - overflows into margin, fades in on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddQuestion(question, idx);
                      }}
                      className="shrink-0 w-5 h-5 flex items-center justify-center transition-opacity duration-150"
                      style={{
                        color: '#134074',
                        opacity: hoveredQuestionIdx === idx ? 1 : 0,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        position: 'absolute',
                        left: '-20px',
                        top: '4px',
                        cursor: 'pointer',
                      }}
                      title="Add to conversation"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    </button>
                    <span
                      className="font-body flex-1"
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.4,
                        color: '#1a1a1a',
                      }}
                    >
                      {question}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* Default hint text */
            <p
              className="font-body text-center"
              style={{
                fontSize: '13px',
                color: '#8DA9C4',
                paddingTop: '20px',
              }}
            >
              Hover for topic gaps, click for questions
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

export default KnowledgeGlobe;
