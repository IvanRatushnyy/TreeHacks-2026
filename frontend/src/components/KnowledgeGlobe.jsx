import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

/**
 * KnowledgeGlobe — Stunning 3D sphere visualization for knowledge gaps
 * 
 * Features:
 *  - Real 3D rendering with Canvas API
 *  - Smooth rotation with mouse drag
 *  - Glowing markers with 3D depth
 *  - Floating labels that track markers
 *  - Atmospheric glow effect
 *  - Mesh gradient that darkens as gaps fill
 */

// Color palette matching design system
const COLORS = {
  light: {
    base: 'rgba(255, 255, 255, 0.95)',
    grid: 'rgba(141, 169, 196, 0.15)',
  },
  dark: {
    core: '#134074',
    mid: '#2A5F8C',
  },
  // Standardized marker color - design palette blue
  marker: { 
    color: '#8DA9C4', 
    glow: 'rgba(141, 169, 196, 0.5)',
    filled: '#22C55E',
    filledGlow: 'rgba(34, 197, 94, 0.5)',
  },
};

const KnowledgeGlobe = forwardRef(function KnowledgeGlobe(
  { gaps = [], darkness = 0, visible = false, onGapClick, size = 220 },
  ref
) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0.3 }); // Auto-rotate Y
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const [hoveredGap, setHoveredGap] = useState(null);
  const gapsRef = useRef(gaps);
  
  const radius = size / 2 - 8; // Minimal padding
  const center = { x: size / 2, y: size / 2 };

  // Update gaps ref when props change
  useEffect(() => {
    gapsRef.current = gaps;
  }, [gaps]);

  // Project 3D point to 2D with rotation
  const project3D = useCallback((lat, lng) => {
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    
    // Apply rotation
    const rx = rotationRef.current.x;
    const ry = rotationRef.current.y;
    
    // Spherical to Cartesian
    let x = Math.cos(latRad) * Math.sin(lngRad);
    let y = Math.sin(latRad);
    let z = Math.cos(latRad) * Math.cos(lngRad);
    
    // Rotate around Y axis
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const newX = x * cosY - z * sinY;
    const newZ = x * sinY + z * cosY;
    x = newX;
    z = newZ;
    
    // Rotate around X axis  
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const newY = y * cosX - z * sinX;
    const newZ2 = y * sinX + z * cosX;
    y = newY;
    z = newZ2;
    
    // Perspective projection
    const scale = 1 / (1 + z * 0.3);
    
    return {
      x: center.x + x * radius * scale,
      y: center.y - y * radius * scale,
      z,
      scale,
      visible: true, // Always visible, just more transparent at back
      depth: (z + 1) / 2, // 0-1, front to back
    };
  }, [center.x, center.y, radius]);

  // Draw the globe
  const draw = useCallback((ctx, time) => {
    const currentGaps = gapsRef.current;
    ctx.clearRect(0, 0, size, size);
    
    // Calculate colors based on darkness
    const bgAlpha = 0.95 - darkness * 0.3;
    const gridAlpha = 0.15 + darkness * 0.1;
    
    // Main sphere gradient
    const sphereGradient = ctx.createRadialGradient(
      center.x - radius * 0.3, center.y - radius * 0.3, 0,
      center.x, center.y, radius
    );
    
    // Interpolate colors based on darkness
    const r1 = Math.round(255 - darkness * (255 - 19));
    const g1 = Math.round(255 - darkness * (255 - 64));
    const b1 = Math.round(255 - darkness * (255 - 116));
    const r2 = Math.round(238 - darkness * (238 - 42));
    const g2 = Math.round(244 - darkness * (244 - 95));
    const b2 = Math.round(237 - darkness * (237 - 140));
    const r3 = Math.round(213 - darkness * (213 - 141));
    const g3 = Math.round(226 - darkness * (226 - 169));
    const b3 = Math.round(239 - darkness * (239 - 196));
    
    sphereGradient.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${bgAlpha})`);
    sphereGradient.addColorStop(0.5, `rgba(${r2}, ${g2}, ${b2}, ${bgAlpha})`);
    sphereGradient.addColorStop(1, `rgba(${r3}, ${g3}, ${b3}, ${bgAlpha - 0.1})`);
    
    ctx.fillStyle = sphereGradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Subtle inner shadow for depth
    const innerShadow = ctx.createRadialGradient(
      center.x + radius * 0.2, center.y + radius * 0.2, radius * 0.3,
      center.x, center.y, radius
    );
    innerShadow.addColorStop(0, 'transparent');
    innerShadow.addColorStop(0.7, 'transparent');
    innerShadow.addColorStop(1, `rgba(0, 0, 0, ${0.1 + darkness * 0.15})`);
    ctx.fillStyle = innerShadow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw latitude lines
    ctx.strokeStyle = `rgba(141, 169, 196, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      for (let lng = 0; lng <= 360; lng += 5) {
        const p = project3D(lat, lng);
        if (lng === 0) {
          ctx.moveTo(p.x, p.y);
        } else if (p.visible) {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    
    // Draw longitude lines
    for (let lng = 0; lng < 360; lng += 30) {
      ctx.beginPath();
      for (let lat = -90; lat <= 90; lat += 5) {
        const p = project3D(lat, lng);
        if (lat === -90) {
          ctx.moveTo(p.x, p.y);
        } else if (p.visible) {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    
    // Sort gaps by depth (back to front) - don't filter, show all
    const sortedGaps = [...currentGaps]
      .map(gap => ({
        ...gap,
        projected: project3D(gap.position.lat, gap.position.lng),
      }))
      .sort((a, b) => a.projected.z - b.projected.z);
    
    // Draw markers - standardized single color
    sortedGaps.forEach((gap) => {
      const p = gap.projected;
      const markerColor = gap.filled ? COLORS.marker.filled : COLORS.marker.color;
      const glowColor = gap.filled ? COLORS.marker.filledGlow : COLORS.marker.glow;
      const pulseScale = gap.filled ? 1 : 1 + Math.sin(time * 3) * 0.1;
      const baseSize = 7 * p.scale;
      const markerSize = baseSize * pulseScale;
      // Alpha based on depth: front (z=1) is full opacity, back (z=-1) is very transparent
      const depthAlpha = 0.15 + p.depth * 0.85; // Range from 0.15 to 1.0
      const alpha = gap.filled ? depthAlpha * 0.4 : depthAlpha;
      
      // Subtle glow effect only for front-facing markers
      if (!gap.filled && p.z > 0) {
        const glowGradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, markerSize * 2
        );
        glowGradient.addColorStop(0, `rgba(141, 169, 196, ${alpha * 0.4})`);
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, markerSize * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Main marker
      ctx.globalAlpha = alpha;
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, markerSize, 0, Math.PI * 2);
      ctx.fill();
      
      // White highlight only for front-facing markers
      if (p.z > 0.3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.x - markerSize * 0.25, p.y - markerSize * 0.25, markerSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
    });
    
    // Top highlight for 3D effect
    const highlight = ctx.createRadialGradient(
      center.x - radius * 0.4, center.y - radius * 0.4, 0,
      center.x - radius * 0.4, center.y - radius * 0.4, radius * 0.6
    );
    highlight.addColorStop(0, `rgba(255, 255, 255, ${0.4 - darkness * 0.2})`);
    highlight.addColorStop(1, 'transparent');
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Rim light
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 - darkness * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [center.x, center.y, darkness, project3D, radius, size]);

  // Animation loop
  useEffect(() => {
    if (!visible || !canvasRef.current) {
      startTimeRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const time = (timestamp - startTimeRef.current) / 1000;
      
      // Apply velocity with damping
      if (!isDraggingRef.current) {
        rotationRef.current.x += velocityRef.current.x * 0.016;
        rotationRef.current.y += velocityRef.current.y * 0.016;
        
        // Damping
        velocityRef.current.x *= 0.98;
        // Keep Y rotation going but dampen excessive speed
        if (Math.abs(velocityRef.current.y) > 0.5) {
          velocityRef.current.y *= 0.99;
        } else if (Math.abs(velocityRef.current.y) < 0.2) {
          velocityRef.current.y = 0.3; // Maintain minimum rotation
        }
      }
      
      draw(ctx, time);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, draw, size]);

  // Mouse/touch handlers for dragging
  const handlePointerDown = useCallback((e) => {
    isDraggingRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    lastMouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const handlePointerMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDraggingRef.current) {
      const dx = x - lastMouseRef.current.x;
      const dy = y - lastMouseRef.current.y;
      
      // Natural drag direction (not inverted)
      rotationRef.current.y -= dx * 0.01;
      rotationRef.current.x -= dy * 0.01;
      
      // Clamp X rotation to avoid flipping
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));
      
      // Store velocity for momentum (also inverted)
      velocityRef.current = { x: -dy * 0.5, y: -dx * 0.5 };
      
      lastMouseRef.current = { x, y };
    } else {
      // Check for hover over markers - prioritize front-facing ones
      const currentGaps = gapsRef.current;
      let foundHover = null;
      let bestZ = -Infinity;
      
      for (const gap of currentGaps) {
        const p = project3D(gap.position.lat, gap.position.lng);
        // Only allow hover on front-facing markers (z > 0)
        if (p.z > 0) {
          const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
          if (dist < 15 && p.z > bestZ) {
            foundHover = gap;
            bestZ = p.z;
          }
        }
      }
      
      setHoveredGap(foundHover);
    }
  }, [project3D]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleClick = useCallback((e) => {
    if (!onGapClick) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const currentGaps = gapsRef.current;
    let bestGap = null;
    let bestZ = -Infinity;
    
    for (const gap of currentGaps) {
      const p = project3D(gap.position.lat, gap.position.lng);
      // Only allow click on front-facing markers (z > 0)
      if (p.z > 0) {
        const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
        if (dist < 15 && p.z > bestZ) {
          bestGap = gap;
          bestZ = p.z;
        }
      }
    }
    
    if (bestGap) {
      onGapClick(bestGap);
    }
  }, [onGapClick, project3D]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    resetRotation: () => {
      rotationRef.current = { x: 0, y: 0 };
      velocityRef.current = { x: 0, y: 0.3 };
    },
  }), []);

  // Get hovered gap position for tooltip
  const getTooltipPosition = useCallback(() => {
    if (!hoveredGap) return null;
    const p = project3D(hoveredGap.position.lat, hoveredGap.position.lng);
    return { x: p.x, y: p.y };
  }, [hoveredGap, project3D]);

  const tooltipPos = getTooltipPosition();

  return (
    <div 
      className="relative"
      style={{
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          cursor: hoveredGap ? 'pointer' : 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
      />
      
      {/* Floating tooltip - interactive with button */}
      {hoveredGap && tooltipPos && (
        <div
          className="absolute"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%) translateY(-12px)',
            animation: 'fadeIn 0.2s ease-out',
            zIndex: 50,
          }}
        >
          <div
            className="px-3 py-2.5 rounded-lg shadow-lg max-w-52"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(12px)',
              border: `2px solid ${COLORS.marker.color}`,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div className="text-xs leading-relaxed mb-2" style={{ color: '#1a1a1a' }}>
              {hoveredGap.question}
            </div>
            {hoveredGap.filled ? (
              <div 
                className="flex items-center gap-1.5 text-xs font-medium" 
                style={{ color: COLORS.marker.filled }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                Addressed
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onGapClick) onGapClick(hoveredGap);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: COLORS.marker.color,
                  color: 'white',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add to Discussion
              </button>
            )}
          </div>
          {/* Arrow pointing to marker */}
          <div
            style={{
              width: 0,
              height: 0,
              margin: '0 auto',
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${COLORS.marker.color}`,
            }}
          />
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
});

export default KnowledgeGlobe;
