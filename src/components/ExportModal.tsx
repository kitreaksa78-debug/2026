import React, { useState } from 'react';
import { X, Sparkles, Sliders, Check } from 'lucide-react';
import { SubtitleStyle } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (style: SubtitleStyle) => void;
  isRendering?: boolean;
}

const DEFAULT_STYLE: SubtitleStyle = {
  font_size: 22,
  text_color: '#FFFFFF',
  outline_color: '#000000',
  outline_width: 2,
  background_color: 'transparent',
  shadow: 1,
  position: 'bottom_center'
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  isRendering
}) => {
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(style);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Subtitle Style & Video Burning</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Font Size */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">
                Font Size ({style.font_size}px)
              </label>
              <input
                type="range"
                min={14}
                max={48}
                value={style.font_size}
                onChange={(e) => setStyle({ ...style, font_size: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Position */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Subtitle Position</label>
              <select
                value={style.position}
                onChange={(e) => setStyle({ ...style, position: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="bottom_center">Bottom Center (Default)</option>
                <option value="top_center">Top Center</option>
                <option value="middle_center">Middle Center</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Text Color */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Text Color</label>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={style.text_color}
                  onChange={(e) => setStyle({ ...style, text_color: e.target.value })}
                  className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-300">{style.text_color}</span>
              </div>
            </div>

            {/* Outline Color */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Outline Color</label>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={style.outline_color}
                  onChange={(e) => setStyle({ ...style, outline_color: e.target.value })}
                  className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-300">{style.outline_color}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Outline Width */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">
                Outline Width ({style.outline_width}px)
              </label>
              <input
                type="range"
                min={0}
                max={6}
                value={style.outline_width}
                onChange={(e) => setStyle({ ...style, outline_width: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Background */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Background Box</label>
              <select
                value={style.background_color}
                onChange={(e) => setStyle({ ...style, background_color: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="transparent">Transparent (None)</option>
                <option value="#00000080">Semi-transparent Black</option>
                <option value="#000000">Solid Black</option>
              </select>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Live Subtitle Preview
            </span>
            <div className="h-20 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-3 relative overflow-hidden">
              <div
                style={{
                  fontSize: `${style.font_size}px`,
                  color: style.text_color,
                  textShadow: `${style.outline_width}px ${style.outline_width}px 0 ${style.outline_color}, -${style.outline_width}px -${style.outline_width}px 0 ${style.outline_color}`,
                  backgroundColor: style.background_color !== 'transparent' ? style.background_color : undefined,
                  padding: style.background_color !== 'transparent' ? '4px 8px' : undefined,
                  borderRadius: '4px'
                }}
                className="font-medium text-center"
              >
                Sample Translated Subtitle Text
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRendering}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRendering ? 'Rendering Video...' : 'Burn Subtitles & Create MP4'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
