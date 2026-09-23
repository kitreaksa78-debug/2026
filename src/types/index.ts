export type JobStatusType =
  | 'idle'
  | 'uploading'
  | 'uploaded'
  | 'queued'
  | 'extracting_audio'
  | 'transcribing'
  | 'translating'
  | 'generating_subtitles'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface LanguageItem {
  code: string;
  name: string;
  native_name: string;
}

export interface LanguagesResponse {
  source_languages: LanguageItem[];
  target_languages: LanguageItem[];
}

export interface UploadResponse {
  video_id: string;
  original_filename: string;
  file_size: number;
  duration: number;
  width: number;
  height: number;
  has_audio: boolean;
  thumbnail_url: string | null;
  video_url: string;
}

export interface JobResponse {
  job_id: string;
  status: JobStatusType;
  progress: number;
  current_step: string;
  error: string | null;
  source_language: string;
  detected_language?: string | null;
  target_language: string;
  original_filename: string;
  duration: number;
  file_size: number;
  thumbnail_url?: string | null;
  video_url?: string | null;
  rendered_video_url?: string | null;
  srt_url?: string | null;
  vtt_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtitleItem {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  translation: string;
}

export interface SubtitleStyle {
  font_size: number;
  text_color: string;
  outline_color: string;
  outline_width: number;
  background_color: string;
  shadow: number;
  position: 'bottom_center' | 'top_center' | 'middle_center';
}

export interface HealthStatus {
  status: string;
  ffmpeg: boolean;
  ffprobe: boolean;
  whisper: boolean;
  redis: boolean;
  libretranslate: boolean;
}
