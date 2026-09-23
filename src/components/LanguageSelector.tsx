import React from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { LanguageItem } from '../types';

interface LanguageSelectorProps {
  sourceLanguages: LanguageItem[];
  targetLanguages: LanguageItem[];
  selectedSource: string;
  selectedTarget: string;
  onSelectSource: (code: string) => void;
  onSelectTarget: (code: string) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  sourceLanguages,
  targetLanguages,
  selectedSource,
  selectedTarget,
  onSelectSource,
  onSelectTarget,
  disabled
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center space-x-2 text-slate-300 text-sm font-medium">
        <Globe className="w-4 h-4 text-indigo-400" />
        <span>Language Configuration</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Source Language */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Source Language (Audio)
          </label>
          <select
            value={selectedSource}
            onChange={(e) => onSelectSource(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sourceLanguages.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                {lang.name} {lang.native_name && lang.native_name !== lang.name ? `(${lang.native_name})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Whisper can automatically detect spoken language or transcribe in specific language.
          </p>
        </div>

        {/* Target Language */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Target Language (Subtitles)
          </label>
          <select
            value={selectedTarget}
            onChange={(e) => onSelectTarget(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {targetLanguages.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                {lang.name} {lang.native_name && lang.native_name !== lang.name ? `(${lang.native_name})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            LibreTranslate translates Whisper timestamps into this language.
          </p>
        </div>
      </div>
    </div>
  );
};
