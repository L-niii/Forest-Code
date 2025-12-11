
import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hands: any;
    FaceMesh: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    FACEMESH_TESSELATION: any;
  }
}

export interface HandData {
  gesture: 'none' | 'single' | 'dual_fist' | 'dual_open' | 'dual_1' | 'dual_2' | 'dual_3' | 'dual_4';
  x: number; // Hand Center X
  y: number; // Hand Center Y
  handCount: number;
  headYaw: number; // -1 (Left) to 1 (Right)
  headPitch: number; // -1 (Up) to 1 (Down)
}

interface GestureHandlerProps {
  onHandUpdate: (data: HandData) => void;
  active: boolean;
}

export const GestureHandler: React.FC<GestureHandlerProps> = ({ onHandUpdate, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  
  const [status, setStatus] = useState<string>('Waiting for camera...');
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Local state to store latest results from both models
  const latestHands = useRef<any>(null);
  const latestFace = useRef<any>(null);

  useEffect(() => {
    if (!active) return;

    let isMounted = true;

    const initMediaPipe = async () => {
      if (!window.Hands || !window.Camera || !window.FaceMesh) {
        setStatus('Loading MediaPipe models...');
        setTimeout(initMediaPipe, 500);
        return;
      }

      setStatus('Initializing Models...');

      try {
        // 1. Initialize Hands
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        handsRef.current = hands;
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
        hands.onResults((results: any) => {
            latestHands.current = results;
            processCombinedResults();
        });

        // 2. Initialize FaceMesh
        const faceMesh = new window.FaceMesh({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMeshRef.current = faceMesh;
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });
        faceMesh.onResults((results: any) => {
            latestFace.current = results;
            // Face results usually come slightly faster or slower, we trigger update on Hands mostly, 
            // but if hands are missing, we still want head tracking.
            if (!latestHands.current || !latestHands.current.multiHandLandmarks?.length) {
                processCombinedResults();
            }
        });

        // 3. Helper to combine data and render
        const processCombinedResults = () => {
             if (!isMounted || !canvasRef.current) return;
             const ctx = canvasRef.current.getContext('2d');
             if (!ctx) return;

             ctx.save();
             ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
             
             // Draw Video Background (Use latest image from either source)
             const img = latestHands.current?.image || latestFace.current?.image;
             if (img) {
                 ctx.save();
                 ctx.scale(-1, 1);
                 ctx.translate(-canvasRef.current.width, 0);
                 ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                 ctx.restore();
             }

             // --- PROCESS HANDS ---
             let currentGesture: HandData['gesture'] = 'none';
             let avgX = 0.5;
             let avgY = 0.5;
             let handCount = 0;

             if (latestHands.current?.multiHandLandmarks?.length > 0) {
                 const results = latestHands.current;
                 handCount = results.multiHandLandmarks.length;
                 let totalX = 0;
                 let totalY = 0;
                 const fingerCounts: number[] = [];

                 for (const landmarks of results.multiHandLandmarks) {
                     // Draw Hands
                     ctx.save();
                     ctx.scale(-1, 1);
                     ctx.translate(-canvasRef.current.width, 0);
                     if (window.drawConnectors) window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                     ctx.restore();

                     totalX += (1 - landmarks[0].x);
                     totalY += landmarks[0].y;
                     fingerCounts.push(countFingers(landmarks));
                 }
                 avgX = totalX / handCount;
                 avgY = totalY / handCount;

                 if (handCount === 2) {
                     const f1 = fingerCounts[0];
                     const f2 = fingerCounts[1];
                     if (f1 >= 4 && f2 >= 4) currentGesture = 'dual_open';
                     else if (f1 === 0 && f2 === 0) currentGesture = 'dual_fist';
                     else if (f1 === 1 && f2 === 1) currentGesture = 'dual_1';
                     else if (f1 === 2 && f2 === 2) currentGesture = 'dual_2';
                     else if (f1 === 3 && f2 === 3) currentGesture = 'dual_3';
                     else if (f1 === 4 && f2 === 4) currentGesture = 'dual_4';
                     else currentGesture = 'single';
                 } else {
                     currentGesture = 'single';
                 }
             }

             // --- PROCESS HEAD (FACE) ---
             let headYaw = 0;
             let headPitch = 0;

             if (latestFace.current?.multiFaceLandmarks?.length > 0) {
                 const landmarks = latestFace.current.multiFaceLandmarks[0];
                 
                 // Draw Face Mesh (Subtle)
                 ctx.save();
                 ctx.scale(-1, 1);
                 ctx.translate(-canvasRef.current.width, 0);
                 // Only draw minimal mesh to save perf/visuals
                 // if (window.drawConnectors) window.drawConnectors(ctx, landmarks, window.FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 0.5 });
                 
                 // Draw nose tip for reference
                 const nose = landmarks[4]; // Tip of nose
                 const topHead = landmarks[10];
                 const bottomHead = landmarks[152];
                 const leftFace = landmarks[234]; // Cheek/Ear area
                 const rightFace = landmarks[454];

                 // Draw a line for face direction
                 ctx.fillStyle = "yellow";
                 ctx.beginPath();
                 ctx.arc(nose.x * canvasRef.current.width, nose.y * canvasRef.current.height, 4, 0, 2*Math.PI);
                 ctx.fill();
                 ctx.restore();

                 // --- Head Rotation Math (Approximate from 2D Landmarks) ---
                 
                 // Yaw (Left/Right): Compare Nose X to the center of the face width
                 // Note: landmarks are mirrored in the loop, but raw data is normalized 0-1.
                 // In raw MediaPipe data: x=0 is Left (viewer's left), x=1 is Right.
                 // If nose.x < mid.x, looking Left (viewer perspective). 
                 const midX = (leftFace.x + rightFace.x) / 2;
                 const rawYaw = (nose.x - midX) * 10; // Multiplier for sensitivity
                 // Invert because we mirror the canvas usually, but let's check standard logic.
                 // If I look Left, my nose moves Left (x decreases). 
                 headYaw = -rawYaw; // Invert to match standard camera controls

                 // Pitch (Up/Down): Compare Nose Y to center of face height
                 const midY = (topHead.y + bottomHead.y) / 2;
                 const rawPitch = (nose.y - midY) * 10;
                 headPitch = -rawPitch;
             }

             // Status update
             setStatus(`Hands: ${handCount} | Head Tracking Active`);
             setDebugInfo(`G:${currentGesture} | Y:${headYaw.toFixed(2)} P:${headPitch.toFixed(2)}`);
             ctx.restore();

             // Send Combined Data
             onHandUpdate({
                 gesture: currentGesture,
                 x: avgX,
                 y: avgY,
                 handCount: handCount,
                 headYaw: headYaw, // -1 to 1
                 headPitch: headPitch // -1 to 1
             });
        };

        // 4. Start Camera Loop
        if (videoRef.current && !cameraRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (handsRef.current && videoRef.current) {
                  // We can't await both easily in the same tick without lag, 
                  // but standard `send` is optimized.
                  await handsRef.current.send({ image: videoRef.current });
              }
              if (faceMeshRef.current && videoRef.current) {
                  await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 320,
            height: 240,
          });
          cameraRef.current = camera;
          await camera.start();
        }
      } catch (error) {
        console.error("MediaPipe error:", error);
        setStatus('Error');
      }
    };

    initMediaPipe();

    return () => {
      isMounted = false;
      if (handsRef.current) handsRef.current.close();
      if (faceMeshRef.current) faceMeshRef.current.close();
      handsRef.current = null;
      faceMeshRef.current = null;
    };
  }, [active, onHandUpdate]);

  const countFingers = (landmarks: any[]) => {
    const wrist = landmarks[0];
    let count = 0;
    const isFingerExtended = (tipIdx: number, pipIdx: number) => {
        const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
        const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
        return dTip > dPip;
    };
    const thumbTip = landmarks[4];
    const indexMCP = landmarks[5];
    const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
    const isThumbOpen = thumbDist > 0.08; 

    if (isThumbOpen) count++;
    if (isFingerExtended(8, 6)) count++;
    if (isFingerExtended(12, 10)) count++;
    if (isFingerExtended(16, 14)) count++;
    if (isFingerExtended(20, 18)) count++;
    return count;
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl transition-all border-2 border-white/20 bg-black ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} width={320} height={240} className="w-48 h-36" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-center text-white text-[10px] font-mono">
           {status} | {debugInfo}
        </div>
    </div>
  );
};
