import React, { useState } from 'react';
import {
  Download,
  Film,
  FileText,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { JobResponse } from '../types';

interface ResultViewProps {
  job: JobResponse;
  onReset: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({ job, onReset }) => {
  const [activeTab, setActiveTab] = useState<'translated' | 'original'>('translated');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white">
              Video Translation Completed
            </h3>
            <p className="text-xs text-slate-400">
              Subtitles successfully extracted, translated, and burned into MP4.
            </p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Translate Another Video</span>
        </button>
      </div>

      {/* Video Preview Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('translated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'translated'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Translated Video (Burned Subtitles)
            </button>
            <button
              onClick={() => setActiveTab('original')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'original'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Original Video
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
          {activeTab === 'translated' ? (
            <video
              src={job.rendered_video_url || `/api/jobs/${job.job_id}/preview/video`}
              controls
              className="w-full h-full object-contain"
              playsInline
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <video
              src={job.video_url || ''}
              controls
              className="w-full h-full object-contain"
              playsInline
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>

      {/* Download Action Hub */}
      <div className="pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Download Output Files
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Download Translated MP4 */}
          <a
            href={`/api/jobs/${job.job_id}/download/video`}
            download
            className="flex items-center justify-center space-x-2 p-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition text-center"
          >
            <Film className="w-4 h-4" />
            <span>Download Translated Video (.mp4)</span>
          </a>

          {/* Download SRT */}
          <a
            href={`/api/jobs/${job.job_id}/download/srt`}
            download
            className="flex items-center justify-center space-x-2 p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition text-center"
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Download Subtitles (.srt)</span>
          </a>

          {/* Download VTT */}
          <a
            href={`/api/jobs/${job.job_id}/download/vtt`}
            download
            className="flex items-center justify-center space-x-2 p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition text-center"
          >
            <FileText className="w-4 h-4 text-violet-400" />
            <span>Download WebVTT (.vtt)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
