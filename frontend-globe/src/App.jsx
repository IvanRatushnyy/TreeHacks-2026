import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import DotSphere from './components/DotSphere';
import './App.css';

function App() {
  return (
    <div className="appRoot">
      {/* Title overlay */}
      <div className="appTitle">
        Patient Atlas
      </div>
      
      {/* Instructions */}
      <div className="appHint">
        Click hotspots or use ←/→ to navigate • Drag to rotate
      </div>
      
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 0, 5.2], fov: 62, near: 0.1, far: 50 }}
      >
        <color attach="background" args={['#070a12']} />
        <fog attach="fog" args={['#070a12', 8, 18]} />

        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#c8d6ff', '#0a0f1f', 0.6]} />
        <directionalLight position={[6, 4, 8]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-8, -3, -6]} intensity={0.6} color="#7aa2ff" />

        <DotSphere />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          rotateSpeed={0.55}
          enablePan={false}
          enableZoom={true}
          minDistance={3.3}
          maxDistance={9}
        />
      </Canvas>
    </div>
  );
}

export default App;
