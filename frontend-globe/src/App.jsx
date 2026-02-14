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
        <color attach="background" args={['#e8eef6']} />
        <fog attach="fog" args={['#e8eef6', 7.5, 16]} />

        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#f3f7fc', '#d7e0ec', 0.55]} />
        <directionalLight position={[6, 4, 8]} intensity={0.62} color="#f6faff" />
        <directionalLight position={[-8, -3, -6]} intensity={0.22} color="#c4d2e6" />

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
