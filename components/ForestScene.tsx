
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, BakeShadows } from '@react-three/drei';
import * as THREE from 'three';
import { HandData } from './GestureHandler';
import { AudioManager } from './AudioManager';

interface ForestSceneProps {
    season: 'spring' | 'summer' | 'autumn' | 'winter';
    handData: HandData;
    audioManager: React.MutableRefObject<AudioManager | null>;
}

// --- Procedural Textures ---
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
        // Simple vein structure for particle usage
        ctx.strokeStyle = '#eeeeee';
        ctx.beginPath();
        ctx.moveTo(256, 50);
        ctx.lineTo(256, 460);
        ctx.stroke();
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

// --- Hybrid Camera Control ---
const HybridController = ({ handData }: { handData: HandData }) => {
    const { camera } = useThree();
    const keys = useRef<{ [key: string]: boolean }>({});
    const velocity = useRef(new THREE.Vector3());
    const currentYaw = useRef(0);
    const currentPitch = useRef(0);

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
        const rotDeadzone = 0.15;
        let rotSpeedY = 0;
        let rotSpeedX = 0;
        if (Math.abs(handData.headYaw) > rotDeadzone) {
            const input = handData.headYaw;
            rotSpeedY = Math.sign(input) * Math.pow(Math.abs(input), 1.5) * 2.0;
        }
        if (Math.abs(handData.headPitch) > rotDeadzone) {
            const input = handData.headPitch;
            rotSpeedX = Math.sign(input) * Math.pow(Math.abs(input), 1.5) * 1.5;
        }
        currentYaw.current -= rotSpeedY * delta;
        currentPitch.current += rotSpeedX * delta;
        currentPitch.current = Math.max(-1.4, Math.min(1.4, currentPitch.current));
        camera.rotation.order = 'YXZ';
        camera.rotation.y = currentYaw.current;
        camera.rotation.x = currentPitch.current;

        let forwardSpeed = 0;
        let strafeSpeed = 0;
        let verticalSpeed = 0;
        const moveDeadzone = 0.25;

        if (handData.handCount > 0) {
            if (handData.gesture === 'dual_open') forwardSpeed += 8; 
            else if (handData.gesture === 'dual_fist') forwardSpeed -= 5; 

            if (Math.abs(handData.x - 0.5) > moveDeadzone) {
                const input = handData.x - 0.5;
                const sign = Math.sign(input);
                strafeSpeed += sign * Math.pow(Math.abs(input), 1.5) * 15; 
            }
            if (Math.abs(handData.y - 0.5) > moveDeadzone) {
                const input = handData.y - 0.5;
                const sign = Math.sign(input);
                verticalSpeed -= sign * Math.pow(Math.abs(input), 1.5) * 8;
            }
        }
        if (keys.current['KeyW'] || keys.current['ArrowUp']) forwardSpeed += 12;
        if (keys.current['KeyS'] || keys.current['ArrowDown']) forwardSpeed -= 12;
        if (keys.current['KeyA'] || keys.current['ArrowLeft']) strafeSpeed -= 12;
        if (keys.current['KeyD'] || keys.current['ArrowRight']) strafeSpeed += 12;
        
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
        
        if (velocity.current.lengthSq() > 0.01) camera.position.addScaledVector(velocity.current, delta);
        if (camera.position.y < 2) camera.position.y = 2;
    });

    return null;
}

// --- Hand Interaction Particles ---

const HandMagicParticles = ({ season, handData }: { season: 'spring' | 'summer' | 'autumn' | 'winter', handData: HandData }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 200; // Number of particles in the pool
    const { camera } = useThree();
    
    // Particle State
    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            position: new THREE.Vector3(0, -1000, 0),
            velocity: new THREE.Vector3(),
            life: 0,
            scale: 1,
            rotation: new THREE.Vector3(),
            rotationSpeed: new THREE.Vector3(),
            color: new THREE.Color()
        }));
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);
    const lastHandPos = useRef(new THREE.Vector3());
    const particleIndex = useRef(0);

    // Season Config
    const config = useMemo(() => {
        switch(season) {
            case 'spring': return { 
                color1: '#ffb7b2', color2: '#ffdac1', // Pink/Peach
                gravity: 0.5, drag: 0.98, spread: 0.2, life: 1.5, scale: 0.3,
                shape: 'petal'
            };
            case 'summer': return { 
                color1: '#4caf50', color2: '#8bc34a', // Greens
                gravity: -0.5, drag: 0.95, spread: 0.4, life: 1.0, scale: 0.4,
                shape: 'leaf'
            };
            case 'autumn': return { 
                color1: '#ff5722', color2: '#ff9800', // Orange/Red
                gravity: -1.0, drag: 0.96, spread: 0.5, life: 2.0, scale: 0.4,
                shape: 'leaf'
            };
            case 'winter': return { 
                color1: '#e0f7fa', color2: '#ffffff', // White/Cyan
                gravity: -0.2, drag: 0.99, spread: 0.3, life: 2.5, scale: 0.2,
                shape: 'snow'
            };
        }
    }, [season]);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // 1. Calculate Hand Position in 3D
        // Map 2D 0-1 coords to a plane in front of camera
        const vector = new THREE.Vector3(
            (handData.x * 2) - 1, // Normalized X (-1 to 1)
            -(handData.y * 2) + 1, // Normalized Y
            0.5 
        );
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = 8; // Distance from camera to spawn particles
        const targetPos = camera.position.clone().add(dir.multiplyScalar(distance));

        // Calculate hand velocity for "throwing" particles
        const handVel = targetPos.clone().sub(lastHandPos.current).divideScalar(delta);
        // Clamp huge jumps (like when hand first appears)
        if (handVel.length() > 50) handVel.set(0,0,0); 

        lastHandPos.current.copy(targetPos);

        // 2. Spawn New Particles if hand is present
        if (handData.handCount > 0) {
            const spawnRate = 2; // Particles per frame
            for(let i=0; i<spawnRate; i++) {
                particleIndex.current = (particleIndex.current + 1) % count;
                const p = particles[particleIndex.current];
                
                p.life = config.life;
                p.position.copy(targetPos).add(new THREE.Vector3(
                    (Math.random() - 0.5) * config.spread,
                    (Math.random() - 0.5) * config.spread,
                    (Math.random() - 0.5) * config.spread
                ));
                
                // Add some randomness + hand inertia
                p.velocity.copy(handVel).multiplyScalar(0.3).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ));
                
                p.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                p.rotationSpeed.set((Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5);
                p.scale = config.scale * (0.5 + Math.random() * 0.5);
                
                // Mix colors
                const c1 = new THREE.Color(config.color1);
                const c2 = new THREE.Color(config.color2);
                p.color = c1.lerp(c2, Math.random());
            }
        }

        // 3. Update & Render All Particles
        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= delta;
                
                // Physics
                p.velocity.y += config.gravity * delta * -5; // Gravity is reversed in config usually? let's make it intuitive.
                // Actually in 3D y-up, negative gravity falls down.
                // config.gravity 0.5 (Spring) -> floats up? Let's fix physics below.
                
                if (season === 'spring') p.velocity.y += 2 * delta; // Float up
                else if (season === 'summer') p.velocity.add(new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).multiplyScalar(10 * delta)); // Buzzing
                else if (season === 'autumn') p.velocity.x += Math.sin(state.clock.elapsedTime * 5) * 5 * delta; // Wind turbulence
                else if (season === 'winter') p.velocity.y -= 1 * delta; // Slow fall
                
                p.velocity.multiplyScalar(config.drag);
                p.position.add(p.velocity.clone().multiplyScalar(delta));
                
                p.rotation.x += p.rotationSpeed.x * delta;
                p.rotation.y += p.rotationSpeed.y * delta;
                p.rotation.z += p.rotationSpeed.z * delta;

                // Scale down as life fades
                const currentScale = p.scale * (p.life / config.life);

                dummy.position.copy(p.position);
                dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
                dummy.scale.set(currentScale, currentScale, currentScale);
                dummy.updateMatrix();
                
                meshRef.current?.setMatrixAt(i, dummy.matrix);
                meshRef.current?.setColorAt(i, p.color);
            } else {
                // Hide dead particles
                dummy.position.set(0, -1000, 0); // Move out of view
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                meshRef.current?.setMatrixAt(i, dummy.matrix);
            }
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
            {/* Simple Plane Geometry for performance, or use Dodecahedron for petals */}
            {season === 'spring' ? <dodecahedronGeometry args={[0.5, 0]} /> :
             season === 'winter' ? <octahedronGeometry args={[0.5, 0]} /> :
             <planeGeometry args={[1, 1]} /> 
            }
            <meshBasicMaterial transparent opacity={0.8} side={THREE.DoubleSide} />
        </instancedMesh>
    );
};


// --- Seasonal Particle Effects with Audio Sync (Existing) ---

const SpringFlowers = ({ audioManager }: { audioManager: React.MutableRefObject<AudioManager | null> }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 500;
    const tempObj = new THREE.Object3D();
    
    // Static data
    const initialScales = useMemo(() => new Float32Array(count).map(() => 0.5 + Math.random()), [count]);
    const positions = useMemo(() => {
        const arr = [];
        for(let i=0; i<count; i++) {
             const angle = Math.random() * Math.PI * 2;
             const r = 10 + Math.random() * 80;
             arr.push({ x: Math.cos(angle)*r, z: Math.sin(angle)*r, rot: Math.random() * Math.PI });
        }
        return arr;
    }, [count]);

    useEffect(() => {
        if (!meshRef.current) return;
        // Set initial colors once
        for (let i = 0; i < count; i++) {
             meshRef.current.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.8, 0.6));
        }
        meshRef.current.instanceColor!.needsUpdate = true;
    }, []);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        // Sync Visuals: Pulse growth
        const time = state.clock.elapsedTime;
        const pulse = Math.sin(time * 3) * 0.2 + 1.0; 
        
        // Trigger Audio: Occasional "growth pulse" sound on the beat
        if (Math.floor(time * 3) > Math.floor((time - 0.016) * 3) && Math.random() > 0.8) {
            audioManager.current?.playGrowthPulse();
        }

        for (let i = 0; i < count; i++) {
            const pos = positions[i];
            tempObj.position.set(pos.x, 0.5, pos.z);
            tempObj.rotation.set(0, pos.rot + time * 0.1, 0); // Slow rotation
            
            // Apply pulse to scale
            const scale = initialScales[i] * pulse;
            tempObj.scale.set(scale, scale, scale);
            
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow><dodecahedronGeometry args={[0.3, 0]} /><meshStandardMaterial roughness={0.5} /></instancedMesh>;
};

const SummerBirds = ({ audioManager }: { audioManager: React.MutableRefObject<AudioManager | null> }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 30;
    const birds = useMemo(() => new Array(count).fill(0).map(() => ({ 
        speed: 5 + Math.random() * 5, 
        offset: Math.random() * 100, 
        radius: 20 + Math.random() * 40, 
        yBase: 15 + Math.random() * 10 
    })), []);
    const dummy = new THREE.Object3D();

    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.getElapsedTime();

        // Audio Sync: Trigger bird chirp at specific bird's location randomly
        if (Math.random() < 0.01) {
            const birdIdx = Math.floor(Math.random() * count);
            const bird = birds[birdIdx];
            const angle = t * (bird.speed * 0.1) + bird.offset;
            const x = Math.cos(angle) * bird.radius;
            const y = bird.yBase + Math.sin(t * 2 + bird.offset) * 2;
            const z = Math.sin(angle) * bird.radius;
            
            audioManager.current?.playBirdSound(x, y, z);
        }

        birds.forEach((bird, i) => {
            const angle = t * (bird.speed * 0.1) + bird.offset;
            
            // Visual Sync: Flap wings (simulated by scaling Y) to a fast beat
            const flap = Math.sin(t * 15 + i) * 0.2 + 1; // 15Hz flap approx
            
            dummy.position.set(Math.cos(angle) * bird.radius, bird.yBase + Math.sin(t * 2 + bird.offset) * 2, Math.sin(angle) * bird.radius);
            dummy.lookAt(Math.cos(angle + 0.1) * bird.radius, bird.yBase, Math.sin(angle + 0.1) * bird.radius);
            dummy.scale.set(1, 1 * flap, 3); // Flapping effect
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow><coneGeometry args={[0.2, 1, 4]} /><meshStandardMaterial color="#FFFFFF" /></instancedMesh>;
};

const AutumnLeaves = ({ audioManager }: { audioManager: React.MutableRefObject<AudioManager | null> }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 400;
    const dummy = new THREE.Object3D();
    const leaves = useMemo(() => new Array(count).fill(0).map(() => ({ 
        x: (Math.random() - 0.5) * 100, 
        y: Math.random() * 40, 
        z: (Math.random() - 0.5) * 100, 
        speed: 2 + Math.random() * 3, 
        rotationSpeed: Math.random() * 5 
    })), []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        // Wind intensity simulation
        const windStrength = (Math.sin(state.clock.elapsedTime * 0.5) * 0.5 + 0.5); 

        leaves.forEach((leaf, i) => {
            leaf.y -= leaf.speed * delta;
            
            // Audio/Physics Sync: Leaf hit ground
            if (leaf.y < 0) {
                // Trigger sound (probability reduced to avoid chaos)
                if (Math.random() < 0.2) {
                     audioManager.current?.playLeafHit();
                }
                leaf.y = 40;
            }

            dummy.position.set(leaf.x + Math.sin(state.clock.elapsedTime + i) * 2 * windStrength, leaf.y, leaf.z + Math.cos(state.clock.elapsedTime + i) * 2);
            
            // Visual Sync: Rotation depends on Wind Strength
            const rot = leaf.rotationSpeed * delta * (1 + windStrength * 2);
            dummy.rotation.x += rot; 
            dummy.rotation.y += rot;
            
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

// Scene Component (Unchanged mostly) (Unchanged mostly)
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

export const ForestScene: React.FC<ForestSceneProps> = ({ season, handData, audioManager }) => {
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
      {/* Visual Coldness: Winter has denser fog matching the reverb effect */}
      <fog attach="fog" args={[colors.ambient, 10, season === 'winter' ? 30 : 80]} />
      <BakeShadows />

      {/* Controllers */}
      <HybridController handData={handData} />

      {/* Hand Interaction Particles (New) */}
      <HandMagicParticles season={season} handData={handData} />

      {/* Seasonal Effects (Now with Audio Links) */}
      {season === 'spring' && <SpringFlowers audioManager={audioManager} />}
      {season === 'summer' && <SummerBirds audioManager={audioManager} />}
      {season === 'autumn' && <AutumnLeaves audioManager={audioManager} />}
      {season === 'winter' && <WinterSnow />}

      {/* World Content */}
      <group>
        <Terrain texture={textures.ground} color={colors.ground} />
        
        {/* Benches */}
        {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i / 4) * Math.PI - Math.PI / 2;
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

        {/* Trees */}
        {Array.from({ length: 150 }).map((_, i) => {
             const angle = Math.random() * Math.PI * 2;
             const dist = 22 + Math.pow(Math.random(), 2) * 60; 
             const x = Math.cos(angle) * dist;
             const z = Math.sin(angle) * dist;
             const scale = 0.8 + Math.random() * 0.8; 
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
