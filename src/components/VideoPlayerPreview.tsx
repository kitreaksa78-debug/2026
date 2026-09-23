import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from 'lucide-react';
import { SubtitleItem, SubtitleStyle } from '../types';

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerPreviewProps {
  videoUrl: string;
  subtitles: SubtitleItem[];
  vttUrl?: string | null;
  style?: SubtitleStyle;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayerPreview = forwardRef<VideoPlayerRef, VideoPlayerPreviewProps>(
  ({ videoUrl, subtitles, vttUrl, style, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [activeSubtitle, setActiveSubtitle] = useState<SubtitleItem | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      if (onTimeUpdate) {
        onTimeUpdate(t);
      }

      // Find current subtitle
      const current = subtitles.find((s) => t >= s.start && t <= s.end);
      setActiveSubtitle(current || null);
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
      <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col group">
        <div className="relative aspect-video w-full flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain"
            controls
            playsInline
            crossOrigin="anonymous"
          >
            {vttUrl && (
              <track
                kind="subtitles"
                src={vttUrl}
                srcLang="auto"
                label="Translated Subtitles"
                default
              />
            )}
            Your browser does not support the video tag.
          </video>

          {/* Styled Subtitle Overlay */}
          {activeSubtitle && (
            <div
              className={`absolute left-0 right-0 px-4 sm:px-8 pointer-events-none flex justify-center transition-all z-20 ${
                style?.position === 'top_center'
                  ? 'top-3 sm:top-6'
                  : style?.position === 'middle_center'
                  ? 'top-1/2 -translate-y-1/2'
                  : 'bottom-3 sm:bottom-6'
              }`}
            >
              <div
                className="max-w-[90%] text-center px-3.5 py-1 sm:py-1.5 rounded-lg shadow-xl font-medium leading-relaxed break-words"
                style={{
                  fontSize: `clamp(13px, 3.2vw, ${style?.font_size || 20}px)`,
                  fontFamily: "'Kantumruy Pro', sans-serif",
                  color: style?.text_color || '#FFFFFF',
                  textShadow: `${style?.outline_width || 2}px ${style?.outline_width || 2}px 0 ${
                    style?.outline_color || '#000000'
                  }, -${style?.outline_width || 2}px -${style?.outline_width || 2}px 0 ${
                    style?.outline_color || '#000000'
                  }, ${style?.outline_width || 2}px -${style?.outline_width || 2}px 0 ${
                    style?.outline_color || '#000000'
                  }, -${style?.outline_width || 2}px ${style?.outline_width || 2}px 0 ${
                    style?.outline_color || '#000000'
                  }`,
                  backgroundColor:
                    style?.background_color && style.background_color !== 'transparent'
                      ? style.background_color
                      : 'rgba(0,0,0,0.7)',
                }}
              >
                {activeSubtitle.translation || activeSubtitle.text}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
