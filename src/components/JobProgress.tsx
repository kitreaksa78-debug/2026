import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileAudio,
  Languages,
  FileText,
  Video,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { JobResponse, JobStatusType } from '../types';

interface JobProgressProps {
  job: JobResponse;
  onJobUpdate: (updatedJob: JobResponse) => void;
}

const STAGES: { key: JobStatusType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'queued', label: 'Queued', icon: Clock },
  { key: 'extracting_audio', label: 'Extracting Audio', icon: FileAudio },
  { key: 'transcribing', label: 'faster-whisper STT', icon: FileText },
  { key: 'translating', label: 'LibreTranslate', icon: Languages },
  { key: 'generating_subtitles', label: 'Generating SRT/VTT', icon: FileText },
  { key: 'rendering', label: 'FFmpeg Video Rendering', icon: Video },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 }
];

export const JobProgress: React.FC<JobProgressProps> = ({ job, onJobUpdate }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'closed'>('connecting');

  useEffect(() => {
    if (job.status === 'completed' || job.status === 'failed') {
      setConnectionStatus('closed');
      return;
    }

    // Connect to real SSE stream
    const sseUrl = `/api/jobs/${job.job_id}/events`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onJobUpdate({
          ...job,
          ...data,
          status: data.status as JobStatusType
        });
        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
          setConnectionStatus('closed');
        }
      } catch (err) {
        console.error('Failed to parse SSE event payload:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setConnectionStatus('closed');
    };

    return () => {
      eventSource.close();
    };
  }, [job.job_id, job.status]);

  const getStageIndex = (status: JobStatusType): number => {
    switch (status) {
      case 'idle':
      case 'uploading':
      case 'uploaded':
      case 'queued':
        return 0;
      case 'extracting_audio':
        return 1;
      case 'transcribing':
        return 2;
      case 'translating':
        return 3;
      case 'generating_subtitles':
        return 4;
      case 'rendering':
        return 5;
      case 'completed':
        return 6;
      case 'failed':
      default:
        return -1;
    }
  };

  const currentIndex = getStageIndex(job.status);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base sm:text-lg font-semibold text-white">Pipeline Execution</h3>
            {connectionStatus === 'connected' && (
              <span className="flex items-center space-x-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live SSE</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{job.current_step}</p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold font-mono text-indigo-400">{job.progress}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            job.status === 'failed'
              ? 'bg-rose-500'
              : job.status === 'completed'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-500 to-violet-500'
          }`}
          style={{ width: `${Math.max(5, job.progress)}%` }}
        />
      </div>

      {/* Real Pipeline Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = currentIndex > idx || job.status === 'completed';
          const isCurrent = currentIndex === idx && job.status !== 'completed' && job.status !== 'failed';
          const isFailed = job.status === 'failed' && currentIndex === idx;

          return (
            <div
              key={stage.key}
              className={`p-3 rounded-xl border flex flex-col items-center text-center space-y-2 transition-all ${
                isFailed
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : isDone
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                  : isCurrent
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/30'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
              }`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center">
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span className="text-[11px] font-medium leading-tight">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Error display if failed */}
      {job.status === 'failed' && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="font-semibold">Pipeline Error</h5>
            <p className="text-xs text-rose-300">
              {job.error || 'An error occurred during video processing.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
