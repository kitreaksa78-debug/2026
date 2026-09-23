import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  Languages,
  Film,
  RotateCcw,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { UploadedVideoCard } from './components/UploadedVideoCard';
import { LanguageSelector } from './components/LanguageSelector';
import { JobProgress } from './components/JobProgress';
import { VideoPlayerPreview, VideoPlayerRef } from './components/VideoPlayerPreview';
import { SubtitleEditor } from './components/SubtitleEditor';
import { ExportModal } from './components/ExportModal';
import { ResultView } from './components/ResultView';
import {
  HealthStatus,
  JobResponse,
  LanguageItem,
  SubtitleItem,
  SubtitleStyle,
  UploadResponse
} from './types';
import {
  fetchHealth,
  fetchLanguages,
  createJob,
  getSubtitles,
  exportTranslatedVideo
} from './services/api';

const DEFAULT_STYLE: SubtitleStyle = {
  font_size: 22,
  text_color: '#FFFFFF',
  outline_color: '#000000',
  outline_width: 2,
  background_color: 'transparent',
  shadow: 1,
  position: 'bottom_center'
};

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [sourceLanguages, setSourceLanguages] = useState<LanguageItem[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<LanguageItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('auto');
  const [selectedTarget, setSelectedTarget] = useState<string>('km');

  // Application flow state
  const [uploadedVideo, setUploadedVideo] = useState<UploadResponse | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // Load initial health and languages
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => console.warn('Health check issue:', err));

    fetchLanguages()
      .then((data) => {
        setSourceLanguages(data.source_languages);
        setTargetLanguages(data.target_languages);
      })
      .catch((err) => console.warn('Language load issue:', err));
  }, []);

  // When job reaches completion for the first time, load subtitles
  useEffect(() => {
    if (job && job.status === 'completed' && (!subtitles || subtitles.length === 0)) {
      getSubtitles(job.job_id)
        .then((items) => {
          setSubtitles(items);
        })
        .catch((err) => console.error('Error loading subtitles:', err));
    }
  }, [job?.status, job?.job_id]);

  const handleStartTranslation = async () => {
    if (!uploadedVideo) return;
    setIsSubmittingJob(true);
    setGeneralError(null);

    try {
      const newJob = await createJob(uploadedVideo.video_id, selectedSource, selectedTarget);
      setJob(newJob);
      setSubtitles([]);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to start translation job');
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleExport = async (style: SubtitleStyle) => {
    if (!job) return;
    setSubtitleStyle(style);
    try {
      const updated = await exportTranslatedVideo(job.job_id, style);
      setJob(updated);
      setIsExportModalOpen(false);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to start video rendering');
    }
  };

  const handleReset = () => {
    setUploadedVideo(null);
    setJob(null);
    setSubtitles([]);
    setCurrentTime(0);
    setGeneralError(null);
  };

  const isProcessing =
    job &&
    job.status !== 'completed' &&
    job.status !== 'failed' &&
    job.status !== 'idle';

  const hasRenderedFinalVideo = job?.status === 'completed' && !!job?.rendered_video_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header health={health} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        {/* If final translated MP4 has been generated, show Result View */}
        {hasRenderedFinalVideo ? (
          <ResultView job={job} onReset={handleReset} />
        ) : (
          <>
            {/* Step 1: Upload Video & Language Selection (shown when not processing/editing) */}
            {!job && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    Translate Any Video into Any Language
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
                    Full self-hosted pipeline using <span className="text-indigo-400 font-medium">faster-whisper</span> speech recognition, <span className="text-violet-400 font-medium">LibreTranslate</span> NMT, and <span className="text-emerald-400 font-medium">FFmpeg</span> subtitle burning.
                  </p>
                </div>

                {!uploadedVideo ? (
                  <VideoUploader onUploadSuccess={setUploadedVideo} />
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <UploadedVideoCard upload={uploadedVideo} onReset={handleReset} />

                    <LanguageSelector
                      sourceLanguages={sourceLanguages}
                      targetLanguages={targetLanguages}
                      selectedSource={selectedSource}
                      selectedTarget={selectedTarget}
                      onSelectSource={setSelectedSource}
                      onSelectTarget={setSelectedTarget}
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleStartTranslation}
                        disabled={isSubmittingJob}
                        className="flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition transform active:scale-95 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{isSubmittingJob ? 'Initializing...' : 'Translate Video'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Processing in Background with Real SSE Progress */}
            {job && isProcessing && (
              <div className="max-w-4xl mx-auto space-y-6">
                <JobProgress job={job} onJobUpdate={setJob} />
              </div>
            )}

            {/* Error Banner */}
            {job && job.status === 'failed' && (
              <div className="max-w-4xl mx-auto space-y-4">
                <JobProgress job={job} onJobUpdate={setJob} />
                <div className="flex justify-center">
                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Another Video</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Interactive Video Player + Subtitle Editor */}
            {job && job.status === 'completed' && !job.rendered_video_url && (
              <div className="space-y-6 animate-fade-in">
                {/* Editor Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>Video Preview & Subtitle Editor</span>
                      <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {subtitles.length} Subtitles
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review Whisper transcript and LibreTranslate translation. Edit text or timing before rendering.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Create Translated Video (MP4)</span>
                    </button>
                  </div>
                </div>

                {/* Main 2-Column Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Real HTML5 Video Player */}
                  <div className="lg:col-span-7 space-y-4">
                    <VideoPlayerPreview
                      ref={videoPlayerRef}
                      videoUrl={job.video_url || ''}
                      subtitles={subtitles}
                      vttUrl={job.vtt_url}
                      style={subtitleStyle}
                      onTimeUpdate={setCurrentTime}
                    />

                    {/* Quick Download Subtitle Files */}
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
                      <span className="text-slate-400 font-medium">Export Subtitles:</span>
                      <a
                        href={`/api/jobs/${job.job_id}/download/srt`}
                        download
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition"
                      >
                        Download SRT (.srt)
                      </a>
                      <a
                        href={`/api/jobs/${job.job_id}/download/vtt`}
                        download
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition"
                      >
                        Download WebVTT (.vtt)
                      </a>
                    </div>
                  </div>

                  {/* Right Column: Subtitle Segment Editor */}
                  <div className="lg:col-span-5 h-[620px]">
                    <SubtitleEditor
                      jobId={job.job_id}
                      initialSubtitles={subtitles}
                      currentTime={currentTime}
                      onSeek={(time) => videoPlayerRef.current?.seekTo(time)}
                      onSubtitlesSaved={setSubtitles}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Global Error Banner */}
        {generalError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
            {generalError}
          </div>
        )}
      </main>

      {/* Export & Subtitle Style Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
};

export default App;
