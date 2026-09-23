import React from 'react';
import { Languages, Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health: HealthStatus | null;
  onRefreshHealth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">Video Translator</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                faster-whisper
              </span>
            </div>
            <p className="text-xs text-slate-400">AI-powered video subtitle translation</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {health && (
            <div className="hidden sm:flex items-center space-x-3 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <div className="flex items-center space-x-1.5" title="Audio Extraction & Video Rendering">
                <span className={`w-2 h-2 rounded-full ${health.ffmpeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-slate-300 font-mono">FFmpeg</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center space-x-1.5" title="faster-whisper STT Engine">
                <span className={`w-2 h-2 rounded-full ${health.whisper ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-slate-300 font-mono">Whisper</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center space-x-1.5" title="Redis Queue & PubSub">
                <span className={`w-2 h-2 rounded-full ${health.redis ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-slate-300 font-mono">Redis</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
