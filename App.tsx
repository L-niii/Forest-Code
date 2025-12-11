import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ForestScene } from './components/ForestScene';
import { GestureHandler } from './components/GestureHandler';
import { AudioManager } from './components/AudioManager';
import { Move, Eye, Hand, Volume2, Wind } from 'lucide-react';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export default function App() {
  const [season, setSeason] = useState<Season>('summer');
  const [gesture, setGesture] = useState<'none' | 'fist' | 'open'>('none');
  const [intensity, setIntensity] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const audioManager = useRef<AudioManager | null>(null);

  const seasons: { id: Season; label: string; color: string }[] = [
    { id: 'spring', label: 'Spring', color: '#4CAF50' },
    { id: 'summer', label: 'Summer', color: '#2E7D32' },
    { id: 'autumn', label: 'Autumn', color: '#FF9800' },
    { id: 'winter', label: 'Winter', color: '#9E9E9E' },
  ];

  const handleStart = () => {
    audioManager.current = new AudioManager();
    audioManager.current.init();
    setIsStarted(true);
  };

  const handleGestureChange = useCallback((newGesture: 'none' | 'fist' | 'open', newIntensity: number) => {
    setGesture(newGesture);
    setIntensity(newIntensity);
  }, []);

  // Sync gesture to audio
  useEffect(() => {
    if (!isStarted || !audioManager.current) return;
    
    if (gesture === 'fist') {
       // Map intensity 0-1 to levels 1-3
       const level = intensity > 0.6 ? 3 : intensity > 0.3 ? 2 : 1;
       audioManager.current.setWindIntensity(level);
    } else {
       audioManager.current.setWindIntensity(0);
    }

    if (gesture === 'open') {
        // Trigger random bird sounds occasionally if open is held
        const chance = Math.random();
        if (chance > 0.92) { // approx once per second @ 60fps checks if we were running in loop, but here use interval
             audioManager.current.playBirdSound();
        }
    }
  }, [gesture, intensity, isStarted]);
  
  // Interval for birds when open
  useEffect(() => {
      if (gesture !== 'open' || !isStarted || !audioManager.current) return;
      const interval = setInterval(() => {
          if (Math.random() > 0.5) {
              audioManager.current?.playBirdSound();
          }
      }, 800);
      return () => clearInterval(interval);
  }, [gesture, isStarted]);

  return (
    <div className="w-full h-screen bg-neutral-900 relative overflow-hidden font-sans select-none">
      
      {!isStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 text-center">
            <h1 className="text-4xl font-bold text-white mb-8 tracking-tighter">Forest Immersion</h1>
            <div className="flex gap-4 mb-8 text-gray-400 text-sm max-w-md flex-wrap justify-center">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
                    <Hand size={16} /> <span>Camera Required</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
                    <Volume2 size={16} /> <span>Audio Required</span>
                </div>
            </div>
            
            <button 
                onClick={handleStart}
                className="group relative px-8 py-4 bg-white text-black text-xl font-bold rounded-full overflow-hidden hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
                <span className="relative z-10">Start Experience</span>
                <div className="absolute inset-0 bg-gradient-to-r from-green-300 to-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <p className="mt-4 text-gray-500 text-xs">Allow camera access when prompted</p>
        </div>
      )}

      {/* Main 3D Viewport */}
      <div className="absolute inset-0 z-0" onClick={() => isStarted && document.body.requestPointerLock()}>
        {isStarted && <ForestScene season={season} gesture={gesture} intensity={intensity} />}
      </div>

      {/* Overlay UI */}
      {isStarted && (
        <>
            <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl text-white max-w-sm shadow-xl pointer-events-none">
                <h1 className="text-xl font-bold mb-2 tracking-tight">Immersive Forest</h1>
                <p className="text-xs text-gray-300 mb-4 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/> 
                   Interactive Mode Active
                </p>
                
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-300">
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded">
                    <Move size={14} className="text-green-400" /> <span><b>WASD</b> to Walk</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded">
                    <Eye size={14} className="text-blue-400" /> <span><b>Mouse</b> to Look</span>
                </div>
                </div>
            </div>

            {/* Gesture Feedback UI */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
                <div className={`flex items-center gap-3 p-3 rounded-xl backdrop-blur-md transition-all border w-64 ${gesture === 'fist' ? 'bg-amber-500/20 border-amber-500' : 'bg-black/60 border-white/10'}`}>
                    <Wind className={gesture === 'fist' ? 'text-amber-500 animate-pulse' : 'text-gray-500'} />
                    <div className="flex-1">
                        <div className="flex justify-between mb-1">
                             <p className={`text-sm font-bold ${gesture === 'fist' ? 'text-white' : 'text-gray-400'}`}>Wind Force</p>
                             <span className="text-xs font-mono text-gray-400">FIST</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-amber-500 transition-all duration-200" 
                                style={{ width: gesture === 'fist' ? `${Math.min(intensity * 100, 100)}%` : '0%' }}
                            />
                        </div>
                    </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-xl backdrop-blur-md transition-all border w-64 ${gesture === 'open' ? 'bg-blue-500/20 border-blue-500' : 'bg-black/60 border-white/10'}`}>
                    <Volume2 className={gesture === 'open' ? 'text-blue-500 animate-bounce' : 'text-gray-500'} />
                    <div className="flex-1">
                        <div className="flex justify-between">
                            <p className={`text-sm font-bold ${gesture === 'open' ? 'text-white' : 'text-gray-400'}`}>Bird Calls</p>
                            <span className="text-xs font-mono text-gray-400">OPEN HAND</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{gesture === 'open' ? 'Singing...' : 'Hold open to trigger'}</p>
                    </div>
                </div>
            </div>

            {/* Season Selector */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-3 bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl">
                <span className="text-white text-[10px] font-bold uppercase text-center tracking-widest text-gray-400">Season</span>
                <div className="flex flex-col gap-2">
                {seasons.map((s) => (
                    <button
                    key={s.id}
                    onClick={() => setSeason(s.id)}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border-2 group ${
                        season === s.id ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: s.color }}
                    title={s.label}
                    >
                    {season === s.id && (
                        <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-20" />
                    )}
                    </button>
                ))}
                </div>
            </div>

            {/* Hand Tracking Module */}
            <GestureHandler 
                active={isStarted} 
                onGestureChange={handleGestureChange} 
            />
        </>
      )}
    </div>
  );
}
