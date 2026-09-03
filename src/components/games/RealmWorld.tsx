import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Users,
  Target,
  AlertTriangle,
  Heart,
  Flame,
  Shield,
  ChevronRight,
  RotateCcw,
  Zap,
  Sun,
  Moon,
  Sunset,
  Volume2,
  VolumeX,
  Compass,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppSettings, DisasterRecord, FamilyMember, FinancialGoal } from '../../core/types';
import { getEraInfo } from '../../core/gamificationEngine';
import { FamilyModal } from './FamilyModal';
import { GoalsModal } from './GoalsModal';
import { formatCurrency } from '../../core/accounting';

interface RealmWorldProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  currencySymbol: string;
}

interface InhabitantState {
  id: string;
  name: string;
  role: string;
  x: number; // 5% to 90%
  targetX: number;
  facing: 'left' | 'right';
  action: 'walking' | 'idle' | 'working' | 'panicking';
  idleTime: number;
  color: string;
}

// Built-in Synthesizer Sound FX using Web Audio API (Zero external assets needed!)
class SoundFX {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext | null {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  static playChime(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.08, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.45);
    });
  }

  static playDisaster(type: string, enabled: boolean) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'earthquake') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(35, now + 1.2);
    } else if (type === 'tornado') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.8);
      osc.frequency.linearRampToValueAtTime(90, now + 1.8);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(40, now + 1.5);
    }

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.9);
  }
}

export const RealmWorld: React.FC<RealmWorldProps> = ({
  settings,
  onUpdateSettings,
  currencySymbol,
}) => {
  const xp = settings.gamification?.xp || 200;
  const currentEra = settings.realmState?.era || 1;
  const health = settings.realmState?.health ?? 100;
  const activeDisaster = settings.realmState?.lastActiveDisaster || null;

  // Selected Era for simulation / viewing
  const [era, setEra] = useState<number>(currentEra);
  const eraInfo = getEraInfo(era);

  // Lighting / Atmosphere
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('sunset');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<FamilyMember | null>(null);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [activeWonderInfo, setActiveWonderInfo] = useState(false);

  // Family Inhabitants
  const family = settings.family || [
    { id: 'fam-1', name: 'Alex', role: 'father', avatarColor: '#3b82f6' },
    { id: 'fam-2', name: 'Elena', role: 'mother', avatarColor: '#ec4899' },
    { id: 'fam-3', name: 'Leo', role: 'son', avatarColor: '#10b981' },
    { id: 'fam-4', name: 'Maya', role: 'daughter', avatarColor: '#a855f7' },
    { id: 'fam-5', name: 'Barkley', role: 'pet_dog', avatarColor: '#f59e0b' },
  ];

  const goals = settings.goals || [];
  const primaryGoal = goals.find((g) => !g.isCompleted) || goals[0] || null;

  // Autonomous Inhabitant Simulation Loop
  const [inhabitants, setInhabitants] = useState<Record<string, InhabitantState>>(() => {
    const init: Record<string, InhabitantState> = {};
    family.forEach((m, i) => {
      const startX = 14 + (i * 15);
      init[m.id] = {
        id: m.id,
        name: m.name,
        role: m.role,
        x: startX,
        targetX: startX,
        facing: i % 2 === 0 ? 'right' : 'left',
        action: 'idle',
        idleTime: 10 + i * 8,
        color: m.avatarColor || '#3b82f6',
      };
    });
    return init;
  });

  // Keep family in sync
  useEffect(() => {
    setInhabitants((prev) => {
      const next = { ...prev };
      family.forEach((m, idx) => {
        if (!next[m.id]) {
          const xPos = 16 + (idx * 14);
          next[m.id] = {
            id: m.id,
            name: m.name,
            role: m.role,
            x: xPos,
            targetX: xPos,
            facing: 'right',
            action: 'idle',
            idleTime: 15,
            color: m.avatarColor || '#3b82f6',
          };
        }
      });
      return next;
    });
  }, [family]);

  // Main 60fps Movement Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setInhabitants((prev) => {
        const next = { ...prev };
        const isDisaster = Boolean(activeDisaster);
        const speed = isDisaster ? 0.75 : 0.28;

        Object.keys(next).forEach((id) => {
          const p = { ...next[id] };

          if (p.action === 'walking' || (isDisaster && p.action !== 'panicking')) {
            const dist = p.targetX - p.x;
            const step = Math.sign(dist) * Math.min(Math.abs(dist), speed);
            p.x += step;
            p.facing = step > 0 ? 'right' : 'left';

            if (Math.abs(p.targetX - p.x) < 0.3) {
              p.x = p.targetX;
              p.action = isDisaster ? 'panicking' : Math.random() > 0.4 ? 'working' : 'idle';
              p.idleTime = isDisaster ? 8 : Math.floor(Math.random() * 40) + 20;
            }
          } else {
            // Idle or working countdown
            if (p.idleTime > 0) {
              p.idleTime--;
            } else {
              const newDest = isDisaster
                ? Math.random() > 0.5 ? 10 + Math.random() * 20 : 65 + Math.random() * 20
                : 12 + Math.random() * 72;
              p.targetX = newDest;
              p.action = 'walking';
              p.facing = newDest > p.x ? 'right' : 'left';
            }
          }
          next[id] = p;
        });

        return next;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [activeDisaster]);

  // Handle character interaction
  const handlePersonClick = (p: InhabitantState) => {
    const quotes = activeDisaster
      ? [
          `"A ${activeDisaster.type.toUpperCase()} hit us! Quick, retreat to safety!"`,
          `"Hold on! Our savings will help us rebuild!"`,
          `"Avoid impulsive splurges! It triggers nature's wrath!"`,
        ]
      : [
          `"Our ${eraInfo.name} is flourishing thanks to steady daily budgets!"`,
          `"Look how much life has gathered around our town!"`,
          `"I love living in this era! Our goal monument is growing!"`,
          `"Every dollar saved builds our future family legacy!"`,
        ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    setSelectedPerson(family.find((m) => m.id === p.id) || null);
    setSpeechMessage(quote);
    SoundFX.playChime(soundEnabled);

    setTimeout(() => {
      setSpeechMessage(null);
      setSelectedPerson(null);
    }, 4500);
  };

  // Disasters
  const triggerDisaster = (type: 'tornado' | 'earthquake' | 'tsunami' | 'meteor') => {
    SoundFX.playDisaster(type, soundEnabled);
    const titles: Record<string, string> = {
      tornado: '🌪️ Catastrophic Super-Cell Tornado',
      earthquake: '⚡ 7.9 Magnitude Tectonic Rift',
      tsunami: '🌊 Great Ocean Storm Surge',
      meteor: '☄️ Hyper-Velocity Meteor Detonation',
    };
    const descs: Record<string, string> = {
      tornado: '180 MPH vortex tears through the city! Roofs, trees, and street fixtures are airborne!',
      earthquake: 'A massive seismic fault cracks the foundations! Buildings sway and structural beams buckle!',
      tsunami: 'A giant wall of surging water floods the lower district and sweeps across roadways!',
      meteor: 'A blazing asteroid detonates with a fiery shockwave, igniting ground fires and dust!',
    };

    const dis: DisasterRecord = {
      id: 'dis-' + Date.now(),
      type,
      title: titles[type],
      description: descs[type],
      date: new Date().toISOString().split('T')[0],
      expenseAmount: 300,
      xpLost: 60,
      damagePercent: 40,
    };

    onUpdateSettings({
      ...settings,
      gamification: {
        ...settings.gamification!,
        xp: Math.max(0, xp - 60),
      },
      realmState: {
        era,
        health: Math.max(15, health - 40),
        lastActiveDisaster: dis,
      },
      disasters: [dis, ...(settings.disasters || [])],
    });
  };

  const handleHeal = () => {
    SoundFX.playChime(soundEnabled);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    onUpdateSettings({
      ...settings,
      realmState: {
        era,
        health: 100,
        lastActiveDisaster: null,
      },
    });
  };

  const handleSelectEra = (num: number) => {
    setEra(num);
    SoundFX.playChime(soundEnabled);
    onUpdateSettings({
      ...settings,
      realmState: {
        era: num,
        health: settings.realmState?.health ?? 100,
        lastActiveDisaster: settings.realmState?.lastActiveDisaster || null,
      },
    });
  };

  // Era Specific Color Themes & Background Gradients
  const getSkyStyle = () => {
    if (activeDisaster?.type === 'tornado') {
      return 'linear-gradient(180deg, #1f2937 0%, #111827 50%, #030712 100%)';
    }
    if (era === 6) {
      // Space Age Deep Cosmos
      return 'radial-gradient(circle at 70% 30%, #1e1b4b 0%, #0f172a 40%, #020617 100%)';
    }
    if (era === 5) {
      // Cyberpunk Twilight
      return timeOfDay === 'night'
        ? 'linear-gradient(180deg, #1e0533 0%, #2e0854 45%, #0d001a 100%)'
        : 'linear-gradient(180deg, #2e0854 0%, #4a044e 50%, #1e0533 100%)';
    }

    if (timeOfDay === 'sunset') {
      return 'linear-gradient(180deg, #1e1b4b 0%, #4c1d95 30%, #be185d 60%, #ea580c 85%, #fde047 100%)';
    }
    if (timeOfDay === 'night') {
      return 'linear-gradient(180deg, #030712 0%, #0f172a 50%, #1e293b 100%)';
    }
    // Day
    return era === 1
      ? 'linear-gradient(180deg, #1e3a5f 0%, #3b82f6 40%, #93c5fd 80%, #dbeafe 100%)'
      : era === 2
      ? 'linear-gradient(180deg, #0284c7 0%, #38bdf8 50%, #bae6fd 100%)'
      : era === 3
      ? 'linear-gradient(180deg, #1e40af 0%, #3b82f6 50%, #93c5fd 100%)'
      : 'linear-gradient(180deg, #0369a1 0%, #0ea5e9 60%, #e0f2fe 100%)';
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Realm Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 text-2xl font-bold">
            {era === 1 ? '🔥' : era === 2 ? '🌾' : era === 3 ? '🏰' : era === 4 ? '🏙️' : era === 5 ? '🔮' : '🚀'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {eraInfo.name}
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-mono shadow-sm">
                ERA {era} OF 6
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{eraInfo.period} • {eraInfo.theme}</p>
          </div>
        </div>

        {/* Environment Toggles: Time of Day, Sound, Health, XP */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time of Day Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTimeOfDay('day')}
              className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'day' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Daylight"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('sunset')}
              className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'sunset' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Golden Sunset"
            >
              <Sunset className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('night')}
              className={`p-1.5 rounded-lg text-xs transition-all ${timeOfDay === 'night' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Starry Night"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-all ${soundEnabled ? 'bg-indigo-600/30 border-indigo-500/40 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
            title="Audio Atmosphere"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Health & XP */}
          <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span className="font-mono font-bold text-slate-200">{health}%</span>
            </div>
            <div className="w-px h-3 bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-bold text-amber-300">{xp} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Disaster Alert Banner */}
      {activeDisaster && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-100 shadow-2xl animate-pulse backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">
              {activeDisaster.type === 'tornado' ? '🌪️' : activeDisaster.type === 'earthquake' ? '⚡' : activeDisaster.type === 'tsunami' ? '🌊' : '☄️'}
            </span>
            <div>
              <p className="font-bold text-sm text-white">{activeDisaster.title}</p>
              <p className="text-rose-200 mt-0.5">{activeDisaster.description}</p>
            </div>
          </div>
          <button
            onClick={handleHeal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
          >
            Restore Realm & Clear Damage ✨
          </button>
        </div>
      )}

      {/* ================= LIVING CANVAS DIORAMA WORLD ================= */}
      <div
        className={`relative w-full h-[480px] rounded-3xl overflow-hidden border-2 shadow-2xl select-none transition-all duration-700 ${
          activeDisaster?.type === 'earthquake' ? 'animate-mc-earthquake border-rose-500' : 'border-slate-800'
        }`}
        style={{ background: getSkyStyle() }}
      >
        {/* ================= SKY & CELESTIAL LAYERS ================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Celestial Sun / Moon / Planetary Rings */}
          {era === 6 ? (
            /* Majestic Space Planet with Luminous Gas Rings */
            <div className="absolute top-10 right-20 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-indigo-900 via-purple-700 to-cyan-400 shadow-2xl shadow-cyan-500/50 border-2 border-cyan-300/60" />
              <div className="absolute w-56 h-12 border-4 border-cyan-300/40 rounded-full transform -rotate-30 shadow-lg shadow-cyan-400/30" />
            </div>
          ) : timeOfDay === 'night' || era === 1 ? (
            /* Crescent / Glowing Full Moon with Aurora Glow */
            <div className="absolute top-10 right-20">
              <div className="w-20 h-20 rounded-full bg-amber-100/90 shadow-2xl shadow-amber-200/40 blur-[0.5px]" />
              <div className="absolute -top-4 -left-10 w-40 h-8 bg-gradient-to-r from-emerald-400/20 via-cyan-400/30 to-purple-500/20 blur-xl animate-pulse" />
            </div>
          ) : (
            /* Radiant Golden Sun */
            <div className="absolute top-10 right-20 w-24 h-24 rounded-full bg-gradient-to-tr from-yellow-400 to-amber-200 shadow-2xl shadow-yellow-300/60 blur-[1px]" />
          )}

          {/* Twinkling Stars in Night / Space */}
          {(timeOfDay === 'night' || era === 6) && (
            <>
              <div className="absolute top-6 left-12 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              <div className="absolute top-20 left-1/3 w-1 h-1 bg-cyan-200 rounded-full animate-pulse" />
              <div className="absolute top-12 right-1/3 w-2 h-2 bg-amber-200 rounded-full animate-pulse" />
              <div className="absolute top-28 right-16 w-1.5 h-1.5 bg-purple-300 rounded-full animate-ping" />
              <div className="absolute top-36 left-24 w-1 h-1 bg-white rounded-full opacity-60" />
            </>
          )}

          {/* Atmospheric Birds / Drones / Ships soaring across the sky */}
          <div className="absolute top-16 animate-mc-cloud opacity-80 flex items-center gap-8">
            {era <= 3 ? (
              <span className="text-xl opacity-70">🦅</span>
            ) : era === 4 ? (
              <span className="text-xl opacity-70">✈️</span>
            ) : era === 5 ? (
              <span className="text-xl text-cyan-300 animate-pulse">🛸</span>
            ) : (
              <span className="text-2xl text-cyan-300 animate-pulse">🚀</span>
            )}
          </div>
        </div>

        {/* ================= MOUNTAIN & BACKGROUND SILHOUETTES ================= */}
        <div className="absolute bottom-36 inset-x-0 h-48 pointer-events-none opacity-50 flex items-end justify-between">
          {era === 1 ? (
            /* Primeval Mountain Ranges */
            <div className="w-full flex justify-between">
              <div className="w-72 h-44 bg-slate-900/60 rounded-t-[100px] blur-sm transform -translate-x-12" />
              <div className="w-96 h-56 bg-slate-900/80 rounded-t-[140px] blur-sm" />
              <div className="w-64 h-40 bg-slate-900/60 rounded-t-[90px] blur-sm" />
            </div>
          ) : era === 2 || era === 3 ? (
            /* Rolling Alpine Hills & Pines */
            <div className="w-full flex justify-between">
              <div className="w-80 h-40 bg-emerald-950/60 rounded-t-full transform -translate-x-10" />
              <div className="w-96 h-52 bg-emerald-950/70 rounded-t-full" />
              <div className="w-72 h-44 bg-emerald-950/60 rounded-t-full" />
            </div>
          ) : era === 4 ? (
            /* City Skyline Silhouette */
            <div className="w-full flex items-end justify-around px-8">
              <div className="w-16 h-36 bg-slate-800/80 border-t-2 border-slate-700" />
              <div className="w-24 h-48 bg-slate-900/90 border-t-2 border-slate-700" />
              <div className="w-20 h-40 bg-slate-800/80 border-t-2 border-slate-700" />
              <div className="w-28 h-56 bg-slate-900/90 border-t-2 border-slate-700" />
              <div className="w-16 h-32 bg-slate-800/80 border-t-2 border-slate-700" />
            </div>
          ) : era === 5 ? (
            /* Cyberpunk Megatowers with Neon Spire Glows */
            <div className="w-full flex items-end justify-around px-6">
              <div className="w-20 h-52 bg-purple-950/90 border-t-2 border-cyan-400 shadow-lg shadow-cyan-500/20" />
              <div className="w-24 h-64 bg-indigo-950/90 border-t-2 border-pink-500 shadow-lg shadow-pink-500/20" />
              <div className="w-28 h-56 bg-purple-950/90 border-t-2 border-cyan-400 shadow-lg shadow-cyan-500/20" />
            </div>
          ) : (
            /* Orbital Biosphere Ring Arcs */
            <div className="w-full h-40 border-t-4 border-cyan-400/40 rounded-t-[200px] bg-slate-950/60 backdrop-blur-sm" />
          )}
        </div>

        {/* ================= CENTRAL ERA CIVILIZATION HABITAT ================= */}
        <div className="absolute bottom-28 left-8 sm:left-14 pointer-events-auto z-10">
          {/* ================= ERA 1: DAWN OF HUMANITY ================= */}
          {era === 1 && (
            <div className="flex items-end gap-10">
              {/* Cozy Cave with Ancient Paintings */}
              <div className="relative group">
                <div className="w-56 h-40 bg-gradient-to-t from-stone-900 to-stone-800 rounded-t-full border-4 border-stone-700 shadow-2xl flex items-end justify-center p-4">
                  {/* Cave Hearth Opening */}
                  <div className="w-32 h-28 bg-stone-950 rounded-t-full border-t-4 border-stone-900 flex flex-col items-center justify-center relative">
                    <span className="text-xl animate-pulse">🔥</span>
                    <span className="text-[10px] text-amber-200/60 font-mono mt-1">Primeval Hearth</span>
                  </div>
                </div>
                {/* Prehistoric Torch & Spears */}
                <div className="absolute -top-3 left-4 text-lg">🏹</div>
                <div className="absolute -top-3 right-4 text-lg animate-pulse">🏮</div>
              </div>

              {/* Roaring Primal Campfire with Embers */}
              <div className="flex flex-col items-center">
                <div className="relative flex flex-col items-center">
                  <div className="w-5 h-5 bg-amber-400 rounded-full blur-sm animate-ping" />
                  <div className="w-10 h-10 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-300 rounded-full blur-[1px] animate-bounce -mt-4 shadow-lg shadow-orange-500" />
                  <div className="w-14 h-4 bg-stone-800 rounded-full border border-stone-600 mt-1 flex justify-around">
                    <div className="w-2 h-2 bg-amber-800 rounded-full" />
                    <div className="w-2 h-2 bg-amber-800 rounded-full" />
                  </div>
                </div>
                <span className="text-[11px] text-amber-300 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Sacred Campfire
                </span>
              </div>
            </div>
          )}

          {/* ================= ERA 2: AGRARIAN PIONEER VALLEY ================= */}
          {era === 2 && (
            <div className="flex items-end gap-8">
              {/* Pioneer Homestead Manor */}
              <div className="relative w-56 h-44 bg-gradient-to-b from-amber-800 to-amber-950 rounded-2xl border-4 border-amber-950 shadow-2xl p-4 flex flex-col justify-between">
                {/* Gabled Timber Roof */}
                <div className="absolute -top-10 inset-x-0 h-12 bg-amber-950 rounded-t-2xl border-b-4 border-amber-900 flex items-center justify-around">
                  <div className="w-4 h-4 bg-amber-800 rounded-full" />
                  <div className="w-4 h-4 bg-amber-800 rounded-full" />
                </div>
                {/* Smoke Chimney */}
                <div className="absolute -top-14 right-6 w-6 h-14 bg-stone-700 rounded-t-lg border-2 border-stone-800 flex flex-col items-center">
                  <div className="w-4 h-4 bg-slate-300/80 rounded-full animate-mc-smoke-1 -mt-4" />
                </div>
                {/* Glowing Lantern Windows */}
                <div className="flex justify-between items-end h-full pt-4">
                  <div className="w-10 h-10 bg-amber-300/90 rounded-lg border-2 border-amber-500 shadow-lg shadow-amber-300/40 flex items-center justify-center text-xs">
                    🪟
                  </div>
                  <div className="w-10 h-20 bg-amber-950 rounded-t-lg border-2 border-amber-800 flex items-center justify-center text-sm">
                    🚪
                  </div>
                  <div className="w-10 h-10 bg-amber-300/90 rounded-lg border-2 border-amber-500 shadow-lg shadow-amber-300/40 flex items-center justify-center text-xs">
                    🪟
                  </div>
                </div>
              </div>

              {/* Water Well & Grain Mill */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-28 bg-stone-600 rounded-t-2xl border-4 border-stone-800 flex items-center justify-center relative">
                  <div className="w-20 h-20 border-4 border-amber-300/80 rounded-full animate-spin duration-1000 border-dashed" />
                </div>
                <span className="text-[11px] text-emerald-300 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Flour Mill
                </span>
              </div>
            </div>
          )}

          {/* ================= ERA 3: MEDIEVAL GRAND CITADEL ================= */}
          {era === 3 && (
            <div className="flex items-end gap-8">
              {/* Grand Stone Citadel Castle */}
              <div className="relative w-64 h-48 bg-gradient-to-b from-slate-600 to-slate-800 rounded-t-3xl border-4 border-slate-900 shadow-2xl p-4 flex flex-col justify-between">
                {/* Royal Banners & Battlements */}
                <div className="absolute -top-7 inset-x-0 flex justify-between px-2">
                  <div className="w-10 h-8 bg-slate-800 rounded-t-lg border-2 border-slate-900 flex items-center justify-center text-xs">
                    🚩
                  </div>
                  <div className="w-10 h-8 bg-slate-800 rounded-t-lg border-2 border-slate-900" />
                  <div className="w-10 h-8 bg-slate-800 rounded-t-lg border-2 border-slate-900 flex items-center justify-center text-xs">
                    🚩
                  </div>
                </div>
                {/* Grand Arched Gate & Stained Glass */}
                <div className="flex justify-around items-center pt-3">
                  <div className="w-10 h-14 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t-full border-2 border-amber-400 shadow-md" />
                  <div className="w-12 h-16 bg-gradient-to-t from-amber-500 to-rose-400 rounded-t-full border-2 border-amber-400 shadow-md" />
                </div>
                <div className="w-16 h-22 bg-slate-950 rounded-t-full border-4 border-amber-900 self-center flex items-center justify-center text-amber-500">
                  🛡️
                </div>
              </div>

              {/* Blacksmith Forge */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-20 bg-stone-700 rounded-t-xl border-4 border-stone-900 flex flex-col items-center justify-center">
                  <span className="text-xl animate-bounce">⚒️</span>
                </div>
                <span className="text-[11px] text-amber-400 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Royal Forge
                </span>
              </div>
            </div>
          )}

          {/* ================= ERA 4: MODERN SMART METROPOLIS ================= */}
          {era === 4 && (
            <div className="flex items-end gap-8">
              {/* Glass & Eco-Concrete Villa */}
              <div className="relative w-64 h-48 bg-gradient-to-b from-slate-100 to-slate-300 rounded-2xl border-4 border-slate-500 shadow-2xl p-4 flex flex-col justify-between">
                {/* Rooftop Solar Grid */}
                <div className="absolute -top-7 inset-x-2 h-7 bg-cyan-900 rounded-t-lg border-2 border-cyan-400 flex items-center justify-around px-2">
                  <div className="w-10 h-3 bg-cyan-400/40 rounded" />
                  <div className="w-10 h-3 bg-cyan-400/40 rounded" />
                  <div className="w-10 h-3 bg-cyan-400/40 rounded" />
                </div>
                {/* Modern Floor-to-Ceiling Windows */}
                <div className="flex justify-between items-center h-full pt-4">
                  <div className="w-24 h-24 bg-cyan-100/90 rounded-xl border-2 border-cyan-400 shadow-inner flex flex-col justify-between p-1.5">
                    <span className="text-xs">🛋️</span>
                    <span className="text-[9px] text-cyan-900 font-bold">LIVING SUITE</span>
                  </div>
                  <div className="w-24 h-24 bg-sky-100/90 rounded-xl border-2 border-sky-400 shadow-inner flex flex-col justify-between p-1.5">
                    <span className="text-xs">💻</span>
                    <span className="text-[9px] text-sky-900 font-bold">OFFICE HUB</span>
                  </div>
                </div>
              </div>

              {/* Electric Autonomous Vehicle Station */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-16 bg-slate-800 rounded-2xl border-2 border-emerald-400 p-1.5 flex flex-col justify-between items-center shadow-lg">
                  <span className="text-2xl animate-pulse">⚡🚗</span>
                  <span className="text-[9px] font-bold text-emerald-400">EV CHARGED</span>
                </div>
                <span className="text-[11px] text-cyan-300 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Smart Station
                </span>
              </div>
            </div>
          )}

          {/* ================= ERA 5: CYBERPUNK SKY-CITY UTOPIA ================= */}
          {era === 5 && (
            <div className="flex items-end gap-8">
              {/* Neon Cyber Tower */}
              <div className="relative w-60 h-54 bg-gradient-to-t from-purple-950 via-indigo-950 to-slate-900 rounded-3xl border-4 border-cyan-400 shadow-2xl shadow-cyan-500/40 p-4 flex flex-col justify-between">
                <div className="w-full py-1 bg-cyan-400/30 border border-cyan-300 rounded-lg flex items-center justify-center text-[10px] font-mono text-cyan-200 tracking-widest animate-pulse">
                  NEO-LEDGER NEXUS
                </div>
                <div className="flex justify-around items-center">
                  <div className="w-12 h-16 bg-pink-500/30 rounded-xl border border-pink-400 flex items-center justify-center text-xl shadow-lg shadow-pink-500/30">
                    🧬
                  </div>
                  <div className="w-12 h-16 bg-cyan-500/30 rounded-xl border border-cyan-400 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/30">
                    🌐
                  </div>
                </div>
                <div className="w-full h-8 bg-purple-900/60 rounded-xl border border-purple-400 flex items-center justify-center text-xs text-purple-200 font-mono">
                  QUANTUM CORE: ACTIVE
                </div>
              </div>

              {/* Bio-Luminesce Hydroponic Dome */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-28 bg-gradient-to-tr from-emerald-500/30 to-cyan-400/40 rounded-t-full border-4 border-emerald-400 shadow-2xl shadow-emerald-400/40 flex items-end justify-center pb-3">
                  <span className="text-3xl animate-bounce">🌺</span>
                </div>
                <span className="text-[11px] text-pink-300 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-pink-500/30">
                  Bio-Sphere
                </span>
              </div>
            </div>
          )}

          {/* ================= ERA 6: CELESTIAL SPACE COLONY ================= */}
          {era === 6 && (
            <div className="flex items-end gap-8">
              {/* Interstellar Colony Citadel */}
              <div className="relative w-64 h-52 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 rounded-3xl border-4 border-cyan-300 shadow-2xl shadow-cyan-400/50 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <div className="px-3 py-1 bg-cyan-400/20 rounded-full border border-cyan-300 text-[10px] font-mono text-cyan-200">
                    DOCKING BAY ALPHA
                  </div>
                  <div className="w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div className="flex justify-around items-center">
                  <div className="w-16 h-16 rounded-full bg-cyan-400/20 border-2 border-cyan-300 flex items-center justify-center text-2xl shadow-lg">
                    🌍
                  </div>
                  <div className="w-16 h-16 rounded-full bg-purple-400/20 border-2 border-purple-300 flex items-center justify-center text-2xl shadow-lg">
                    🌌
                  </div>
                </div>
                <div className="w-full py-1 bg-indigo-900/50 rounded-xl border border-indigo-400 text-center text-[10px] font-mono text-indigo-200">
                  LIFE SUPPORT: 100% NOMINAL
                </div>
              </div>

              {/* Starship Explorer */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-24 bg-gradient-to-t from-slate-100 to-slate-300 rounded-t-full border-4 border-cyan-400 flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-3xl">🚀</span>
                  <div className="w-6 h-2 bg-orange-500 rounded-full animate-pulse mt-1" />
                </div>
                <span className="text-[11px] text-cyan-300 font-bold mt-1 bg-black/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Stellar Explorer
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ================= GOAL MONUMENT WONDER ================= */}
        {primaryGoal && (
          <div
            onClick={() => setIsGoalsModalOpen(true)}
            className="absolute bottom-28 right-8 sm:right-14 cursor-pointer group pointer-events-auto transition-transform hover:scale-105 z-10"
          >
            <div className="bg-slate-900/90 backdrop-blur-md border-2 border-amber-400 rounded-3xl p-4 shadow-2xl space-y-2 w-48 text-center">
              <div className="text-3xl animate-bounce">
                {primaryGoal.monumentType === 'wonder_pyramid'
                  ? '🔺'
                  : primaryGoal.monumentType === 'town_hall'
                  ? '🏛️'
                  : primaryGoal.monumentType === 'castle_keep'
                  ? '🏰'
                  : primaryGoal.monumentType === 'solar_observatory'
                  ? '🔭'
                  : '🚀'}
              </div>
              <div>
                <p className="text-xs font-bold text-white truncate">{primaryGoal.title}</p>
                <p className="text-[10px] text-amber-300 font-mono">
                  {formatCurrency(primaryGoal.currentAmount, currencySymbol)} / {formatCurrency(primaryGoal.targetAmount, currencySymbol)}
                </p>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100)
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-300 font-bold">
                {Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100)}% Constructed
              </span>
            </div>
          </div>
        )}

        {/* ================= GROUND TERRAIN ================= */}
        <div
          className="absolute bottom-0 inset-x-0 h-28 pointer-events-none transition-colors duration-700"
          style={{
            backgroundColor:
              era === 1
                ? '#22160d'
                : era === 2
                ? '#1e381f'
                : era === 3
                ? '#2c3e50'
                : era === 4
                ? '#1e293b'
                : era === 5
                ? '#110524'
                : '#0b0f19',
            borderTop: `4px solid ${
              era === 1 ? '#452b18' : era === 2 ? '#3b7a3e' : era === 3 ? '#475569' : era === 4 ? '#0284c7' : '#d946ef'
            }`,
          }}
        >
          {/* Ground Path / Road */}
          <div className="w-full h-8 bg-black/20 flex items-center justify-around">
            {era === 4 && <div className="w-full border-t-2 border-dashed border-amber-400/60" />}
            {era === 5 && <div className="w-full border-t-2 border-cyan-400/80 shadow-lg shadow-cyan-400" />}
          </div>
        </div>

        {/* ================= CHARACTERS LIVING & WALKING ACROSS REALM ================= */}
        <div className="absolute bottom-16 inset-x-0 h-20 pointer-events-none z-20">
          {Object.values(inhabitants).map((p) => {
            const isSpeaking = selectedPerson?.id === p.id;
            const isDisaster = Boolean(activeDisaster);
            const isPet = p.role.includes('pet');

            return (
              <div
                key={p.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePersonClick(p);
                }}
                className={`absolute cursor-pointer pointer-events-auto transition-transform ${
                  isDisaster ? 'mc-panicking' : p.action === 'walking' ? 'mc-walking' : ''
                }`}
                style={{
                  left: `${p.x}%`,
                  transform: `scaleX(${p.facing === 'left' ? -1 : 1})`,
                }}
              >
                {/* Speech Bubble */}
                {isSpeaking && speechMessage && (
                  <div
                    className="absolute -top-20 left-1/2 -translate-x-1/2 bg-slate-900/95 border-2 border-indigo-400 text-white text-xs font-semibold px-3 py-2 rounded-2xl shadow-2xl whitespace-nowrap z-30 animate-fade-in"
                    style={{ transform: `scaleX(${p.facing === 'left' ? -1 : 1})` }}
                  >
                    {speechMessage}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r-2 border-b-2 border-indigo-400 transform rotate-45" />
                  </div>
                )}

                {/* Panic Alert emote during disaster */}
                {isDisaster && !isSpeaking && (
                  <div
                    className="absolute -top-10 left-1/2 -translate-x-1/2 text-base font-bold text-red-500 animate-bounce"
                    style={{ transform: `scaleX(${p.facing === 'left' ? -1 : 1})` }}
                  >
                    ❗😱
                  </div>
                )}

                {/* Character Figure */}
                {!isPet ? (
                  /* Human Figure with animated joints */
                  <div className="flex flex-col items-center group">
                    {/* Head */}
                    <div
                      className="mc-head w-8 h-8 rounded-full border-2 border-slate-900 shadow-md flex items-center justify-center text-sm"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.role === 'mother' ? '👩' : p.role === 'daughter' ? '👧' : p.role === 'son' ? '👦' : p.role === 'grandparent' ? '🧓' : '👨'}
                    </div>

                    {/* Torso */}
                    <div
                      className="w-5 h-7 rounded-lg border-2 border-slate-900 -mt-1 shadow"
                      style={{ backgroundColor: p.color }}
                    />

                    {/* Legs */}
                    <div className="flex gap-0.5">
                      <div className="mc-leg-left w-2 h-7 bg-slate-800 rounded-b border border-slate-900" />
                      <div className="mc-leg-right w-2 h-7 bg-slate-800 rounded-b border border-slate-900" />
                    </div>

                    {/* Name Pill */}
                    <span
                      className="text-[10px] font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-700 shadow mt-1 whitespace-nowrap"
                      style={{ transform: `scaleX(${p.facing === 'left' ? -1 : 1})` }}
                    >
                      {p.name}
                    </span>
                  </div>
                ) : (
                  /* Pet Companion (Dog/Cat) */
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-0.5">
                      <div className="mc-dog-tail text-xs">🐕</div>
                    </div>
                    <span
                      className="text-[9px] font-bold text-amber-300 bg-slate-900/90 px-1.5 py-0.2 rounded-full border border-amber-500/40 shadow mt-0.5 whitespace-nowrap"
                      style={{ transform: `scaleX(${p.facing === 'left' ? -1 : 1})` }}
                    >
                      {p.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ================= CINEMATIC DISASTER EFFECTS ================= */}
        {activeDisaster && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {/* TORNADO: High-Velocity Funnel with Flying Debris */}
            {activeDisaster.type === 'tornado' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative flex flex-col items-center animate-mc-tornado">
                  <div className="w-80 h-16 bg-slate-500/80 rounded-full blur-sm" />
                  <div className="w-64 h-20 bg-slate-600/80 rounded-full blur-sm -mt-4" />
                  <div className="w-48 h-24 bg-slate-700/85 rounded-full blur-sm -mt-4" />
                  <div className="w-32 h-28 bg-slate-800/90 rounded-full blur-sm -mt-4" />
                  <div className="w-16 h-28 bg-slate-950 rounded-full blur-sm -mt-4" />
                </div>
                {/* Debris Orbiting */}
                <div className="absolute text-3xl animate-mc-debris-1">🪵</div>
                <div className="absolute text-3xl animate-mc-debris-2">🏠</div>
                <div className="absolute text-2xl animate-mc-debris-3">💨</div>
                <div className="absolute text-2xl animate-mc-debris-1">🪨</div>
              </div>
            )}

            {/* EARTHQUAKE: Massive Fault Line Cracking Ground */}
            {activeDisaster.type === 'earthquake' && (
              <div className="absolute bottom-24 left-1/4 right-1/4 h-16 bg-black border-4 border-red-600/70 rounded-full flex items-center justify-around transform -skew-x-12 shadow-2xl">
                <div className="w-3 h-full bg-red-500 animate-ping" />
                <div className="w-4 h-full bg-orange-500 animate-ping" />
                <div className="w-3 h-full bg-yellow-400 animate-ping" />
              </div>
            )}

            {/* TSUNAMI: Wall of Ocean Water Surging */}
            {activeDisaster.type === 'tsunami' && (
              <div className="absolute bottom-0 inset-x-0 h-44 bg-cyan-600/70 border-t-8 border-cyan-200 animate-mc-tsunami flex items-center justify-around backdrop-blur-sm">
                <div className="text-4xl animate-bounce">🌊</div>
                <div className="text-4xl animate-bounce">🌊</div>
                <div className="text-4xl animate-bounce">🌊</div>
              </div>
            )}

            {/* METEOR: Fireball Streak & Detonation */}
            {activeDisaster.type === 'meteor' && (
              <div className="absolute top-6 right-16 animate-mc-meteor flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-300 shadow-2xl shadow-orange-500 flex items-center justify-center text-4xl animate-spin">
                  ☄️
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= ERA SELECTOR (EXPLORE 6 ERAS) ================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            Explore Civilization Eras (Interactive Simulation)
          </span>
          <span className="text-[11px] text-slate-400">
            Click any era to watch the entire world transform!
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { num: 1, name: '1. Primeval Dawn', icon: '🔥', desc: 'Campfire & Cave' },
            { num: 2, name: '2. Pioneer Valley', icon: '🌾', desc: 'Homestead & Mill' },
            { num: 3, name: '3. Grand Citadel', icon: '🏰', desc: 'Castle & Forge' },
            { num: 4, name: '4. Metropolis', icon: '🏙️', desc: 'Eco-Villa & EV' },
            { num: 5, name: '5. Cyber Utopia', icon: '🔮', desc: 'Neon Sky-Spire' },
            { num: 6, name: '6. Interstellar', icon: '🚀', desc: 'Space Station' },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => handleSelectEra(item.num)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                era === item.num
                  ? 'bg-gradient-to-br from-amber-500 to-rose-600 text-white border-white shadow-xl scale-[1.02]'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <span className="font-bold text-xs truncate">{item.name}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ================= CONTROLS DOCK (FAMILY, GOALS, DISASTERS) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Family Inhabitants Manager */}
        <button
          type="button"
          onClick={() => setIsFamilyModalOpen(true)}
          className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-pink-500/50 flex items-center justify-between text-left transition-all group shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white group-hover:text-pink-300 transition-colors">
                Family Inhabitants
              </h4>
              <p className="text-xs text-slate-400">{family.length} Living & Walking in Realm</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
        </button>

        {/* Goals & Monuments Manager */}
        <button
          type="button"
          onClick={() => setIsGoalsModalOpen(true)}
          className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between text-left transition-all group shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                Wonders & Goals
              </h4>
              <p className="text-xs text-slate-400">{goals.length} Active Monuments</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
        </button>

        {/* Disaster Shock Simulation Dock */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Simulate Disasters:
            </span>
            <span className="text-[10px] text-slate-500">Test Disruptions</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => triggerDisaster('tornado')}
              className="flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 transition-colors shadow"
            >
              🌪️ Tornado
            </button>
            <button
              type="button"
              onClick={() => triggerDisaster('earthquake')}
              className="flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/40 transition-colors shadow"
            >
              ⚡ Quake
            </button>
            <button
              type="button"
              onClick={() => triggerDisaster('tsunami')}
              className="flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 transition-colors shadow"
            >
              🌊 Tsunami
            </button>
            <button
              type="button"
              onClick={() => triggerDisaster('meteor')}
              className="flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 transition-colors shadow"
            >
              ☄️ Meteor
            </button>
            <button
              type="button"
              onClick={handleHeal}
              title="Heal Realm"
              className="py-1.5 px-2.5 text-[11px] font-bold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition-colors shadow"
            >
              Heal
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FamilyModal
        isOpen={isFamilyModalOpen}
        onClose={() => setIsFamilyModalOpen(false)}
        family={family}
        onUpdateFamily={(updated) => onUpdateSettings({ ...settings, family: updated })}
      />

      <GoalsModal
        isOpen={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
        goals={goals}
        onUpdateGoals={(updated) => onUpdateSettings({ ...settings, goals })}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
