import React from 'react';
import { Film, Clock, HardDrive, Maximize2, Trash2, Volume2, VolumeX } from 'lucide-react';
import { UploadResponse } from '../types';

interface UploadedVideoCardProps {
  upload: UploadResponse;
  onReset: () => void;
  disabled?: boolean;
}

export const UploadedVideoCard: React.FC<UploadedVideoCardProps> = ({
  upload,
  onReset,
  disabled
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-4">
        {/* Real Thumbnail from FFmpeg */}
        <div className="relative w-24 h-16 sm:w-28 sm:h-20 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 flex items-center justify-center">
          {upload.thumbnail_url ? (
            <img
              src={upload.thumbnail_url}
              alt="Video Thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <Film className="w-8 h-8 text-slate-700" />
          )}
          <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono text-slate-300 px-1 rounded">
            {formatDuration(upload.duration)}
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md" title={upload.original_filename}>
            {upload.original_filename}
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              {formatFileSize(upload.file_size)}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {formatDuration(upload.duration)}
            </span>
            {upload.width > 0 && upload.height > 0 && (
              <span className="flex items-center gap-1 font-mono">
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                {upload.width}x{upload.height}
              </span>
            )}
            <span className="flex items-center gap-1">
              {upload.has_audio ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> Audio Stream
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <VolumeX className="w-3.5 h-3.5" /> No Audio Track
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {!disabled && (
        <button
          onClick={onReset}
          className="self-end sm:self-center flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 text-xs transition"
          title="Remove video and choose another"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Change</span>
        </button>
      )}
    </div>
  );
};
