
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, BakeShadows } from '@react-three/drei';
import * as THREE from 'three';
import { HandData } from './GestureHandler';

interface ForestSceneProps {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    handData: HandData;
}

// --- Procedural Textures (Unchanged) ---
const useProceduralTextures = () => {
  return useMemo(() => {
    const createTexture = (type: 'bark' | 'leaf' | 'ground' | 'wood' | 'snow') => {
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,512,512);
      } else if (type === 'ground') {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 5000; i++) {
           const val = 100 + Math.random() * 50;
           ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
           ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
        }
      } else if (type === 'wood') {
        ctx.fillStyle = '#6d4c41'; // Lighter wood for benches
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 4;
        // Wood grain
        for (let i = 0; i < 20; i++) {
             ctx.beginPath();
             ctx.moveTo(0, i * 25);
             ctx.lineTo(512, i * 25 + (Math.random() - 0.5) * 20);
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

// --- Hybrid Camera Control (Head + Hand) ---
const HybridController = ({ handData }: { handData: HandData }) => {
    const { camera } = useThree();
    const keys = useRef<{ [key: string]: boolean }>({});
    const velocity = useRef(new THREE.Vector3());
    
    // Euler angles for rotation smoothing
    const currentYaw = useRef(0);
    const currentPitch = useRef(0);

    // Listen for keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
        const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useFrame((state, delta) => {
        // --- 1. Rotation Logic (Head Tracking) ---
        // Joystick style: Looking left turns the camera left. 
        // deadzone prevents drift when looking straight.
        const rotDeadzone = 0.15;
        let rotSpeedY = 0; // Yaw speed
        let rotSpeedX = 0; // Pitch speed

        if (Math.abs(handData.headYaw) > rotDeadzone) {
            // Non-linear sensitivity
            const input = handData.headYaw;
            // Negative input (looking left) should rotate camera positive Y (left)
            rotSpeedY = Math.sign(input) * Math.pow(Math.abs(input), 1.5) * 2.0;
        }

        if (Math.abs(handData.headPitch) > rotDeadzone) {
            const input = handData.headPitch;
            // Input positive (looking up) -> Camera Pitch up (positive)
            rotSpeedX = Math.sign(input) * Math.pow(Math.abs(input), 1.5) * 1.5;
        }

        // Apply rotation velocity
        currentYaw.current -= rotSpeedY * delta;
        currentPitch.current += rotSpeedX * delta;
        
        // Clamp pitch (Don't break neck)
        currentPitch.current = Math.max(-1.4, Math.min(1.4, currentPitch.current));

        // Apply to camera
        camera.rotation.order = 'YXZ'; // Important to rotate Y (Yaw) then X (Pitch)
        camera.rotation.y = currentYaw.current;
        camera.rotation.x = currentPitch.current;


        // --- 2. Movement Logic (Hands + Keys) ---
        let forwardSpeed = 0;
        let strafeSpeed = 0;
        let verticalSpeed = 0;
        
        const moveDeadzone = 0.25;

        // Hand Inputs
        if (handData.handCount > 0) {
            // Forward / Backward (Gestures)
            if (handData.gesture === 'dual_open') forwardSpeed += 8; 
            else if (handData.gesture === 'dual_fist') forwardSpeed -= 5; 

            // Strafe Left / Right (Hand X Position)
            if (Math.abs(handData.x - 0.5) > moveDeadzone) {
                const input = handData.x - 0.5;
                const sign = Math.sign(input);
                strafeSpeed += sign * Math.pow(Math.abs(input), 1.5) * 15; 
            }

            // Elevation Up / Down (Hand Y Position)
            if (Math.abs(handData.y - 0.5) > moveDeadzone) {
                const input = handData.y - 0.5;
                const sign = Math.sign(input);
                verticalSpeed -= sign * Math.pow(Math.abs(input), 1.5) * 8;
            }
        }

        // Keyboard Inputs
        if (keys.current['KeyW'] || keys.current['ArrowUp']) forwardSpeed += 12;
        if (keys.current['KeyS'] || keys.current['ArrowDown']) forwardSpeed -= 12;
        if (keys.current['KeyA'] || keys.current['ArrowLeft']) strafeSpeed -= 12;
        if (keys.current['KeyD'] || keys.current['ArrowRight']) strafeSpeed += 12;
        
        // Apply velocity relative to camera look direction
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        const up = new THREE.Vector3(0, 1, 0); 

        const targetVelocity = new THREE.Vector3()
            .addScaledVector(forward, forwardSpeed)
            .addScaledVector(right, strafeSpeed)
            .addScaledVector(up, verticalSpeed);

        const damping = (forwardSpeed === 0 && strafeSpeed === 0 && verticalSpeed === 0) ? 10 : 3;
        velocity.current.lerp(targetVelocity, delta * damping);
        
        if (velocity.current.lengthSq() > 0.01) {
            camera.position.addScaledVector(velocity.current, delta);
        }
        
        if (camera.position.y < 2) camera.position.y = 2;
    });

    return null; // No PointerLockControls anymore
}

// --- Scene Components (Unchanged) ---
const WoodenBench = ({ position, rotation, texture }: any) => {
    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[6, 0.2, 1.5]} />
                <meshStandardMaterial map={texture} color="#8d6e63" roughness={0.8} />
            </mesh>
            <mesh position={[-2.5, 0.75, 0]} castShadow>
                <boxGeometry args={[0.3, 1.5, 1.2]} />
                <meshStandardMaterial map={texture} color="#6d4c41" />
            </mesh>
            <mesh position={[2.5, 0.75, 0]} castShadow>
                <boxGeometry args={[0.3, 1.5, 1.2]} />
                <meshStandardMaterial map={texture} color="#6d4c41" />
            </mesh>
        </group>
    );
};

const ProceduralTree = ({ position, scale = 1, textures, leafColor }: any) => {
    const rotationY = useMemo(() => Math.random() * Math.PI, []);
    return (
        <group position={position} scale={[scale, scale, scale]} rotation={[0, rotationY, 0]}>
            <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.15, 0.25, 3, 7]} />
                <meshStandardMaterial map={textures.bark} roughness={0.9} color="#5d4037" />
            </mesh>
            <group position={[0, 2.5, 0]}>
                 <mesh castShadow receiveShadow position={[0, 0, 0]} rotation={[0.5, 0, 0]}>
                    <dodecahedronGeometry args={[1.2, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} />
                 </mesh>
                 <mesh castShadow receiveShadow position={[0.4, 1.2, -0.3]} rotation={[0, 1, 0.2]}>
                    <dodecahedronGeometry args={[1.0, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} />
                 </mesh>
                  <mesh castShadow receiveShadow position={[-0.2, 2.0, 0.2]}>
                    <dodecahedronGeometry args={[0.8, 0]} />
                    <meshStandardMaterial map={textures.leaf} color={leafColor} roughness={0.8} />
                 </mesh>
            </group>
        </group>
    );
};

const Terrain = ({ texture, color }: any) => {
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(160, 160, 64, 64);
        const posAttribute = geo.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            const dist = Math.sqrt(x*x + y*y);
            let zHeight = 0;
            if (dist > 15) {
                zHeight += (dist - 15) * 0.15;
                zHeight += Math.sin(x * 0.2) * 0.5 + Math.cos(y * 0.2) * 0.5;
            } else {
                 zHeight += (Math.random() - 0.5) * 0.1;
            }
            posAttribute.setZ(i, zHeight);
        }
        geo.computeVertexNormals();
        return geo;
    }, []);
    texture.repeat.set(24, 24);
    return (
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <meshStandardMaterial map={texture} color={color} roughness={1} bumpMap={texture} bumpScale={0.5} />
        </mesh>
    );
};

// --- Seasonal Particle Effects (Same as before) ---
const SpringFlowers = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 500;
    const tempObj = new THREE.Object3D();
    useEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 10 + Math.random() * 80;
            tempObj.position.set(Math.cos(angle) * r, 0.5, Math.sin(angle) * r);
            tempObj.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
            tempObj.scale.setScalar(0.5 + Math.random());
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
            meshRef.current.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.8, 0.6));
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, []);
    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow><dodecahedronGeometry args={[0.3, 0]} /><meshStandardMaterial roughness={0.5} /></instancedMesh>;
};
const SummerBirds = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 30;
    const birds = useMemo(() => new Array(count).fill(0).map(() => ({ speed: 5 + Math.random() * 5, offset: Math.random() * 100, radius: 20 + Math.random() * 40, yBase: 15 + Math.random() * 10 })), []);
    const dummy = new THREE.Object3D();
    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.getElapsedTime();
        birds.forEach((bird, i) => {
            const angle = t * (bird.speed * 0.1) + bird.offset;
            dummy.position.set(Math.cos(angle) * bird.radius, bird.yBase + Math.sin(t * 2 + bird.offset) * 2, Math.sin(angle) * bird.radius);
            dummy.lookAt(Math.cos(angle + 0.1) * bird.radius, bird.yBase, Math.sin(angle + 0.1) * bird.radius);
            dummy.scale.set(1, 1, 3);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow><coneGeometry args={[0.2, 1, 4]} /><meshStandardMaterial color="#FFFFFF" /></instancedMesh>;
};
const AutumnLeaves = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 400;
    const dummy = new THREE.Object3D();
    const leaves = useMemo(() => new Array(count).fill(0).map(() => ({ x: (Math.random() - 0.5) * 100, y: Math.random() * 40, z: (Math.random() - 0.5) * 100, speed: 2 + Math.random() * 3, rotationSpeed: Math.random() * 5 })), []);
    useFrame((state, delta) => {
        if (!meshRef.current) return;
        leaves.forEach((leaf, i) => {
            leaf.y -= leaf.speed * delta;
            if (leaf.y < 0) leaf.y = 40;
            dummy.position.set(leaf.x + Math.sin(state.clock.elapsedTime + i) * 2, leaf.y, leaf.z + Math.cos(state.clock.elapsedTime + i) * 2);
            dummy.rotation.x += leaf.rotationSpeed * delta; dummy.rotation.y += leaf.rotationSpeed * delta;
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]}><planeGeometry args={[0.4, 0.4]} /><meshStandardMaterial color="#FF5722" side={THREE.DoubleSide} transparent /></instancedMesh>;
};
const WinterSnow = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 2000;
    const dummy = new THREE.Object3D();
    const flakes = useMemo(() => new Array(count).fill(0).map(() => ({ x: (Math.random() - 0.5) * 120, y: Math.random() * 50, z: (Math.random() - 0.5) * 120, speed: 4 + Math.random() * 4 })), []);
    useFrame((state, delta) => {
        if (!meshRef.current) return;
        flakes.forEach((flake, i) => {
            flake.y -= flake.speed * delta;
            if (flake.y < 0) flake.y = 50;
            dummy.position.set(flake.x + Math.sin(state.clock.elapsedTime + i) * 0.5, flake.y, flake.z);
            dummy.rotation.set(Math.random(), Math.random(), Math.random());
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]}><boxGeometry args={[0.1, 0.1, 0.1]} /><meshBasicMaterial color="#FFFFFF" transparent opacity={0.8} /></instancedMesh>;
};


// --- Main Forest Scene ---

const seasonColors = {
    spring: { leaf: '#81C784', ground: '#66BB6A', sky: '#87CEEB', ambient: '#ffffff' },
    summer: { leaf: '#2E7D32', ground: '#33691E', sky: '#4FC3F7', ambient: '#ffffee' },
    autumn: { leaf: '#FF5722', ground: '#8D6E63', sky: '#FFCC80', ambient: '#ffe0b2' },
    winter: { leaf: '#CFD8DC', ground: '#ECEFF1', sky: '#B0BEC5', ambient: '#e0f7fa' },
};

export const ForestScene: React.FC<ForestSceneProps> = ({ season, handData }) => {
  const textures = useProceduralTextures();
  const colors = seasonColors[season];

  return (
    <div id="canvas-container" className="w-full h-full">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 8, 20], fov: 60 }}>
      {/* Lights */}
      <ambientLight intensity={0.4} color={colors.ambient} />
      <hemisphereLight color={colors.sky} groundColor={colors.ground} intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40]} />
      </directionalLight>
      <Sky sunPosition={season === 'winter' ? [10, 5, 100] : [100, 40, 100]} turbidity={season === 'winter' ? 10 : 2} />
      <fog attach="fog" args={[colors.ambient, 10, season === 'winter' ? 40 : 80]} />
      <BakeShadows />

      {/* Controllers */}
      <HybridController handData={handData} />

      {/* Seasonal Effects */}
      {season === 'spring' && <SpringFlowers />}
      {season === 'summer' && <SummerBirds />}
      {season === 'autumn' && <AutumnLeaves />}
      {season === 'winter' && <WinterSnow />}

      {/* World Content */}
      <group>
        <Terrain texture={textures.ground} color={colors.ground} />
        
        {/* Amphitheater Seating (Benches) */}
        {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i / 4) * Math.PI - Math.PI / 2; // Semi-circle
            const x = Math.cos(angle) * 10;
            const z = Math.sin(angle) * 10;
            return <WoodenBench key={`bench-${i}`} position={[x, 0, z]} rotation={[0, -angle, 0]} texture={textures.wood} />
        })}
        {Array.from({ length: 7 }).map((_, i) => {
            const angle = (i / 6) * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * 15;
            const z = Math.sin(angle) * 15;
            return <WoodenBench key={`bench-outer-${i}`} position={[x, 0.5, z]} rotation={[0, -angle, 0]} texture={textures.wood} />
        })}

        {/* Trees (Increased Density) */}
        {Array.from({ length: 150 }).map((_, i) => {
             const angle = Math.random() * Math.PI * 2;
             // Keep center clear (radius > 20)
             const dist = 22 + Math.pow(Math.random(), 2) * 60; // Spread further out
             const x = Math.cos(angle) * dist;
             const z = Math.sin(angle) * dist;
             const scale = 0.8 + Math.random() * 0.8; // More scale variance
             return (
                 <ProceduralTree 
                    key={i} 
                    position={[x, 0, z]}
                    scale={scale}
                    textures={textures}
                    leafColor={colors.leaf}
                 />
             );
        })}
      </group>
    </Canvas>
    </div>
  );
};
