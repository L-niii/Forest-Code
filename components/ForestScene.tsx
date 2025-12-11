
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, BakeShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Types ---
interface ForestSceneProps {
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    gesture: 'none' | 'fist' | 'open';
    intensity: number; // 0 to 1 based on hold duration
}

// --- Procedural Texture Generator (Unchanged mostly) ---
const useProceduralTextures = () => {
  return useMemo(() => {
    const createTexture = (type: 'bark' | 'leaf' | 'ground' | 'wood') => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      if (type === 'bark') {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#281a14' : '#4e342e';
            ctx.fillRect(Math.random() * 512, 0, 2 + Math.random() * 5, 512);
        }
      } else if (type === 'leaf') {
        ctx.clearRect(0, 0, 512, 512);
        for (let i = 0; i < 200; i++) {
           const x = Math.random() * 512;
           const y = Math.random() * 512;
           ctx.beginPath();
           ctx.arc(x, y, 10 + Math.random() * 20, 0, Math.PI * 2);
           const val = 200 + Math.random() * 55;
           ctx.fillStyle = `rgba(${val}, ${val}, ${val}, 0.8)`;
           ctx.fill();
        }
      } else if (type === 'ground') {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 5000; i++) {
           const val = 100 + Math.random() * 50;
           ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
           ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
        }
      } else if (type === 'wood') {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#6d4c41';
        ctx.lineWidth = 2;
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * 10 + Math.random() * 20);
            ctx.bezierCurveTo(150, i * 10 + Math.random() * 50, 350, i * 10 - Math.random() * 50, 512, i * 10);
            ctx.stroke();
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    return {
      bark: createTexture('bark'),
      leaf: createTexture('leaf'),
      ground: createTexture('ground'),
      wood: createTexture('wood')
    };
  }, []);
};

// --- First Person Logic ---
const FirstPersonController = () => {
    const { camera } = useThree();
    const [moveState, setMoveState] = useState({ forward: false, backward: false, left: false, right: false });
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': setMoveState(s => ({ ...s, forward: true })); break;
                case 'ArrowLeft':
                case 'KeyA': setMoveState(s => ({ ...s, left: true })); break;
                case 'ArrowDown':
                case 'KeyS': setMoveState(s => ({ ...s, backward: true })); break;
                case 'ArrowRight':
                case 'KeyD': setMoveState(s => ({ ...s, right: true })); break;
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': setMoveState(s => ({ ...s, forward: false })); break;
                case 'ArrowLeft':
                case 'KeyA': setMoveState(s => ({ ...s, left: false })); break;
                case 'ArrowDown':
                case 'KeyS': setMoveState(s => ({ ...s, backward: false })); break;
                case 'ArrowRight':
                case 'KeyD': setMoveState(s => ({ ...s, right: false })); break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useFrame((state, delta) => {
        // Friction
        velocity.current.x -= velocity.current.x * 10.0 * delta;
        velocity.current.z -= velocity.current.z * 10.0 * delta;

        // Direction
        direction.current.z = Number(moveState.forward) - Number(moveState.backward);
        direction.current.x = Number(moveState.left) - Number(moveState.right);
        direction.current.normalize();

        const speed = 40.0 * delta; // Adjust speed

        if (moveState.forward || moveState.backward) velocity.current.z -= direction.current.z * speed;
        if (moveState.left || moveState.right) velocity.current.x -= direction.current.x * speed;

        camera.translateX(-velocity.current.x * delta);
        camera.translateZ(velocity.current.z * delta);
        
        // Head Bob
        const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
        const time = state.clock.getElapsedTime();
        if (isMoving) {
            camera.position.y = 10 + Math.sin(time * 10) * 0.3; // 10 is base eye height
        } else {
             // Breathing
            camera.position.y = 10 + Math.sin(time * 2) * 0.1;
        }
    });

    return null;
}

// --- Scene Components ---

const ProceduralTree = ({ position, scale = 1, textures, leafColor, windIntensity, isBirdActive }: any) => {
    const rotationY = useMemo(() => Math.random() * Math.PI, []);
    const groupRef = useRef<THREE.Group>(null);
    const leafRef = useRef<THREE.Group>(null);
    const hasBird = useMemo(() => Math.random() > 0.7, []); // 30% trees have birds

    useFrame((state) => {
        if (groupRef.current && windIntensity > 0) {
            // Wind sway logic
            const time = state.clock.getElapsedTime();
            const noise = Math.sin(time * 2 + position[0]); 
            // Sway increases with height (approximated by rotation Z)
            const sway = noise * windIntensity * 0.1; 
            groupRef.current.rotation.z = sway;
        }
    });
    
    return (
        <group ref={groupRef} position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]}>
            <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.15, 0.25, 3, 7]} />
                <meshStandardMaterial map={textures.bark} roughness={0.9} color="#5d4037" />
            </mesh>
            
            <group ref={leafRef} position={[0, 2.5, 0]}>
                 <mesh castShadow receiveShadow position={[0, 0, 0]} rotation={[0.5, 0, 0]}>
                    <dodecahedronGeometry args={[1.2, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} transparent alphaTest={0.5} side={THREE.DoubleSide} />
                 </mesh>
                 <mesh castShadow receiveShadow position={[0.4, 1.2, -0.3]} rotation={[0, 1, 0.2]}>
                    <dodecahedronGeometry args={[1.0, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} transparent alphaTest={0.5} side={THREE.DoubleSide} />
                 </mesh>
                  <mesh castShadow receiveShadow position={[-0.2, 2.0, 0.2]}>
                    <dodecahedronGeometry args={[0.8, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} transparent alphaTest={0.5} side={THREE.DoubleSide} />
                 </mesh>

                 {/* Visual Feedback for Birds */}
                 {hasBird && isBirdActive && (
                     <pointLight position={[0, 3, 0]} color="#FFD700" intensity={5} distance={5} />
                 )}
            </group>
        </group>
    );
};

const Terrain = ({ texture, color }: any) => {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(120, 120, 64, 64);
        const posAttribute = geo.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            const dist = Math.sqrt(x*x + y*y);
            let zHeight = 0;
            if (dist > 15) {
                zHeight += (dist - 15) * 0.15;
                zHeight += Math.sin(x * 0.2) * 0.5 + Math.cos(y * 0.2) * 0.5;
                zHeight += (Math.random() - 0.5) * 0.3;
            } else {
                 zHeight += (Math.random() - 0.5) * 0.1;
            }
            posAttribute.setZ(i, zHeight);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);
    texture.repeat.set(20, 20);
    return (
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <meshStandardMaterial map={texture} color={color} roughness={1} bumpMap={texture} bumpScale={0.5} />
        </mesh>
    );
};

const Amphitheater = ({ texture }: { texture: THREE.Texture }) => {
  texture.repeat.set(1, 0.2);
  const benches = useMemo(() => {
    const items: React.ReactElement[] = [];
    const tiers = [{ radius: 6, count: 16, height: 0.4 }, { radius: 8, count: 20, height: 0.8 }, { radius: 10, count: 24, height: 1.2 }];
    tiers.forEach((tier, tIdx) => {
        for (let i = 0; i < tier.count; i++) {
            const angle = (Math.PI / tier.count) * i * 1.1 - 0.1;
            const x = Math.cos(angle) * tier.radius;
            const z = Math.sin(angle) * tier.radius;
            items.push(
                <group key={`bench-${tIdx}-${i}`} position={[x, tier.height, z]} rotation={[0, -angle, 0]}>
                    <mesh castShadow receiveShadow position={[0, 0, 0]}><boxGeometry args={[1.4, 0.08, 0.5]} /><meshStandardMaterial map={texture} color="#8d6e63" roughness={0.8} /></mesh>
                    <mesh position={[-0.5, -tier.height/2 - 0.1, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, tier.height + 0.2]} /><meshStandardMaterial map={texture} color="#5d4037" /></mesh>
                    <mesh position={[0.5, -tier.height/2 - 0.1, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, tier.height + 0.2]} /><meshStandardMaterial map={texture} color="#5d4037" /></mesh>
                </group>
            );
        }
    });
    return items;
  }, [texture]);
  return <group position={[0, 0, -2]} rotation={[0, Math.PI / 2, 0]}>{benches}</group>;
};

const seasonColors = {
    spring: { leaf: '#4CAF50', ground: '#66BB6A', sky: '#87CEEB', ambient: '#ffffff' },
    summer: { leaf: '#2E7D32', ground: '#33691E', sky: '#4FC3F7', ambient: '#ffffee' },
    autumn: { leaf: '#FF9800', ground: '#D7CCC8', sky: '#FFCC80', ambient: '#ffe0b2' },
    winter: { leaf: '#9E9E9E', ground: '#FFFFFF', sky: '#B0BEC5', ambient: '#e0f7fa' },
};

export const ForestScene: React.FC<ForestSceneProps> = ({ season = 'summer', gesture, intensity }) => {
  const textures = useProceduralTextures();
  const colors = seasonColors[season];

  // Map intensity to visual effects
  const windStrength = gesture === 'fist' ? intensity * 2.0 : 0;
  const birdsActive = gesture === 'open';

  return (
    <Canvas shadows dpr={[1, 2]}>
      {/* Lights */}
      <ambientLight intensity={0.4} color={colors.ambient} />
      <hemisphereLight color={colors.sky} groundColor={colors.ground} intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}>
        <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40]} />
      </directionalLight>
      <Sky sunPosition={[100, 20, 100]} turbidity={season === 'winter' ? 10 : 2} rayleigh={season === 'winter' ? 0.5 : 2} />
      <fog attach="fog" args={[colors.ambient, 10, season === 'winter' ? 50 : 70]} />
      <BakeShadows />

      {/* Controls */}
      <FirstPersonController />
      <PointerLockControls />

      {/* World */}
      <group>
        <Terrain texture={textures.ground} color={colors.ground} />
        <Amphitheater texture={textures.wood} />
        
        {Array.from({ length: 120 }).map((_, i) => {
             const angle = Math.random() * Math.PI * 2;
             const dist = 14 + Math.pow(Math.random(), 2) * 35; 
             const x = Math.cos(angle) * dist;
             const z = Math.sin(angle) * dist;
             const scale = 0.8 + Math.random() * 0.6;
             return (
                 <ProceduralTree 
                    key={i} 
                    position={[x, 0, z]}
                    scale={scale}
                    textures={textures}
                    leafColor={colors.leaf}
                    windIntensity={windStrength}
                    isBirdActive={birdsActive}
                 />
             );
        })}
      </group>
    </Canvas>
  );
};
