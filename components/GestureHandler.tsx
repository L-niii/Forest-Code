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

interface GestureHandlerProps {
  onGestureChange: (gesture: 'none' | 'fist' | 'open', intensity: number) => void;
  active: boolean;
}

export const GestureHandler: React.FC<GestureHandlerProps> = ({ onGestureChange, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const [gesture, setGesture] = useState<'none' | 'fist' | 'open'>('none');
  const [status, setStatus] = useState<string>('Waiting for camera...');
  const holdStartTime = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    let isMounted = true;

    const initMediaPipe = async () => {
      if (!window.Hands || !window.Camera) {
        setStatus('Loading MediaPipe scripts...');
        // Simple retry mechanism if scripts are deferred
        setTimeout(initMediaPipe, 500);
        return;
      }

      setStatus('Initializing Model...');

      try {
        const hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        handsRef.current = hands;

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          if (!isMounted || !canvasRef.current) return;
          
          const ctx = canvasRef.current.getContext('2d');
          if (!ctx) return;

          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Draw video frame to canvas
          if (results.image) {
             ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }

          let currentGesture: 'none' | 'fist' | 'open' = 'none';

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setStatus('Hand Detected');
            for (const landmarks of results.multiHandLandmarks) {
              if (window.drawConnectors) {
                  window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
              }
              if (window.drawLandmarks) {
                  window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
              }
              currentGesture = detectGesture(landmarks);
            }
          } else {
            setStatus('No Hand Detected');
          }
          ctx.restore();

          // Gesture Logic & Intensity Calculation
          const now = Date.now();
          if (currentGesture !== 'none') {
            if (holdStartTime.current === 0) holdStartTime.current = now;
            const duration = (now - holdStartTime.current) / 1000;
            // Ramp up intensity over 2 seconds
            const intensity = Math.min(duration / 2.0, 1.0); 
            onGestureChange(currentGesture, intensity);
          } else {
            holdStartTime.current = 0;
            onGestureChange('none', 0);
          }
          setGesture(currentGesture);
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
        console.error("MediaPipe initialization error:", error);
        setStatus('Error initializing');
      }
    };

    initMediaPipe();

    return () => {
      isMounted = false;
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
      // Note: Camera utils don't have a clean stop method exposed easily, 
      // but cleaning up the hands instance prevents processing.
    };
  }, [active, onGestureChange]);

  const detectGesture = (landmarks: any[]) => {
    // Landmarks: 0=Wrist, 8=IndexTip, 5=IndexBase, etc.
    const wrist = landmarks[0];
    
    // Check if fingers are curled by comparing tip distance to wrist vs knuckle distance to wrist
    const isCurled = (tipIdx: number, baseIdx: number) => {
        const tip = landmarks[tipIdx];
        const base = landmarks[baseIdx];
        const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        return dTip < dBase; 
    };

    const indexCurled = isCurled(8, 5);
    const middleCurled = isCurled(12, 9);
    const ringCurled = isCurled(16, 13);
    const pinkyCurled = isCurled(20, 17);
    // Thumb is tricky, ignore for basic fist/open

    // Fist: At least 3 fingers curled (allow some flexibility)
    if (indexCurled && middleCurled && ringCurled && pinkyCurled) {
        return 'fist';
    }

    // Open: At least 3 fingers extended
    if (!indexCurled && !middleCurled && !ringCurled && !pinkyCurled) {
        return 'open';
    }

    return 'none';
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl transition-all border-2 border-white/20 bg-black ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} width={320} height={240} className="w-48 h-36" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-center text-white text-[10px] font-mono">
           {status} | G: {gesture.toUpperCase()}
        </div>
    </div>
  );
};
