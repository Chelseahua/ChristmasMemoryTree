import { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  Float,
  Stars,
  Sparkles,
  useTexture
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as random from 'maath/random';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import SettingsPanel from './SettingsPanel';
import { COLOR_THEMES } from './ColorThemes';
import type { ThemePreset, ColorTheme } from './ColorThemes';

// --- Helper: Create dynamic CONFIG based on theme ---
const createConfig = (colors: ColorTheme) => ({
  colors,
  counts: {
    foliage: 500,
    ornaments: 50,
    lights: 200
  },
  tree: { height: 28, radius: 12 },
  photos: {
    body: [] as string[]
  }
});

type ConfigType = ReturnType<typeof createConfig>;

// --- Helper: Tree Shape ---
const getTreePosition = (treeHeight: number, treeRadius: number) => {
  const h = treeHeight; const rBase = treeRadius;
  const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h / 2)) / h;
  const currentRadius = rBase * (1 - normalizedY); const theta = Math.random() * Math.PI * 2;
  // Bias towards the surface for a fuller look
  const r = currentRadius * Math.sqrt(0.5 + 0.5 * Math.random());
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// --- Component: Ornament Tree (Instanced Spheres) ---
const OrnamentTree = ({ state, config }: { state: 'CHAOS' | 'FORMED', config: ConfigType }) => {
  const count = config.counts.foliage;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { targets, randoms, colors } = useMemo(() => {
    const targets = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3); // For chaos position
    const colors = new Float32Array(count * 3);
    const spherePoints = random.inSphere(new Float32Array(count * 3), { radius: 60 }) as Float32Array;

    const colorPalette = [
      new THREE.Color(config.colors.gold),
      new THREE.Color(config.colors.gold), // More gold
      new THREE.Color(config.colors.red),
      new THREE.Color(config.colors.green),
      new THREE.Color(config.colors.green)
    ];

    const placedPositions: number[][] = [];
    const MIN_DISTANCE = 2.0; // Minimum distance between spheres

    for (let i = 0; i < count; i++) {
      let tx, ty, tz;
      let attempts = 0;
      let valid = false;

      while (!valid && attempts < 50) {
        [tx, ty, tz] = getTreePosition(config.tree.height, config.tree.radius);
        valid = true;
        for (const [px, py, pz] of placedPositions) {
          const dx = tx - px;
          const dy = ty - py;
          const dz = tz - pz;
          if (dx * dx + dy * dy + dz * dz < MIN_DISTANCE * MIN_DISTANCE) {
            valid = false;
            break;
          }
        }
        attempts++;
      }

      // If we couldn't find a valid position after 50 attempts, we just place it anyway
      // or we could skip it, but for now we place it to maintain count.
      // With 500 spheres and large tree, this should rarely fail.
      if (valid) {
        placedPositions.push([tx!, ty!, tz!]);
      } else {
        // Fallback: just push the last generated position even if it overlaps, 
        // or maybe push a position far away? 
        // Let's just push it, it's better than crashing or having 0,0,0
        placedPositions.push([tx!, ty!, tz!]);
      }

      targets[i * 3] = tx!; targets[i * 3 + 1] = ty!; targets[i * 3 + 2] = tz!;

      randoms[i * 3] = spherePoints[i * 3];
      randoms[i * 3 + 1] = spherePoints[i * 3 + 1];
      randoms[i * 3 + 2] = spherePoints[i * 3 + 2];

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    return { targets, randoms, colors };
  }, [count, config]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((rootState, delta) => {
    if (!meshRef.current) return;
    const isFormed = state === 'FORMED';
    const time = rootState.clock.elapsedTime;

    // Lerp factor
    const lerpFactor = delta * 2.0;

    for (let i = 0; i < count; i++) {
      // Current target based on state
      const tx = isFormed ? targets[i * 3] : randoms[i * 3];
      const ty = isFormed ? targets[i * 3 + 1] : randoms[i * 3 + 1];
      const tz = isFormed ? targets[i * 3 + 2] : randoms[i * 3 + 2];

      // Read current instance matrix
      meshRef.current.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      // Interpolate position
      dummy.position.lerp(new THREE.Vector3(tx, ty, tz), lerpFactor);

      // Gentle rotation/wobble
      dummy.rotation.x += Math.sin(time * 0.5 + i) * 0.002;
      dummy.rotation.y += Math.cos(time * 0.3 + i) * 0.002;

      // Scale variation
      const scaleBase = 0.4 + (i % 5) * 0.1; // 0.4 to 0.9
      dummy.scale.setScalar(scaleBase);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        roughness={0.15}
        metalness={0.9}
        envMapIntensity={1.5}
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
};

// --- Component: Photo Ornaments (Polaroid Style) ---
const PhotoOrnaments = ({ state, photos, onPhotoClick, config }: {
  state: 'CHAOS' | 'FORMED',
  photos: string[],
  onPhotoClick: (index: number) => void,
  config: ConfigType
}) => {
  const textures = useTexture(photos);
  // Limit visible photos to available textures or config count
  const count = Math.min(config.counts.ornaments, textures.length);
  const groupRef = useRef<THREE.Group>(null);

  // Polaroid dimensions
  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);

      // Tree position - slightly tucked in
      const h = config.tree.height;

      // Adjusted for visually uniform distribution on cone (avoiding top crowding)
      const minY = -h / 2.2;
      const maxY = h / 3;
      // Power > 1 biases towards minY (bottom), matching the cone's larger surface area at the bottom
      const y = minY + (maxY - minY) * Math.pow(Math.random(), 2.2);
      const rBase = config.tree.radius;
      const normalizedY = (y + (h / 2)) / h;
      const currentRadius = rBase * (1 - normalizedY);

      // Place slightly outside the main sphere volume to be visible but integrated
      const r = currentRadius + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.5
      };
      const chaosRotation = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      return {
        chaosPos, targetPos,
        textureIndex: i % textures.length,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        scale: 1 // Default scale
      };
    });
  }, [textures, count, config]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;

      objData.currentPos.lerp(target, delta * 2.0);
      group.position.copy(objData.currentPos);

      if (isFormed) {
        // Look at center but flip to face outward correctly
        const targetLookPos = new THREE.Vector3(group.position.x * 2, group.position.y, group.position.z * 2);
        group.lookAt(targetLookPos);
        // Gentle sway
        group.rotation.z += Math.sin(stateObj.clock.elapsedTime + i) * 0.001;
      } else {
        group.rotation.x += delta * objData.rotationSpeed.x;
        group.rotation.y += delta * objData.rotationSpeed.y;
        group.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group
          key={i}
          scale={[obj.scale, obj.scale, obj.scale]}
          rotation={state === 'CHAOS' ? obj.chaosRotation : [0, 0, 0]}
          onClick={(e) => { e.stopPropagation(); onPhotoClick(i); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          {/* Polaroid Frame */}
          <mesh geometry={borderGeometry} position={[0, -0.1, -0.01]}>
            <meshStandardMaterial color={'#FDFBF7'} roughness={0.8} metalness={0} />
          </mesh>
          {/* Photo */}
          <mesh geometry={photoGeometry} position={[0, 0.05, 0.01]}>
            <meshStandardMaterial
              map={textures[obj.textureIndex]}
              roughness={0.4}
              metalness={0}
              emissive={config.colors.white}
              emissiveMap={textures[obj.textureIndex]}
              emissiveIntensity={0.2} // Subtle glow
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// --- Component: Fairy Lights (Subtle Glow) ---
const FairyLights = ({ state, config }: { state: 'CHAOS' | 'FORMED', config: ConfigType }) => {
  const count = config.counts.lights;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.15, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);
      const h = config.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = config.tree.radius;
      const currentRadius = rBase * (1 - (y + (h / 2)) / h);
      // Lights sit on the surface
      const r = currentRadius + 0.2;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

      const speed = 1 + Math.random() * 2;
      return { chaosPos, targetPos, speed, currentPos: chaosPos.clone(), timeOffset: Math.random() * 100 };
    });
  }, [config]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 2.5);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);

      const intensity = (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 2 + intensity * 3 : 0;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((_, i) => (<mesh key={i} geometry={geometry}>
        <meshStandardMaterial color={config.colors.warmLight} emissive={config.colors.warmLight} emissiveIntensity={0} toneMapped={false} />
      </mesh>))}
    </group>
  );
};

// --- Component: Snow (Falling Particles) ---
const Snow = () => {
  const count = 2000;
  const mesh = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      temp[i * 3] = (Math.random() - 0.5) * 100; // x
      temp[i * 3 + 1] = (Math.random() - 0.5) * 100; // y
      temp[i * 3 + 2] = (Math.random() - 0.5) * 100; // z
    }
    return temp;
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const positions = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      // Move down
      positions[i * 3 + 1] -= delta * 5 * (Math.random() * 0.5 + 0.5);

      // Reset if too low
      if (positions[i * 3 + 1] < -50) {
        positions[i * 3 + 1] = 50;
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
    // Gentle rotation
    mesh.current.rotation.y += delta * 0.05;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.3} color="#FFF" transparent opacity={0.8} sizeAttenuation={true} />
    </points>
  );
};

// --- Component: Top Star (High Quality Gold) ---
const TopStar = ({ state, config, onToggleSnow }: { state: 'CHAOS' | 'FORMED', config: ConfigType, onToggleSnow?: () => void }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.5; const innerRadius = 0.6; const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? shape.moveTo(radius * Math.cos(angle), radius * Math.sin(angle)) : shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
    }
    shape.closePath();
    return shape;
  }, []);

  const starGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(starShape, {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.1, bevelSegments: 5,
    });
  }, [starShape]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0;
      // Pulse effect on hover
      const hoverScale = hovered && state === 'FORMED' ? 1.2 : 1;
      const finalScale = targetScale * hoverScale;

      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), delta * 3);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, config.tree.height / 2 + 1.5, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (state === 'FORMED' && onToggleSnow) onToggleSnow();
      }}
      onPointerOver={() => { if (state === 'FORMED') { setHovered(true); document.body.style.cursor = 'pointer'; } }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={starGeometry}>
          <meshStandardMaterial
            color={config.colors.gold}
            emissive={config.colors.gold}
            emissiveIntensity={hovered ? 3.0 : 2.0}
            roughness={0.1}
            metalness={1.0}
          />
        </mesh>
        {/* Glow Halo */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color={config.colors.gold} transparent opacity={hovered ? 0.4 : 0.2} />
        </mesh>
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = ({ sceneState, cameraSpeed, photos, onPhotoClick, config, isSnowing, onToggleSnow }: {
  sceneState: 'CHAOS' | 'FORMED',
  cameraSpeed: { x: number, y: number },
  photos: string[],
  onPhotoClick: (index: number) => void,
  config: ConfigType,
  isSnowing: boolean,
  onToggleSnow: () => void
}) => {
  const controlsRef = useRef<any>(null);
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.setAzimuthalAngle(controlsRef.current.getAzimuthalAngle() + cameraSpeed.x);
      const newPolar = controlsRef.current.getPolarAngle() + cameraSpeed.y;
      // Clamp polar angle to avoid flipping (approx 10 degrees to 170 degrees)
      if (newPolar > 0.1 && newPolar < Math.PI - 0.1) {
        controlsRef.current.setPolarAngle(newPolar);
      }
      controlsRef.current.update();
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 45]} fov={50} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={20}
        maxDistance={80}
        autoRotate={cameraSpeed.x === 0 && cameraSpeed.y === 0 && sceneState === 'FORMED'}
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 1.8}
      />

      {/* Cinematic Environment */}
      <color attach="background" args={['#050505']} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      <Environment preset="city" background={false} />

      {/* Snowfall Effect */}
      {isSnowing && <Snow />}

      {/* Lighting */}
      <ambientLight intensity={0.2} color="#ffffff" />
      <spotLight
        position={[20, 30, 20]}
        angle={0.3}
        penumbra={0.5}
        intensity={200}
        color={config.colors.warmLight}
        castShadow
      />
      <pointLight position={[-20, 10, -20]} intensity={50} color={config.colors.gold} />
      <pointLight position={[0, -10, 10]} intensity={30} color={config.colors.red} />

      <group position={[0, -5, 0]}>
        <OrnamentTree state={sceneState} config={config} />
        <Suspense fallback={null}>
          {photos.length > 0 && <PhotoOrnaments state={sceneState} photos={photos} onPhotoClick={onPhotoClick} config={config} />}
          <FairyLights state={sceneState} config={config} />
          <TopStar state={sceneState} config={config} onToggleSnow={onToggleSnow} />
        </Suspense>
        <Sparkles count={400} scale={40} size={6} speed={0.4} opacity={0.5} color={config.colors.gold} />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.9} intensity={0.8} radius={0.6} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <ToneMapping />
      </EffectComposer>
    </>
  );
};

// --- Gesture Controller (Unchanged Logic) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GestureController = ({ onGesture, onMove, onStatus }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHandPos = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    let gestureRecognizer: GestureRecognizer;
    let requestRef: number;

    const setup = async () => {
      onStatus("DOWNLOADING AI...");
      const createGestureRecognizer = async () => {
        try {
          const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
          gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO"
          });
          onStatus("AI READY");
          requestRef = requestAnimationFrame(predictWebcam);
        } catch (error) {
          console.error("GestureRecognizer Error:", error);
          onStatus("AI ERROR: " + (error as any).message);
        }
      };
      createGestureRecognizer();
      onStatus("REQUESTING CAMERA...");
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          onStatus("AI READY: SHOW HAND");
        }
      } else {
        onStatus("ERROR: CAMERA PERMISSION DENIED");
      }
    };

    const predictWebcam = async () => {
      if (gestureRecognizer && videoRef.current && videoRef.current.readyState === 4) {
        try {
          const results = gestureRecognizer.recognizeForVideo(videoRef.current, Date.now());
          const ctx = canvasRef.current.getContext("2d");
          // Always draw debug info
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
            if (results.landmarks) for (const landmarks of results.landmarks) {
              const drawingUtils = new DrawingUtils(ctx);
              drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFD700", lineWidth: 2 });
              drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
            }
          }

          if (results.gestures.length > 0) {
            const name = results.gestures[0][0].categoryName; const score = results.gestures[0][0].score;
            if (score > 0.4) {
              if (name === "Open_Palm") onGesture("CHAOS"); if (name === "Closed_Fist") onGesture("FORMED");
              onStatus(`DETECTED: ${name}`);
            }
            if (results.landmarks.length > 0) {
              const hand = results.landmarks[0][0];

              if (lastHandPos.current) {
                // Calculate delta (change in position)
                // Sensitivity factor: how much rotation per screen width movement
                const SENSITIVITY = 5.0;

                const deltaX = (hand.x - lastHandPos.current.x) * SENSITIVITY;
                const deltaY = (hand.y - lastHandPos.current.y) * SENSITIVITY;

                // Deadzone to prevent jitter when holding still
                const deadzone = 0.002;
                const finalX = Math.abs(deltaX) > deadzone ? deltaX : 0;

                onMove({ x: finalX, y: -deltaY }); // Apply deadzone and invert Y for natural feel
              }

              lastHandPos.current = { x: hand.x, y: hand.y };
            } else {
              lastHandPos.current = null;
              onMove({ x: 0, y: 0 });
            }
          } else {
            lastHandPos.current = null;
            onMove({ x: 0, y: 0 });
            onStatus("AI READY: NO HAND");
          }
        } catch (e) {
          console.error("Prediction Error:", e);
        }
      }
      requestRef = requestAnimationFrame(predictWebcam);
    };
    setup();
    return () => cancelAnimationFrame(requestRef);
  }, [onGesture, onMove, onStatus]);

  return (
    <>
      <video ref={videoRef} style={{ opacity: 0.6, position: 'fixed', top: 0, right: 0, width: '320px', zIndex: 100, pointerEvents: 'none', transform: 'scaleX(-1)' }} playsInline muted autoPlay />
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, right: 0, width: '320px', height: 'auto', zIndex: 101, pointerEvents: 'none', transform: 'scaleX(-1)' }} />
    </>
  );
};

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<'CHAOS' | 'FORMED'>('CHAOS');
  const [cameraSpeed, setCameraSpeed] = useState({ x: 0, y: 0 });
  const [aiStatus, setAiStatus] = useState("INITIALIZING...");
  // debugMode removed
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [memos, setMemos] = useState<Record<number, string>>({});

  // Customization states
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset | 'custom'>('traditional');
  const [customColors, setCustomColors] = useState<ColorTheme>(COLOR_THEMES.traditional);

  // Snow state
  const [isSnowing, setIsSnowing] = useState(false);

  // Dynamic Config
  const config = useMemo(() => {
    const themeColors = selectedTheme === 'custom' ? customColors : COLOR_THEMES[selectedTheme];
    return {
      colors: { ...themeColors, polaroidBorder: '#FDFBF7' },
      counts: { foliage: 500, ornaments: 50, lights: 200 },
      tree: { height: 28, radius: 12 },
      photos: { body: [] as string[] }
    };
  }, [selectedTheme, customColors]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos = Array.from(e.target.files).map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedPhotoIndex !== null) {
      setMemos(prev => ({ ...prev, [selectedPhotoIndex]: e.target.value }));
    }
  };



  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <Canvas dpr={[1, 2]} gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }} shadows>
          <Experience
            sceneState={sceneState}
            cameraSpeed={cameraSpeed}
            photos={photos}
            onPhotoClick={setSelectedPhotoIndex}
            config={config}
            isSnowing={isSnowing}
            onToggleSnow={() => setIsSnowing(prev => !prev)}
          />
        </Canvas>
      </div>
      <GestureController onGesture={setSceneState} onMove={setCameraSpeed} onStatus={setAiStatus} />

      {/* Merry Christmas Text */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '10%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        textAlign: 'center',
        opacity: sceneState === 'CHAOS' ? 1 : 0,
        transition: 'opacity 2s ease-in-out', // Slow fade
      }}>
        <h1 style={{
          fontFamily: '"Mountains of Christmas", serif',
          fontSize: '4rem', // Reduced from 6rem
          fontWeight: 700,
          color: '#FFD700',
          margin: 0,
          textShadow: '0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3)',
          lineHeight: 1.1
        }}>
          Merry<br />Christmas
        </h1>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        selectedTheme={selectedTheme}
        onThemeChange={setSelectedTheme}
        customColors={customColors}
        onCustomColorsChange={setCustomColors}
      />

      {/* UI - Stats (Elegant) */}
      <div style={{ position: 'absolute', bottom: '40px', left: '40px', color: '#888', zIndex: 10, fontFamily: 'Times New Roman, serif', userSelect: 'none' }}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '15px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px', color: '#666' }}>Memories</p>
          <p style={{ fontSize: '28px', color: '#FFD700', margin: 0, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)', marginBottom: '15px' }}>
            {photos.length} <span style={{ fontSize: '15px', color: '#888', fontStyle: 'italic' }}>Moments</span>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <input
              type="file"
              multiple
              accept="image/*"
              id="photo-upload"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <label htmlFor="photo-upload" style={{
              padding: '12px 40px', // Match Assemble button padding
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#FFD700',
              fontFamily: 'Times New Roman, serif',
              fontSize: '14px', // Match Assemble button font size
              letterSpacing: '4px', // Match Assemble button letter spacing
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.5s',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '2px'
            }}>
              UPLOAD PHOTOS
            </label>
          </div>
        </div>
        {/* 
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px', color: '#666' }}>Ornaments</p>
          <p style={{ fontSize: '28px', color: '#C0C0C0', margin: 0, textShadow: '0 0 10px rgba(192, 192, 192, 0.2)' }}>
            {(config.counts.foliage).toLocaleString()} <span style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Spheres</span>
          </p>
        </div> 
        */}
      </div>

      {/* UI - Buttons (Minimalist) */}
      <div style={{ position: 'absolute', bottom: '40px', right: '40px', zIndex: 10, display: 'flex', gap: '15px' }}>


        <button onClick={() => setSceneState(s => s === 'CHAOS' ? 'FORMED' : 'CHAOS')} style={{ padding: '12px 40px', backgroundColor: 'rgba(255, 215, 0, 0.1)', border: '2px solid rgba(255, 215, 0, 0.3)', color: '#FFD700', fontFamily: 'Times New Roman, serif', fontSize: '14px', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.5s' }}>
          {sceneState === 'CHAOS' ? 'Assemble' : 'Disperse'}
        </button>
      </div>

      {/* UI - AI Status */}
      <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', color: aiStatus.includes('ERROR') ? '#D32F2F' : 'rgba(255, 215, 0, 0.3)', fontSize: '9px', letterSpacing: '3px', zIndex: 10, fontFamily: 'sans-serif' }}>
        {aiStatus}
      </div>



      {/* UI - Photo Detail Card Overlay */}
      {selectedPhotoIndex !== null && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 200,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setSelectedPhotoIndex(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#FDFBF7',
              padding: '20px 20px 60px 20px',
              borderRadius: '2px',
              boxShadow: '0 0 50px rgba(0,0,0,0.5)',
              transform: 'rotate(-2deg)',
              maxWidth: '90%',
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative'
            }}
          >
            <img
              src={photos[selectedPhotoIndex]}
              alt="Memory"
              style={{
                maxWidth: '400px',
                maxHeight: '50vh',
                objectFit: 'cover',
                border: '1px solid #eee'
              }}
            />
            <div style={{ position: 'relative', minHeight: '120px' /* Ensure whitespace */ }}>
              <textarea
                value={memos[selectedPhotoIndex] || ''}
                onChange={handleMemoChange}
                placeholder="Write a memory..."
                style={{
                  width: '100%',
                  height: '100px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: '"Brush Script MT", cursive',
                  fontSize: '24px',
                  color: '#333',
                  resize: 'none',
                  outline: 'none',
                  textAlign: 'center',
                  lineHeight: '1.5'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '-20px',
                right: '0',
                fontSize: '12px',
                color: '#999',
                fontFamily: 'sans-serif'
              }}>
                {memos[selectedPhotoIndex] ? 'Saved' : 'Click to write'}
              </div>
            </div>
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                zIndex: 20
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}