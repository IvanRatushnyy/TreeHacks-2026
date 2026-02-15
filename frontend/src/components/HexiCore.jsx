import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import React from 'react';

/* ──────────────────────────────────────────────────────────────
   HexiCore — central hexagon with organic path morphing,
   dynamic mesh gradient, context-darkness system, and
   pulsing rings centered on the hexagon.
   ────────────────────────────────────────────────────────────── */

// Center of the viewBox
const CX = 115.75;
const CY = 115.75;

// The 12 junction points of the hexagon (pairs: start-of-edge, end-of-edge)
const BASE_POINTS = [
  { x: 90.75, y: 14.4338 },   { x: 140.75, y: 14.4338 },
  { x: 190.992, y: 43.4412 }, { x: 215.992, y: 86.7425 },
  { x: 215.992, y: 144.757 }, { x: 190.992, y: 188.059 },
  { x: 140.75, y: 217.066 },  { x: 90.75, y: 217.066 },
  { x: 40.5076, y: 188.059 }, { x: 15.5076, y: 144.757 },
  { x: 15.5076, y: 86.7425 }, { x: 40.5076, y: 43.4412 },
];

// Cubic bezier handles for the 6 rounded corners
const CURVES = [
  { cp1x: 106.22, cp1y: 5.50212, cp2x: 125.28, cp2y: 5.50212 },
  { cp1x: 206.462, cp1y: 52.3729, cp2x: 215.992, cp2y: 68.8792 },
  { cp1x: 215.992, cp1y: 162.621, cp2x: 206.462, cp2y: 179.127 },
  { cp1x: 125.28, cp1y: 225.998, cp2x: 106.22, cp2y: 225.998 },
  { cp1x: 25.0375, cp1y: 179.127, cp2x: 15.5076, cp2y: 162.621 },
  { cp1x: 15.5076, cp1y: 68.8792, cp2x: 25.0375, cp2y: 52.3729 },
];

// Per-point sine configs — ~2× faster frequencies than before
const POINT_WAVE_CONFIGS = [
  { ax: 2.4, ay: 1.8, freq: 0.30, phase: 0 },
  { ax: 2.6, ay: 1.6, freq: 0.26, phase: 1.0 },
  { ax: 1.8, ay: 2.8, freq: 0.34, phase: 2.1 },
  { ax: 2.4, ay: 2.4, freq: 0.24, phase: 3.3 },
  { ax: 2.2, ay: 2.6, freq: 0.28, phase: 4.2 },
  { ax: 2.7, ay: 2.1, freq: 0.32, phase: 5.1 },
  { ax: 2.5, ay: 2.0, freq: 0.26, phase: 0.7 },
  { ax: 2.3, ay: 2.5, freq: 0.30, phase: 1.9 },
  { ax: 2.8, ay: 1.7, freq: 0.22, phase: 2.8 },
  { ax: 2.0, ay: 2.7, freq: 0.36, phase: 3.7 },
  { ax: 2.4, ay: 2.3, freq: 0.28, phase: 4.9 },
  { ax: 1.9, ay: 2.8, freq: 0.32, phase: 5.8 },
];

/** Compute warped point at time t (seconds). */
function warpedPoint(idx, t) {
  const base = BASE_POINTS[idx];
  const cfg = POINT_WAVE_CONFIGS[idx];
  const dx = base.x - CX;
  const dy = base.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist;
  const ny = dy / dist;
  const radial = Math.sin(t * cfg.freq * Math.PI * 2 + cfg.phase) * cfg.ax;
  const tangential = Math.cos(t * cfg.freq * Math.PI * 2 + cfg.phase * 1.3) * cfg.ay * 0.5;
  return {
    x: base.x + nx * radial - ny * tangential,
    y: base.y + ny * radial + nx * tangential,
  };
}

function warpedControl(cpx, cpy, baseAnchor, warpedAnchor) {
  return {
    x: cpx + (warpedAnchor.x - baseAnchor.x),
    y: cpy + (warpedAnchor.y - baseAnchor.y),
  };
}

/** Build the full SVG path `d` for time t. */
function buildHexPath(t) {
  const p = Array.from({ length: 12 }, (_, i) => warpedPoint(i, t));
  const c = CURVES.map((curve, i) => {
    const cp1 = warpedControl(curve.cp1x, curve.cp1y, BASE_POINTS[i * 2], p[i * 2]);
    const cp2 = warpedControl(curve.cp2x, curve.cp2y, BASE_POINTS[i * 2 + 1], p[i * 2 + 1]);
    return { cp1, cp2 };
  });
  const f = (n) => n.toFixed(3);
  return [
    `M${f(p[0].x)} ${f(p[0].y)}`,
    `C${f(c[0].cp1.x)} ${f(c[0].cp1.y)} ${f(c[0].cp2.x)} ${f(c[0].cp2.y)} ${f(p[1].x)} ${f(p[1].y)}`,
    `L${f(p[2].x)} ${f(p[2].y)}`,
    `C${f(c[1].cp1.x)} ${f(c[1].cp1.y)} ${f(c[1].cp2.x)} ${f(c[1].cp2.y)} ${f(p[3].x)} ${f(p[3].y)}`,
    `L${f(p[4].x)} ${f(p[4].y)}`,
    `C${f(c[2].cp1.x)} ${f(c[2].cp1.y)} ${f(c[2].cp2.x)} ${f(c[2].cp2.y)} ${f(p[5].x)} ${f(p[5].y)}`,
    `L${f(p[6].x)} ${f(p[6].y)}`,
    `C${f(c[3].cp1.x)} ${f(c[3].cp1.y)} ${f(c[3].cp2.x)} ${f(c[3].cp2.y)} ${f(p[7].x)} ${f(p[7].y)}`,
    `L${f(p[8].x)} ${f(p[8].y)}`,
    `C${f(c[4].cp1.x)} ${f(c[4].cp1.y)} ${f(c[4].cp2.x)} ${f(c[4].cp2.y)} ${f(p[9].x)} ${f(p[9].y)}`,
    `L${f(p[10].x)} ${f(p[10].y)}`,
    `C${f(c[5].cp1.x)} ${f(c[5].cp1.y)} ${f(c[5].cp2.x)} ${f(c[5].cp2.y)} ${f(p[11].x)} ${f(p[11].y)}`,
    'Z',
  ].join('');
}

/* ──────── Gradient configs — ~2× faster orbits ──────── */
const GRAD_CONFIGS = [
  { cx: 188, cy: 54, r: 210, angle0: 125.87, orbitR: 35, orbitFreq: 0.08, rotFreq: 0.05, phase: 0 },
  { cx: 60, cy: 180, r: 180, angle0: 45, orbitR: 30, orbitFreq: 0.12, rotFreq: 0.07, phase: 2.0 },
  { cx: 140, cy: 100, r: 150, angle0: 200, orbitR: 25, orbitFreq: 0.15, rotFreq: 0.09, phase: 4.0 },
];

function computeGradientTransform(cfg, t) {
  const angle = cfg.angle0 + Math.sin(t * cfg.rotFreq * Math.PI * 2 + cfg.phase) * 18;
  const cx = cfg.cx + Math.sin(t * cfg.orbitFreq * Math.PI * 2 + cfg.phase) * cfg.orbitR;
  const cy = cfg.cy + Math.cos(t * cfg.orbitFreq * Math.PI * 2 + cfg.phase * 1.2) * cfg.orbitR;
  return `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${cfg.r} ${(cfg.r * 1.77).toFixed(1)})`;
}

/* ──────── Pulsing ring system ──────── */
const RING_INTERVAL_MS = 1800; // new ring every 1.8s
const RING_LIFETIME_MS = 3600; // each ring lives 3.6s
const RING_MAX_RADIUS = 190;   // max radius in px
const RING_START_RADIUS = 116; // start at hexagon edge

/* ──────────────────────────────────────────────────────────────
   Component (forwardRef so parent can call addContext)
   ────────────────────────────────────────────────────────────── */
const HexiCore = forwardRef(function HexiCore(
  { isListening = false, audioLevel = 0, onToggleListening },
  ref,
) {
  const hexSize = 232;

  // Refs for SVG DOM manipulation
  const pathRef = useRef(null);
  const path2Ref = useRef(null);
  const path3Ref = useRef(null);
  const pathDarkRef = useRef(null);
  const grad1Ref = useRef(null);
  const grad2Ref = useRef(null);
  const grad3Ref = useRef(null);
  const gradDarkRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  /* ── Context-darkness system ──
   * contextLevel (0-1): 0 = fully light/idle, 1 = fully dark/saturated.
   * Drives a 4th overlay gradient that fades in with opacity = contextLevel.
   * Call addContext(amount) to bump it up (clamped to 1). */
  const contextLevelRef = useRef(0);         // current rendered value (smoothed)
  const contextTargetRef = useRef(0);        // target value
  const darkOverlayRef = useRef(null);       // the <path> element for the dark overlay

  /**
   * addContext(amount = 0.15) — bump the darkness level.
   * Can be called externally via the ref: hexiRef.current.addContext(0.2)
   */
  const addContext = useCallback((amount = 0.15) => {
    contextTargetRef.current = Math.min(1, contextTargetRef.current + amount);
  }, []);

  /** resetContext() — reset darkness back to 0 */
  const resetContext = useCallback(() => {
    contextTargetRef.current = 0;
  }, []);

  // Expose addContext/resetContext to parent via ref
  useImperativeHandle(ref, () => ({ addContext, resetContext }), [addContext, resetContext]);

  // Fade-in state
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Track if user has ever listened (to change welcome message)
  const [hasEverListened, setHasEverListened] = useState(false);
  useEffect(() => {
    if (isListening) {
      setHasEverListened(true);
    }
  }, [isListening]);

  // Context level state for text color (updated from animation loop)
  const [contextLevel, setContextLevel] = useState(0);
  const lastReportedLevelRef = useRef(0); // avoid stale closure

  // Status text with fade state
  const statusText = !hasEverListened ? 'Welcome to Hexi!' : (isListening ? 'Listening...' : 'Ready to Help!');
  const [displayText, setDisplayText] = useState(statusText);
  const [textFading, setTextFading] = useState(false);

  // Fade text when statusText changes
  useEffect(() => {
    if (displayText !== statusText) {
      setTextFading(true);
      const timer = setTimeout(() => {
        setDisplayText(statusText);
        setTextFading(false);
      }, 500); // fade out duration
      return () => clearTimeout(timer);
    }
  }, [statusText, displayText]);

  /* ── Pulsing rings state ── */
  const [rings, setRings] = useState([]);
  const ringIntervalRef = useRef(null);
  const ringCleanupRef = useRef(null);

  useEffect(() => {
    if (isListening) {
      // Spawn a ring immediately, then every RING_INTERVAL_MS
      const spawnRing = () => {
        const id = Date.now() + Math.random();
        setRings((prev) => [...prev, { id, born: Date.now(), fadeOut: false }]);
      };
      spawnRing();
      ringIntervalRef.current = setInterval(spawnRing, RING_INTERVAL_MS);

      // Cleanup expired rings every second
      ringCleanupRef.current = setInterval(() => {
        setRings((prev) => prev.filter((r) => Date.now() - r.born < RING_LIFETIME_MS));
      }, 1000);
    } else {
      clearInterval(ringIntervalRef.current);
      clearInterval(ringCleanupRef.current);
      
      // Filter rings: remove small ones (hidden behind hexagon), mark visible ones for fade out
      const now = Date.now();
      setRings((prev) => prev.filter((r) => {
        const age = now - r.born;
        const progress = age / RING_LIFETIME_MS;
        const radius = RING_START_RADIUS + (RING_MAX_RADIUS - RING_START_RADIUS) * progress;
        // Keep ring if it's already grown past the hexagon edge (visible)
        return radius > RING_START_RADIUS + 20; // 20px buffer to ensure visibility
      }).map(r => ({ ...r, fadeOut: true })));
      
      // Continue cleanup for remaining visible rings
      ringCleanupRef.current = setInterval(() => {
        setRings((prev) => prev.filter((r) => Date.now() - r.born < RING_LIFETIME_MS));
      }, 1000);
    }
    return () => {
      clearInterval(ringIntervalRef.current);
      clearInterval(ringCleanupRef.current);
    };
  }, [isListening]);

  /* ── Main animation loop ── */
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const t = (timestamp - startTimeRef.current) / 1000;

    // Path morphing
    const d = buildHexPath(t);
    if (pathRef.current) pathRef.current.setAttribute('d', d);
    if (path2Ref.current) path2Ref.current.setAttribute('d', d);
    if (path3Ref.current) path3Ref.current.setAttribute('d', d);
    if (pathDarkRef.current) pathDarkRef.current.setAttribute('d', d);

    // Gradient transforms
    if (grad1Ref.current) {
      grad1Ref.current.setAttribute('gradientTransform', computeGradientTransform(GRAD_CONFIGS[0], t));
    }
    if (grad2Ref.current) {
      grad2Ref.current.setAttribute('gradientTransform', computeGradientTransform(GRAD_CONFIGS[1], t));
    }
    if (grad3Ref.current) {
      grad3Ref.current.setAttribute('gradientTransform', computeGradientTransform(GRAD_CONFIGS[2], t));
    }
    // Dark overlay gradient also drifts
    if (gradDarkRef.current) {
      const darkCfg = { cx: 115, cy: 115, r: 140, angle0: 0, orbitR: 20, orbitFreq: 0.06, rotFreq: 0.04, phase: 1.5 };
      gradDarkRef.current.setAttribute('gradientTransform', computeGradientTransform(darkCfg, t));
    }

    // Smooth contextLevel toward target
    const target = contextTargetRef.current;
    const current = contextLevelRef.current;
    if (Math.abs(target - current) > 0.001) {
      contextLevelRef.current += (target - current) * 0.05; // ease toward target
    } else {
      contextLevelRef.current = target;
    }
    const newLevel = contextLevelRef.current;
    if (darkOverlayRef.current) {
      darkOverlayRef.current.style.opacity = String(newLevel);
    }
    // Update React state for text color (throttled via ref comparison)
    if (Math.abs(newLevel - lastReportedLevelRef.current) > 0.01 || (newLevel === target && newLevel !== lastReportedLevelRef.current)) {
      lastReportedLevelRef.current = newLevel;
      setContextLevel(newLevel);
      console.log('[HexiCore] contextLevel:', newLevel.toFixed(4), 'target:', target.toFixed(4));
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animate]);

  const initialPath = buildHexPath(0);

  return (
    <div className="flex flex-col items-center justify-center relative">
      {/* ── Hexagon + rings wrapper (rings centered on hex, not on text) ── */}
      <div className="relative" style={{ width: hexSize, height: hexSize }}>
        {/* Pulsing rings — absolutely positioned, centered on the hex */}
        {rings.map((ring) => (
          <PulsingRing key={ring.id} born={ring.born} fadeOut={ring.fadeOut} />
        ))}

        {/* Hexagon */}
        <div
          className="relative z-10"
          style={{
            width: hexSize,
            height: hexSize,
            cursor: onToggleListening ? 'pointer' : undefined,
            opacity: 0,
            animation: hasMounted ? 'hexFadeIn 1.2s ease-out forwards' : 'none',
            // Listening: more prominent audio-reactive scale + rotation
            ...(isListening
              ? {
                  transform: `scaleX(${1 + audioLevel * 0.12}) scaleY(${1 + audioLevel * 0.16}) rotate(${(audioLevel * 2.5 - 1.25).toFixed(2)}deg)`,
                  transition: 'transform 0.08s ease-out',
                }
              : {
                  // Idle: smooth return to base scale
                  transform: 'scale(1) rotate(0deg)',
                  transition: 'transform 0.4s ease-out',
                }),
          }}
          onClick={onToggleListening}
          role={onToggleListening ? 'button' : undefined}
          tabIndex={onToggleListening ? 0 : undefined}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          onKeyDown={(e) => {
            if (onToggleListening && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onToggleListening();
            }
          }}
        >
          <svg
            width={hexSize}
            height={hexSize}
            viewBox="0 0 231.5 231.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              {/* Gradient 1 — light-dominant base (Powder Blue → Mint Cream → light Regal) */}
              <radialGradient
                ref={grad1Ref}
                id="hexiGrad1"
                cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={computeGradientTransform(GRAD_CONFIGS[0], 0)}
              >
                <stop stopColor="#8DA9C4" />
                <stop offset="0.35" stopColor="#B8CCE0" />
                <stop offset="0.7" stopColor="#D5E2EF" />
                <stop offset="1" stopColor="#EEF4ED" />
              </radialGradient>

              {/* Gradient 2 — soft depth (subtle navy touches) */}
              <radialGradient
                ref={grad2Ref}
                id="hexiGrad2"
                cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={computeGradientTransform(GRAD_CONFIGS[1], 0)}
              >
                <stop stopColor="#134074" stopOpacity="0.25" />
                <stop offset="0.5" stopColor="#8DA9C4" stopOpacity="0.15" />
                <stop offset="1" stopColor="#EEF4ED" stopOpacity="0" />
              </radialGradient>

              {/* Gradient 3 — highlight shimmer */}
              <radialGradient
                ref={grad3Ref}
                id="hexiGrad3"
                cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={computeGradientTransform(GRAD_CONFIGS[2], 0)}
              >
                <stop stopColor="#FFFFFF" stopOpacity="0.3" />
                <stop offset="0.4" stopColor="#D5E2EF" stopOpacity="0.15" />
                <stop offset="1" stopColor="#8DA9C4" stopOpacity="0" />
              </radialGradient>

              {/* Gradient 4 — dark overlay (context fill) */}
              <radialGradient
                ref={gradDarkRef}
                id="hexiGradDark"
                cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={computeGradientTransform(
                  { cx: 115, cy: 115, r: 140, angle0: 0, orbitR: 20, orbitFreq: 0.06, rotFreq: 0.04, phase: 1.5 }, 0
                )}
              >
                <stop stopColor="#0B2545" />
                <stop offset="0.25" stopColor="#13315C" />
                <stop offset="0.6" stopColor="#134074" />
                <stop offset="1" stopColor="#0B2545" stopOpacity="0.8" />
              </radialGradient>
            </defs>

            {/* Layer 1 — light base */}
            <path ref={pathRef} d={initialPath} fill="url(#hexiGrad1)" />
            {/* Layer 2 — soft depth */}
            <path ref={path2Ref} d={initialPath} fill="url(#hexiGrad2)" />
            {/* Layer 3 — highlight shimmer */}
            <path ref={path3Ref} d={initialPath} fill="url(#hexiGrad3)" style={{ mixBlendMode: 'screen' }} />
            {/* Layer 4 — dark context overlay (opacity driven by contextLevel) */}
            <path d={initialPath} fill="url(#hexiGradDark)"
              style={{ opacity: 0 }}
              ref={(el) => { pathDarkRef.current = el; darkOverlayRef.current = el; }}
            />

            {/* Microphone icon - fades out when listening */}
            <g style={{ 
              opacity: isListening ? 0 : 0.85,
              transition: 'opacity 0.4s ease-out',
            }}>
              <mask id="micMask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="100" y="105" width="32" height="32">
                <rect x="100.358" y="105.283" width="30.7846" height="30.7846" fill="#D9D9D9" />
              </mask>
              <g mask="url(#micMask)">
                <path
                  d="M113.024 122.119C112.276 121.37 111.902 120.462 111.902 119.393V111.697C111.902 110.628 112.276 109.719 113.024 108.971C113.773 108.223 114.681 107.849 115.75 107.849C116.819 107.849 117.727 108.223 118.476 108.971C119.224 109.719 119.598 110.628 119.598 111.697V119.393C119.598 120.462 119.224 121.37 118.476 122.119C117.727 122.867 116.819 123.241 115.75 123.241C114.681 123.241 113.773 122.867 113.024 122.119ZM114.467 132.22V128.275C112.244 127.976 110.405 126.982 108.952 125.293C107.498 123.604 106.771 121.638 106.771 119.393H109.337C109.337 121.167 109.962 122.68 111.212 123.93C112.463 125.181 113.976 125.806 115.75 125.806C117.524 125.806 119.037 125.181 120.288 123.93C121.538 122.68 122.163 121.167 122.163 119.393H124.729C124.729 121.638 124.002 123.604 122.548 125.293C121.095 126.982 119.256 127.976 117.033 128.275V132.22H114.467ZM116.664 120.307C116.91 120.061 117.033 119.756 117.033 119.393V111.697C117.033 111.333 116.91 111.029 116.664 110.783C116.418 110.537 116.113 110.414 115.75 110.414C115.387 110.414 115.082 110.537 114.836 110.783C114.59 111.029 114.467 111.333 114.467 111.697V119.393C114.467 119.756 114.59 120.061 114.836 120.307C115.082 120.553 115.387 120.676 115.75 120.676C116.113 120.676 116.418 120.553 116.664 120.307Z"
                  fill="white"
                />
              </g>
            </g>

            {/* Sound visualizer - fades in when listening */}
            <g style={{ 
              opacity: isListening ? 0.85 : 0,
              transition: 'opacity 0.4s ease-out',
            }}>
              <SoundVisualizer audioLevel={audioLevel} />
            </g>
          </svg>
        </div>
      </div>

      {/* ── Status text ── */}
      <div
        className="font-display text-center capitalize relative z-10"
        style={{
          // Interpolate color from light navy (powder blue) to dark navy based on contextLevel
          color: `rgb(${
            Math.round(141 - contextLevel * (141 - 11))
          }, ${
            Math.round(169 - contextLevel * (169 - 37))
          }, ${
            Math.round(196 - contextLevel * (196 - 69))
          })`,
          fontSize: '14px',
          fontWeight: 400,
          letterSpacing: '2.1px',
          marginTop: '16px',
          opacity: 0,
          animation: hasMounted && !textFading ? 'textFadeIn 0.8s ease-out 0.6s forwards' : 'none',
          transition: 'color 0.6s ease, opacity 0.5s ease-out',
        }}
      >
        {displayText}
      </div>
    </div>
  );
});

export default HexiCore;

/* ── Pulsing Ring sub-component ── */
function PulsingRing({ born, fadeOut = false }) {
  const [isFading, setIsFading] = React.useState(false);
  
  React.useEffect(() => {
    if (fadeOut && !isFading) {
      setIsFading(true);
    }
  }, [fadeOut, isFading]);

  const elapsed = Date.now() - born;
  const progress = Math.min(elapsed / RING_LIFETIME_MS, 1);
  const radius = RING_START_RADIUS + (RING_MAX_RADIUS - RING_START_RADIUS) * progress;
  const size = radius * 2;

  return (
    <svg
      className="absolute pointer-events-none"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        animation: `ringPulse ${RING_LIFETIME_MS}ms ease-out forwards`,
        ...(isFading ? { opacity: 0, transition: 'opacity 0.6s ease-out' } : {}),
      }}
    >
      <circle cx={radius} cy={radius} r={radius - 0.5} stroke="#134074" strokeOpacity="1" strokeWidth="1" />
    </svg>
  );
}

/* ── Sound Visualizer — 3 bars that react to audioLevel ── */
function SoundVisualizer({ audioLevel }) {
  // 3 bars with different heights based on audio level
  // Center position in the hex viewBox (same as mic icon area)
  const baseX = 109;
  const baseY = 120;
  const barWidth = 4;
  const barGap = 3;
  const maxBarHeight = 18;
  
  // Different multipliers for each bar to create varied motion
  const bar1Height = Math.max(4, maxBarHeight * audioLevel * 0.8 + Math.sin(Date.now() / 100) * 2);
  const bar2Height = Math.max(4, maxBarHeight * audioLevel * 1.13 + Math.sin(Date.now() / 120 + 1) * 2);
  const bar3Height = Math.max(4, maxBarHeight * audioLevel * 0.9 + Math.sin(Date.now() / 90 + 2) * 2);

  return (
    <g>
      {/* Bar 1 */}
      <rect
        x={baseX}
        y={baseY - bar1Height / 2}
        width={barWidth}
        height={bar1Height}
        fill="white"
        rx={2}
      />
      {/* Bar 2 */}
      <rect
        x={baseX + barWidth + barGap}
        y={baseY - bar2Height / 2}
        width={barWidth}
        height={bar2Height}
        fill="white"
        rx={2}
      />
      {/* Bar 3 */}
      <rect
        x={baseX + (barWidth + barGap) * 2}
        y={baseY - bar3Height / 2}
        width={barWidth}
        height={bar3Height}
        fill="white"
        rx={2}
      />
    </g>
  );
}
