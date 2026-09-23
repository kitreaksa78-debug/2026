import {
  HealthStatus,
  JobResponse,
  LanguagesResponse,
  SubtitleItem,
  SubtitleStyle,
  UploadResponse
} from '../types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error('Failed to fetch system health');
  }
  return res.json();
}

export async function fetchLanguages(): Promise<LanguagesResponse> {
  const res = await fetch(`${API_BASE}/languages`);
  if (!res.ok) {
    throw new Error('Failed to load supported languages');
  }
  return res.json();
}

export function uploadVideo(
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during file upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${API_BASE}/upload`);
    xhr.send(formData);
  });
}

export async function createJob(
  videoId: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_id: videoId,
      source_language: sourceLanguage,
      target_language: targetLanguage
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to initialize translation job');
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch job status');
  }
  return res.json();
}

export async function getSubtitles(jobId: string): Promise<SubtitleItem[]> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/subtitles`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch subtitles');
  }
  const data = await res.json();
  return data.subtitles || [];
}

export async function updateSubtitles(
  jobId: string,
  subtitles: SubtitleItem[]
): Promise<SubtitleItem[]> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/subtitles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitles })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save subtitle edits');
  }
  const data = await res.json();
  return data.subtitles || [];
}

export async function exportTranslatedVideo(
  jobId: string,
  style: SubtitleStyle
): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start video rendering');
  }
  return res.json();
}
