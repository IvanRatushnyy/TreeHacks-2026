import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';

function latLonToVec3(latDeg, lonDeg, radius) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);
  return new THREE.Vector3(x, y, z);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLowResNoiseTexture({ width = 128, height = 64, cellSize = 8, seed = 1, anisotropy = 1 } = {}) {
  // Simple value-noise (low frequency) for displacement.
  const rand = (() => {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const gridW = Math.ceil(width / cellSize) + 1;
  const gridH = Math.ceil(height / cellSize) + 1;
  const grid = new Float32Array(gridW * gridH);
  for (let j = 0; j < gridH; j++) {
    for (let i = 0; i < gridW; i++) {
      grid[j * gridW + i] = rand();
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(width, height);

  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  for (let y = 0; y < height; y++) {
    const gy = y / cellSize;
    const y0 = Math.floor(gy);
    const fy = smoothstep(0, 1, gy - y0);
    for (let x = 0; x < width; x++) {
      const gx = x / cellSize;
      const x0 = Math.floor(gx);
      const fx = smoothstep(0, 1, gx - x0);

      const a = grid[y0 * gridW + x0];
      const b = grid[y0 * gridW + (x0 + 1)];
      const c = grid[(y0 + 1) * gridW + x0];
      const d = grid[(y0 + 1) * gridW + (x0 + 1)];

      const u = a + (b - a) * fx;
      const v = c + (d - c) * fx;
      const value = u + (v - u) * fy;

      const idx = (y * width + x) * 4;
      const c8 = Math.floor(value * 255);
      img.data[idx + 0] = c8;
      img.data[idx + 1] = c8;
      img.data[idx + 2] = c8;
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function Atmosphere({ radius = 2.14 }) {
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#3f5574') },
        uPower: { value: 2.4 },
        uIntensity: { value: 0.09 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uIntensity;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), uPower);
          float a = fresnel * uIntensity;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    return mat;
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[radius, 96, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function arcPositionsBetween(a, b, { segments = 40, lift = 0.35 } = {}) {
  const from = a.clone().normalize();
  const to = b.clone().normalize();
  const angle = from.angleTo(to);
  const axis = new THREE.Vector3().crossVectors(from, to);
  if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
  axis.normalize();

  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle * t);
    const p = from.clone().applyQuaternion(q);
    const bulge = 1 + Math.sin(Math.PI * t) * lift;
    p.multiplyScalar(2.22 * bulge);
    out[i * 3 + 0] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

function circleOutlinePositions(centerDir, angularRadius, radius, segments = 128) {
  const c = centerDir.clone().normalize();
  const up = Math.abs(c.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(up, c).normalize();
  const v = new THREE.Vector3().crossVectors(c, u).normalize();

  const sinR = Math.sin(angularRadius);
  const cosR = Math.cos(angularRadius);

  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const p = c
      .clone()
      .multiplyScalar(cosR)
      .add(u.clone().multiplyScalar(sinR * Math.cos(t)))
      .add(v.clone().multiplyScalar(sinR * Math.sin(t)))
      .normalize()
      .multiplyScalar(radius);
    out[i * 3 + 0] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

function MissingHudArc({ groupRef, dirLocal, color, strength = 1 }) {
  const arcRef = useRef();
  const coreMatRef = useRef();
  const { camera } = useThree();
  const arcColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    if (!arcRef.current || !groupRef.current || !coreMatRef.current) return;
    const worldDir = dirLocal.clone().applyQuaternion(groupRef.current.quaternion).normalize();
    const camInv = camera.quaternion.clone().invert();
    const camDir = worldDir.clone().applyQuaternion(camInv);
    const projected = new THREE.Vector2(camDir.x, camDir.y);
    if (projected.lengthSq() < 1e-6) return;
    const angle = Math.atan2(projected.y, projected.x);
    arcRef.current.rotation.z = angle;

    const behind = camDir.z < 0 ? 0.12 : 1;
    coreMatRef.current.opacity = 0.12 + strength * 0.38 * behind;
  });

  return (
    <group ref={arcRef} renderOrder={50}>
      <mesh>
        <ringGeometry args={[2.76, 2.81, 96, 1, -0.52, 1.04]} />
        <meshBasicMaterial
          ref={coreMatRef}
          color={arcColor}
          transparent
          opacity={0.4}
          depthWrite={false}
          depthTest={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}

function DotSphere() {
  const { gl } = useThree();
  const maxAnisotropy = gl?.capabilities?.getMaxAnisotropy?.() ?? 1;
  const groupRef = useRef();
  const hudRef = useRef();
  const [targetRotation, setTargetRotation] = useState(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState(1);
  
  // Create texture once
  const circleTexture = useMemo(() => createCircleTexture(), []);

  const noiseTexture = useMemo(
    () => createLowResNoiseTexture({ width: 128, height: 64, cellSize: 14, seed: 7, anisotropy: maxAnisotropy }),
    [maxAnisotropy]
  );
  
  const detailTexture = useMemo(
    () => createLowResNoiseTexture({ width: 256, height: 128, cellSize: 3, seed: 19, anisotropy: maxAnisotropy }),
    [maxAnisotropy]
  );
  
  // Hotspots represent patient-data fields; lower completeness -> more transparency "missingness".
  const hotspots = useMemo(() => {
    const r = 2.22;
    return [
      { id: 1, lat: 32, lon: 18, label: 'Demographics', completeness: 0.92, color: '#1f6feb', position: latLonToVec3(32, 18, r) },
      { id: 2, lat: 10, lon: 110, label: 'Medications', completeness: 0.55, color: '#ff4d6d', position: latLonToVec3(10, 110, r) },
      { id: 3, lat: -22, lon: 60, label: 'Allergies', completeness: 0.68, color: '#9b5de5', position: latLonToVec3(-22, 60, r) },
      { id: 4, lat: 48, lon: -75, label: 'Labs', completeness: 0.44, color: '#ff8a00', position: latLonToVec3(48, -75, r) },
      { id: 5, lat: -12, lon: -140, label: 'Vitals', completeness: 0.86, color: '#00c27a', position: latLonToVec3(-12, -140, r) },
    ];
  }, []);

  const missingZones = useMemo(() => {
    const zones = hotspots.map((h) => {
      const missingness = clamp01(1 - h.completeness);
      const radiusDeg = 10 + missingness * 14;
      return {
        key: `hotspot-${h.id}`,
        dirLocal: latLonToVec3(h.lat, h.lon, 1).normalize(),
        angularRadius: (radiusDeg * Math.PI) / 180,
        strength: missingness * 0.8,
        color: h.color,
      };
    });

    zones.push(
      {
        key: 'ambient-1',
        dirLocal: latLonToVec3(55, -30, 1).normalize(),
        angularRadius: (14 * Math.PI) / 180,
        strength: 0.22,
        color: '#95a5bd',
      },
      {
        key: 'ambient-2',
        dirLocal: latLonToVec3(-10, 150, 1).normalize(),
        angularRadius: (12 * Math.PI) / 180,
        strength: 0.18,
        color: '#95a5bd',
      }
    );

    return zones.filter((zone) => zone.strength > 0.02);
  }, [hotspots]);

  const missingOverlayMaterial = useMemo(() => {
    const MAX = 16;
    const count = Math.min(MAX, missingZones.length);
    const dirs = Array.from({ length: MAX }, () => new THREE.Vector3(0, 1, 0));
    const radii = new Float32Array(MAX);
    const strength = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      radii[i] = 0.0001;
      strength[i] = 0;
    }
    for (let i = 0; i < count; i++) {
      dirs[i] = missingZones[i].dirLocal.clone();
      radii[i] = missingZones[i].angularRadius;
      strength[i] = missingZones[i].strength;
    }

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uCount: { value: count },
        uDirs: { value: dirs },
        uRadii: { value: radii },
        uStrength: { value: strength },
        uColor: { value: new THREE.Color('#24344b') },
        uBaseAlpha: { value: 0.74 },
        uDepth: { value: 0.12 },
      },
      vertexShader: `
        #define MAX_ZONES 16
        varying vec3 vLocalDir;
        varying float vMissing;
        uniform int uCount;
        uniform vec3 uDirs[MAX_ZONES];
        uniform float uRadii[MAX_ZONES];
        uniform float uStrength[MAX_ZONES];
        uniform float uDepth;

        float gauss(float t, float k) { return exp(-t * t * k); }

        void main() {
          vec3 n = normalize(normal);
          vLocalDir = n;
          float missing = 0.0;
          for (int i = 0; i < MAX_ZONES; i++) {
            if (i >= uCount) break;
            float d = clamp(dot(n, normalize(uDirs[i])), -1.0, 1.0);
            float a = acos(d);
            float t = a / max(1e-5, uRadii[i]);
            missing += gauss(t, 2.9) * uStrength[i];
          }
          vMissing = clamp(missing, 0.0, 1.0);
          vec3 displaced = position - n * (vMissing * uDepth);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vLocalDir;
        varying float vMissing;
        uniform vec3 uColor;
        uniform float uBaseAlpha;

        void main() {
          float alpha = clamp(vMissing * uBaseAlpha, 0.0, 0.88);
          alpha = smoothstep(0.02, 0.55, alpha);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    mat.dithering = true;
    return mat;
  }, [missingZones]);

  const connections = useMemo(
    () => [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 1],
      [1, 3],
    ],
    []
  );

  const connectionArcs = useMemo(() => {
    const byId = new Map(hotspots.map((h) => [h.id, h.position]));
    return connections
      .map(([a, b]) => {
        const pa = byId.get(a);
        const pb = byId.get(b);
        if (!pa || !pb) return null;
        return { key: `${a}-${b}`, positions: arcPositionsBetween(pa, pb, { segments: 44, lift: 0.28 }) };
      })
      .filter(Boolean);
  }, [connections, hotspots]);

  const focusHotspot = useCallback((hotspot) => {
    const targetPos = hotspot.position.clone().normalize();
    setTargetRotation(targetPos);
    setSelectedHotspotId(hotspot.id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const idx = hotspots.findIndex((h) => h.id === selectedHotspotId);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = hotspots[(idx + dir + hotspots.length) % hotspots.length];
      if (!next) return;
      focusHotspot(next);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusHotspot, hotspots, selectedHotspotId]);
  
  // Generate points on a sphere surface with triangulated edges
  const particles = useMemo(() => {
    const radius = 2.18;
    // Use sphere geometry for proper triangulation
    const geometry = new THREE.IcosahedronGeometry(radius, 5);

    const positions = new Float32Array(geometry.attributes.position.array);
    const colors = new Float32Array(positions.length);
    const count = positions.length / 3;
    
    // Create colors for each vertex
    for (let i = 0; i < count; i++) {
      const y = positions[i * 3 + 1] / radius; // [-1,1]
      const shade = 0.25 + (1 - Math.abs(y)) * 0.16;
      colors[i * 3] = shade - 0.03;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade + 0.03;
    }
    
    // Extract edges for triangulated lines
    const edges = new THREE.EdgesGeometry(geometry, 0);
    const edgePositions = new Float32Array(edges.attributes.position.array);

    return { 
      positions, 
      colors, 
      edges: edgePositions 
    };
  }, []);
  
  // Animate the sphere
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.scale.set(1, 1, 1);
      
      // Smooth rotation to target
      if (targetRotation) {
        const front = new THREE.Vector3(0, 0, 1);
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(targetRotation, front);
        groupRef.current.quaternion.slerp(targetQuat, 0.06);
      } else {
        // Gentle auto-rotation when no target
        groupRef.current.rotation.y += 0.001;
      }
    }
    if (hudRef.current) {
      hudRef.current.quaternion.copy(state.camera.quaternion);
    }
  });
  
  return (
    <group>
      <group ref={groupRef}>
        {/* Base globe: low-res displacement for a subtle "hilly" texture + alpha map for missingness */}
        <mesh>
          <sphereGeometry args={[2, 96, 64]} />
          <meshPhysicalMaterial
            color="#435973"
            roughness={0.93}
            metalness={0.03}
            clearcoat={0.18}
            clearcoatRoughness={0.92}
            depthWrite
            displacementMap={noiseTexture}
            displacementScale={0.22}
            bumpMap={detailTexture}
            bumpScale={0.05}
            emissive="#27384f"
            emissiveIntensity={0.1}
          />
        </mesh>

        {/* Missingness overlay: shader-based (no alpha texture => no "square" artifacts). */}
        <mesh renderOrder={3}>
          <sphereGeometry args={[2.01, 96, 64]} />
          <primitive object={missingOverlayMaterial} attach="material" />
        </mesh>

        {/* Zone outlines */}
        {missingZones.map((z) => {
          const positions = circleOutlinePositions(z.dirLocal, z.angularRadius, 2.03, 140);
          return (
            <lineLoop key={`outline-${z.key}`} renderOrder={4}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={positions.length / 3}
                  array={positions}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={z.color}
                transparent
                opacity={0.2 + z.strength * 0.2}
                depthWrite={false}
                depthTest={false}
                blending={THREE.NormalBlending}
              />
            </lineLoop>
          );
        })}

        <Atmosphere />

        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={particles.positions.length / 3}
              array={particles.positions}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={particles.colors.length / 3}
              array={particles.colors}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.028}
            vertexColors
            map={circleTexture}
            transparent
            alphaTest={0.35}
            opacity={0.58}
            depthWrite={false}
            blending={THREE.NormalBlending}
            sizeAttenuation={true}
          />
        </points>
        
        {/* Triangulated edges */}
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={particles.edges.length / 3}
              array={particles.edges}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#3f5575" opacity={0.2} transparent depthWrite={false} />
        </lineSegments>

        {/* High-level "data graph" connections between hotspots */}
        {connectionArcs.map((arc) => (
          <line key={arc.key}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={arc.positions.length / 3}
                array={arc.positions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#314a6a"
              opacity={0.23}
              transparent
              depthWrite={false}
              blending={THREE.NormalBlending}
            />
          </line>
        ))}
      
      {/* Hotspots */}
      {hotspots.map((hotspot) => (
        <Hotspot 
          key={hotspot.id} 
          position={hotspot.position} 
          color={hotspot.color}
          label={hotspot.label}
          completeness={hotspot.completeness}
          selected={hotspot.id === selectedHotspotId}
          globeRef={groupRef}
          onClick={() => focusHotspot(hotspot)}
        />
      ))}
      </group>

      {/* HUD-style directional arcs (like "enemy direction" indicators) */}
      <group ref={hudRef}>
        {missingZones.map((z) => (
          <MissingHudArc
            key={`hud-${z.key}`}
            groupRef={groupRef}
            dirLocal={z.dirLocal}
            color={z.color}
            strength={z.strength}
          />
        ))}
      </group>
    </group>
  );
}

// Hotspot component with glow effect
function Hotspot({ position, color, label, completeness, selected, globeRef, onClick }) {
  const meshRef = useRef();
  const hotspotRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  useCursor(hovered);
  
  useFrame((state) => {
    if (meshRef.current) meshRef.current.scale.set(1, 1, 1);

    if (hotspotRef.current && globeRef?.current) {
      const worldPos = hotspotRef.current.getWorldPosition(new THREE.Vector3());
      const surfaceNormal = worldPos.clone().normalize();
      const toCamera = state.camera.position.clone().sub(worldPos).normalize();
      const visibleNow = surfaceNormal.dot(toCamera) > 0.06;
      setCameraVisible((prev) => (prev === visibleNow ? prev : visibleNow));
    }
  });

  const showLabel = cameraVisible || hovered || selected;
  const completenessPct = Math.round(completeness * 100);
  
  return (
    <group ref={hotspotRef} position={position}>
      {/* Outer glow ring */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <ringGeometry args={[0.1, 0.13, 32]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={showLabel ? 0.52 : 0.22}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
        />
      </mesh>
      
      {/* Inner dot */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={showLabel ? 0.8 : 0.25}
        />
      </mesh>

      {showLabel && (
        <Html
          center
          style={{
            pointerEvents: 'none',
            transform: 'translate3d(0,-16px,0)',
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: '13px',
            letterSpacing: '0.6px',
            color: 'rgba(240,245,255,0.94)',
            background: 'rgba(23,34,50,0.84)',
            border: '1px solid rgba(126,162,216,0.22)',
            borderRadius: '12px',
            padding: '8px 12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 12px 30px rgba(22,31,45,0.28)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {label} <span style={{ opacity: 0.75 }}>{completenessPct}%</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export default DotSphere;
