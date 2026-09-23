import React, { useRef, useState } from 'react';
import { UploadCloud, Film, CheckCircle2, AlertTriangle, FileVideo, Clock, HardDrive, RefreshCw } from 'lucide-react';
import { UploadResponse } from '../types';
import { uploadVideo } from '../services/api';

interface VideoUploaderProps {
  onUploadSuccess: (data: UploadResponse) => void;
  disabled?: boolean;
}

const SUPPORTED_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onUploadSuccess, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      setError(`Unsupported video format "${ext}". Supported: ${SUPPORTED_EXTS.join(', ')}`);
      return;
    }

    // 2048 MB limit
    if (file.size > 2048 * 1024 * 1024) {
      setError('File exceeds maximum upload size of 2048MB.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadVideo(file, (pct) => {
        setUploadProgress(pct);
      });
      setIsUploading(false);
      onUploadSuccess(result);
    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Failed to upload video');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onSelectFile}
        accept=".mp4,.mov,.mkv,.webm,.avi,.m4v"
        className="hidden"
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900/80'
        } ${isUploading || disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            {isUploading ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-white">
              {isUploading ? 'Uploading Video to Server...' : 'Upload your video file'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Drag and drop your file here, or click to browse
            </p>
          </div>

          {isUploading && (
            <div className="w-full max-w-md space-y-2 pt-2">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {!isUploading && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">MP4</span>
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">MOV</span>
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">MKV</span>
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">WEBM</span>
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">AVI</span>
              <span className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/50">M4V</span>
              <span className="text-slate-400 ml-1">Up to 2 GB</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
