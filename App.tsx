
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ForestScene } from './components/ForestScene';
import { GestureHandler, HandData } from './components/GestureHandler';
import { AudioManager } from './components/AudioManager';
import { Hand, Volume2, Flower2, Sun, CloudRain, Snowflake, Move, Keyboard, MousePointer, Loader2, Eye } from 'lucide-react';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export default function App() {
  const [season, setSeason] = useState<Season>('summer');
  const [handData, setHandData] = useState<HandData>({ gesture: 'none', x: 0.5, y: 0.5, handCount: 0, headYaw: 0, headPitch: 0 });
  const [isStarted, setIsStarted] = useState(false);
  const [pendingSeason, setPendingSeason] = useState<Season | null>(null);
  const [progress, setProgress] = useState(0);
  
  const audioManager = useRef<AudioManager | null>(null);
  const gestureHoldTimer = useRef<number>(0);
  const lastGesture = useRef<string>('none');
  const lastTime = useRef<number>(0);

  const handleStart = () => {
    audioManager.current = new AudioManager();
    audioManager.current.init();
    setIsStarted(true);
  };

  const handleHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
    
    // Time delta for smooth timer
    const now = performance.now();
    const dt = now - lastTime.current;
    lastTime.current = now;

    // Map gesture to target season (Now requires DUAL hands)
    let targetSeason: Season | null = null;
    if (data.gesture === 'dual_1') targetSeason = 'spring';
    else if (data.gesture === 'dual_2') targetSeason = 'summer';
    else if (data.gesture === 'dual_3') targetSeason = 'autumn';
    else if (data.gesture === 'dual_4') targetSeason = 'winter';

    // Season Change Debouncing Logic
    const HOLD_DURATION = 1500;

    if (targetSeason && targetSeason !== season) {
        if (data.gesture === lastGesture.current) {
            gestureHoldTimer.current += dt;
            const p = Math.min(gestureHoldTimer.current / HOLD_DURATION, 1);
            setPendingSeason(targetSeason);
            setProgress(p);

            if (gestureHoldTimer.current >= HOLD_DURATION) {
                setSeason(targetSeason);
                gestureHoldTimer.current = 0;
                setPendingSeason(null);
                setProgress(0);
            }
        } else {
            gestureHoldTimer.current = 0;
            setPendingSeason(targetSeason);
            setProgress(0);
        }
    } else {
        gestureHoldTimer.current = 0;
        setPendingSeason(null);
        setProgress(0);
    }
    
    lastGesture.current = data.gesture;

  }, [season]);

  // Sync Audio to Season
  useEffect(() => {
    if (!audioManager.current || !isStarted) return;
    audioManager.current.setSeason(season);

    if (season === 'summer' || season === 'spring') {
        const interval = setInterval(() => {
            if (Math.random() > (season === 'summer' ? 0.6 : 0.8)) audioManager.current?.playBirdSound();
        }, 2000);
        return () => clearInterval(interval);
    }
  }, [season, isStarted]);

  return (
    <div className="w-full h-screen bg-neutral-900 relative overflow-hidden font-sans select-none">
      
      {!isStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 text-center">
            <h1 className="text-4xl font-bold text-white mb-8 tracking-tighter">Forest Symphony</h1>
            
            {/* Instruction Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-gray-400 text-xs md:text-sm max-w-4xl">
                {/* Hand Controls */}
                <div className="bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 border border-white/5">
                    <Hand size={24} className="text-green-400 mb-1"/>
                    <div className="font-bold text-white">Two-Hand Controls</div>
                    <ul className="text-left space-y-1 opacity-80">
                        <li>Both Open/Fist: <b>Fwd/Back</b></li>
                        <li>Move Hands: <b>Strafe & Fly</b></li>
                    </ul>
                </div>

                {/* Season Controls */}
                <div className="bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 border border-white/5">
                    <div className="flex gap-1 mb-1">
                       <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white">1</span>
                       <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white">2</span>
                       <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white">3</span>
                       <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white">4</span>
                    </div>
                    <div className="font-bold text-white">Seasons</div>
                    <div className="text-center opacity-80 leading-tight">
                        Hold 1-4 fingers on <b>BOTH</b> hands (e.g., 1+1=Spring)
                    </div>
                </div>

                {/* Head Controls */}
                 <div className="bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 border border-white/5">
                    <Eye size={24} className="text-purple-400 mb-1"/>
                    <div className="font-bold text-white">Head Look</div>
                    <ul className="text-left space-y-1 opacity-80">
                        <li>Turn Head Left/Right: <b>Turn</b></li>
                        <li>Tilt Head Up/Down: <b>Pitch</b></li>
                    </ul>
                </div>
                
                 {/* Keyboard Controls */}
                 <div className="bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 border border-white/5">
                    <Keyboard size={24} className="text-blue-400 mb-1"/>
                    <div className="font-bold text-white">Keyboard</div>
                    <ul className="text-left space-y-1 opacity-80">
                        <li><span className="font-mono bg-white/20 px-1 rounded">W</span> <span className="font-mono bg-white/20 px-1 rounded">S</span> Move</li>
                        <li><span className="font-mono bg-white/20 px-1 rounded">A</span> <span className="font-mono bg-white/20 px-1 rounded">D</span> Strafe</li>
                    </ul>
                </div>

            </div>
            
            <button 
                onClick={handleStart}
                className="px-10 py-4 bg-white text-black text-xl font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
                Enter Forest
            </button>
        </div>
      )}

      {/* Main 3D Viewport */}
      <div className="absolute inset-0 z-0 cursor-crosshair">
        {isStarted && <ForestScene season={season} handData={handData} />}
      </div>

      {/* Overlay UI */}
      {isStarted && (
        <>
            {/* Pending Season Overlay */}
            {pendingSeason && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl flex flex-col items-center gap-3 border border-white/20 shadow-2xl">
                        <Loader2 className="animate-spin text-white w-8 h-8" />
                        <div className="text-white font-bold tracking-widest uppercase text-sm">Switching to {pendingSeason}</div>
                        <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-400 transition-all duration-75 ease-linear"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl text-white shadow-xl border border-white/10">
                    <h1 className="text-xl font-bold tracking-tight mb-1 capitalize flex items-center gap-2">
                        {season}
                        {season === 'spring' && <Flower2 size={18} className="text-pink-400 animate-pulse"/>}
                        {season === 'summer' && <Sun size={18} className="text-yellow-400 animate-spin-slow"/>}
                        {season === 'autumn' && <CloudRain size={18} className="text-orange-400"/>}
                        {season === 'winter' && <Snowflake size={18} className="text-cyan-400 animate-bounce"/>}
                    </h1>
                    <div className="text-[10px] text-gray-400 font-mono mt-1">
                        AUDIO: {season === 'summer' ? 'INSECTS' : season === 'winter' ? 'HOWLING WIND' : season === 'autumn' ? 'WIND & LEAVES' : 'BREEZE & BIRDS'}
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl text-white shadow-xl border border-white/10 max-w-[200px]">
                     <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-gray-400">INPUT</span>
                         <span className="text-[10px] font-mono bg-white/20 px-1 rounded">{handData.gesture.replace('dual_', '2x ').toUpperCase()}</span>
                    </div>
                     {/* Hand Position visualizer */}
                    <div className="w-full h-16 bg-black/50 border border-white/10 rounded-lg relative overflow-hidden mb-2">
                         <div className="absolute top-1 left-1 text-[9px] text-gray-500">HANDS</div>
                        <div className="absolute top-1/2 left-1/2 w-[1px] h-full bg-white/20 -translate-x-1/2 -translate-y-1/2"/>
                        <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-white/20 -translate-x-1/2 -translate-y-1/2"/>
                        <div 
                            className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ${handData.handCount > 0 ? 'bg-green-500' : 'bg-red-500 opacity-20'}`}
                            style={{ 
                                left: `${(1 - handData.x) * 100}%`, 
                                top: `${handData.y * 100}%` 
                            }}
                        />
                    </div>
                    {/* Head Position visualizer */}
                     <div className="w-full h-16 bg-black/50 border border-white/10 rounded-lg relative overflow-hidden">
                        <div className="absolute top-1 left-1 text-[9px] text-gray-500">HEAD</div>
                        <div className="absolute top-1/2 left-1/2 w-[1px] h-full bg-white/20 -translate-x-1/2 -translate-y-1/2"/>
                        <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-white/20 -translate-x-1/2 -translate-y-1/2"/>
                        {/* Visualize yaw/pitch as a dot */}
                        <div 
                            className="absolute w-2 h-2 rounded-full bg-yellow-400 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_yellow]"
                            style={{ 
                                left: `${50 + (handData.headYaw * 50)}%`, // Scale logic to visual
                                top: `${50 + (handData.headPitch * 50)}%` 
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Hand Tracking Module */}
            <GestureHandler 
                active={isStarted} 
                onHandUpdate={handleHandUpdate} 
            />
        </>
      )}
    </div>
  );
}
