import React, { useState, useEffect } from 'react';
import {
  Save,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Clock,
  Play,
  Check,
  AlertCircle
} from 'lucide-react';
import { SubtitleItem } from '../types';
import { updateSubtitles } from '../services/api';

interface SubtitleEditorProps {
  jobId: string;
  initialSubtitles: SubtitleItem[];
  currentTime: number;
  onSeek: (time: number) => void;
  onSubtitlesSaved: (updated: SubtitleItem[]) => void;
}

function formatSecondsToTimestamp(sec: number): string {
  if (sec < 0) sec = 0;
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(ts) || 0;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  jobId,
  initialSubtitles,
  currentTime,
  onSeek,
  onSubtitlesSaved
}) => {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(initialSubtitles);
  const [history, setHistory] = useState<SubtitleItem[][]>([initialSubtitles]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubtitles(initialSubtitles);
    setHistory([initialSubtitles]);
    setHistoryIndex(0);
  }, [initialSubtitles]);

  const pushState = (newSubs: SubtitleItem[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newSubs);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setSubtitles(newSubs);
    setSavedSuccess(false);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
      setSavedSuccess(false);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
      setSavedSuccess(false);
    }
  };

  const handleUpdateTranslation = (id: number, newTranslation: string) => {
    const updated = subtitles.map((s) => (s.id === id ? { ...s, translation: newTranslation } : s));
    pushState(updated);
  };

  const handleUpdateTime = (id: number, field: 'start' | 'end', valStr: string) => {
    const val = parseTimestampToSeconds(valStr);
    const updated = subtitles.map((s) => (s.id === id ? { ...s, [field]: val } : s));
    pushState(updated);
  };

  const handleAddSubtitle = (afterId?: number) => {
    let newStart = 0;
    let newEnd = 3;

    if (afterId !== undefined) {
      const refItem = subtitles.find((s) => s.id === afterId);
      if (refItem) {
        newStart = refItem.end + 0.1;
        newEnd = newStart + 2.5;
      }
    } else if (subtitles.length > 0) {
      const last = subtitles[subtitles.length - 1];
      newStart = last.end + 0.1;
      newEnd = newStart + 2.5;
    }

    const newItem: SubtitleItem = {
      id: Date.now(),
      start: round(newStart),
      end: round(newEnd),
      text: 'New segment',
      translation: ''
    };

    let updated: SubtitleItem[] = [];
    if (afterId !== undefined) {
      const idx = subtitles.findIndex((s) => s.id === afterId);
      updated = [...subtitles.slice(0, idx + 1), newItem, ...subtitles.slice(idx + 1)];
    } else {
      updated = [...subtitles, newItem];
    }

    // Re-index
    updated = updated.map((item, idx) => ({ ...item, id: idx + 1 }));
    pushState(updated);
  };

  const handleDeleteSubtitle = (id: number) => {
    const updated = subtitles
      .filter((s) => s.id !== id)
      .map((item, idx) => ({ ...item, id: idx + 1 }));
    pushState(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateSubtitles(jobId, subtitles);
      onSubtitlesSaved(result);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save subtitle edits');
    } finally {
      setIsSaving(false);
    }
  };

  const round = (num: number) => Math.round(num * 1000) / 1000;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden">
      {/* Editor Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-white">Subtitle Segments</h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {subtitles.length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-slate-800" />

          {/* Add Subtitle */}
          <button
            onClick={() => handleAddSubtitle()}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subtitles Scrollable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[600px] divide-y divide-slate-800/50">
        {subtitles.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No subtitles detected in this video. Click "+ Add" to create a subtitle.
          </div>
        ) : (
          subtitles.map((sub) => {
            const isActive = currentTime >= sub.start && currentTime <= sub.end;

            return (
              <div
                key={sub.id}
                className={`pt-3 first:pt-0 rounded-xl transition-all ${
                  isActive ? 'bg-indigo-950/20 ring-1 ring-indigo-500/30 p-3' : 'hover:bg-slate-800/30 p-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-indigo-400 font-mono">#{sub.id}</span>
                    <button
                      onClick={() => onSeek(sub.start)}
                      className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-indigo-400 transition"
                      title="Seek video to start time"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>

                  {/* Time Inputs */}
                  <div className="flex items-center space-x-1 text-xs font-mono">
                    <input
                      type="text"
                      defaultValue={formatSecondsToTimestamp(sub.start)}
                      onBlur={(e) => handleUpdateTime(sub.id, 'start', e.target.value)}
                      className="w-24 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-center text-slate-300 focus:outline-none focus:border-indigo-500 text-[11px]"
                    />
                    <span className="text-slate-600">→</span>
                    <input
                      type="text"
                      defaultValue={formatSecondsToTimestamp(sub.end)}
                      onBlur={(e) => handleUpdateTime(sub.id, 'end', e.target.value)}
                      className="w-24 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-center text-slate-300 focus:outline-none focus:border-indigo-500 text-[11px]"
                    />
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleAddSubtitle(sub.id)}
                      className="p-1 rounded text-slate-500 hover:text-indigo-400 transition"
                      title="Insert subtitle below"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubtitle(sub.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                      title="Delete subtitle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Original Transcript */}
                <div className="mb-1.5 text-xs text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">
                    Original (Whisper)
                  </span>
                  {sub.text}
                </div>

                {/* Editable Translation */}
                <div className="text-xs">
                  <span className="text-[10px] uppercase font-semibold text-indigo-400 block mb-0.5">
                    Translation (Editable)
                  </span>
                  <textarea
                    rows={2}
                    value={sub.translation}
                    onChange={(e) => handleUpdateTranslation(sub.id, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded p-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
                    placeholder="Enter translated subtitle..."
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
