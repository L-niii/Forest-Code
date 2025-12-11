
import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

export interface HandData {
  gesture: 'none' | 'single' | 'dual_fist' | 'dual_open' | 'dual_1' | 'dual_2' | 'dual_3' | 'dual_4';
  x: number; // 0-1, center point of all hands
  y: number; // 0-1
  handCount: number;
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
  const [status, setStatus] = useState<string>('Waiting for camera...');
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (!active) return;

    let isMounted = true;

    const initMediaPipe = async () => {
      if (!window.Hands || !window.Camera) {
        setStatus('Loading MediaPipe scripts...');
        setTimeout(initMediaPipe, 500);
        return;
      }

      setStatus('Initializing Model (2 Hands)...');

      try {
        const hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        handsRef.current = hands;

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          if (!isMounted || !canvasRef.current) return;
          
          const ctx = canvasRef.current.getContext('2d');
          if (!ctx) return;

          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Draw video
          if (results.image) {
             ctx.save();
             ctx.scale(-1, 1);
             ctx.translate(-canvasRef.current.width, 0);
             ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
             ctx.restore();
          }

          let currentGesture: HandData['gesture'] = 'none';
          let avgX = 0.5;
          let avgY = 0.5;
          let handCount = 0;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            handCount = results.multiHandLandmarks.length;
            setStatus(`${handCount} Hand(s) Detected`);

            let totalX = 0;
            let totalY = 0;
            const fingerCounts: number[] = [];

            // Process each hand
            for (const landmarks of results.multiHandLandmarks) {
                // Draw landmarks (Mirrored)
                ctx.save();
                ctx.scale(-1, 1);
                ctx.translate(-canvasRef.current.width, 0);
                if (window.drawConnectors) window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                if (window.drawLandmarks) window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
                ctx.restore();

                // Accumulate position (using wrist)
                totalX += (1 - landmarks[0].x);
                totalY += landmarks[0].y;

                // Count fingers
                fingerCounts.push(countFingers(landmarks));
            }

            // Calculate Center Point
            avgX = totalX / handCount;
            avgY = totalY / handCount;

            // --- Dual Gesture Logic ---
            if (handCount === 2) {
                const f1 = fingerCounts[0];
                const f2 = fingerCounts[1];

                // Check for matched gestures
                // We use >= 4 for open to be more forgiving of a slightly bent pinky
                if (f1 >= 4 && f2 >= 4) currentGesture = 'dual_open';
                else if (f1 === 0 && f2 === 0) currentGesture = 'dual_fist';
                // Strict counting for numbers
                else if (f1 === 1 && f2 === 1) currentGesture = 'dual_1';
                else if (f1 === 2 && f2 === 2) currentGesture = 'dual_2';
                else if (f1 === 3 && f2 === 3) currentGesture = 'dual_3';
                else if (f1 === 4 && f2 === 4) currentGesture = 'dual_4'; // Specific 4 fingers (thumb tucked)
                else currentGesture = 'single';
                
                setDebugInfo(`L:${f1} R:${f2} | G:${currentGesture}`);
            } else {
                currentGesture = 'single';
                setDebugInfo(`Hands: 1 | F:${fingerCounts[0]}`);
            }

          } else {
            setStatus('Show Both Hands');
            setDebugInfo('');
          }
          ctx.restore();

          // Send update
          onHandUpdate({
            gesture: currentGesture,
            x: avgX,
            y: avgY,
            handCount: handCount
          });
        });

        if (videoRef.current && !cameraRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (handsRef.current && videoRef.current) {
                await handsRef.current.send({ image: videoRef.current });
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
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
    };
  }, [active, onHandUpdate]);

  const countFingers = (landmarks: any[]) => {
    const wrist = landmarks[0];
    let count = 0;

    // Helper: Is finger tip further from wrist than PIP joint?
    // Using just distance is robust for rotation.
    const isFingerExtended = (tipIdx: number, pipIdx: number) => {
        const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
        const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
        // Removed the 1.1 multiplier which caused instability. 
        // If Tip is further than PIP, it's likely open.
        return dTip > dPip;
    };

    // Thumb Check:
    // Check distance between Thumb Tip (4) and Index Finger MCP (5).
    // If they are close, thumb is tucked (Fist). If far, thumb is open.
    // 0.1 is a normalized distance threshold.
    const thumbTip = landmarks[4];
    const indexMCP = landmarks[5];
    const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
    const isThumbOpen = thumbDist > 0.08; 

    if (isThumbOpen) count++;
    if (isFingerExtended(8, 6)) count++; // Index
    if (isFingerExtended(12, 10)) count++; // Middle
    if (isFingerExtended(16, 14)) count++; // Ring
    if (isFingerExtended(20, 18)) count++; // Pinky

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
