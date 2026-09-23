# Video Translator

**Video Translator** is a real-world, production-ready, self-hosted video subtitle translation and burning platform. It uses an end-to-end open-source pipeline:
**Video Upload → FFmpeg Audio Extraction → faster-whisper (CTranslate2) Transcription → LibreTranslate Translation → Subtitle Synchronization (SRT/VTT) → FFmpeg Video Subtitle Burning → Real MP4 Download**.

No third-party paid AI APIs (e.g. OpenAI, Google Cloud Speech, DeepL API) are required. The entire pipeline runs completely locally or on your own VPS / dedicated server.

---

## Architecture Overview

```
                                  Internet
                                     │
                                     ▼
                            Nginx (Port 80/443)
                                ┌────┴────┐
                                │         │
               /_next, / (UI)   │         │  /api/* (REST & SSE)
                                ▼         ▼
                        Frontend (3000)  FastAPI Backend (8000)
                         (Next.js/React)        │
                                                ▼
                                         Redis (Port 6379)
                                          (PubSub / State)
                                                │
                                                ▼
                                      Celery Background Worker
                               ┌────────────────┼────────────────┐
                               ▼                ▼                ▼
                             FFmpeg       faster-whisper    LibreTranslate
                            (Audio /     (large-v3, CUDA/   (Self-hosted NMT)
                            Burning)         CPU Auto)         Port 5000
```

- **Frontend**: Next.js with React 19, TypeScript, Tailwind CSS, Lucide icons, and real-time Server-Sent Events (SSE).
- **Backend**: FastAPI with async file streaming, byte-range video streaming, and Redis pub/sub.
- **Worker**: Celery worker running `faster-whisper` and FFmpeg. Auto-detects NVIDIA CUDA GPU or falls back to multi-threaded CPU (`int8`).
- **Translation Engine**: LibreTranslate running locally in Docker, isolated and network-connected.
- **Storage**: Real local directory layout (`/data/uploads`, `/data/audio`, `/data/subtitles`, `/data/output`, `/data/temp`).

---

## Features

1. **Direct Video Upload**:
   - Drag-and-drop support for `.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`, `.m4v`.
   - Real metadata extraction via `ffprobe` (dimensions, duration, audio/video codecs).
   - Real video frame thumbnail extraction via `ffmpeg`.
   - Configurable size limits up to 2GB (`MAX_UPLOAD_SIZE_MB=2048`).

2. **Real Speech-to-Text with faster-whisper**:
   - Powered by SYSTRAN's `faster-whisper` (CTranslate2), up to 4x faster than OpenAI Whisper.
   - Defaults to `WHISPER_MODEL=large-v3` (supports `tiny`, `base`, `small`, `medium`, `large-v3`).
   - Auto hardware detection: `WHISPER_DEVICE=auto` (uses NVIDIA CUDA `float16` if GPU is present; otherwise CPU `int8`).
   - Automatically detects spoken language or transcribes the selected language with VAD (Voice Activity Detection).

3. **Real Translation Engine (LibreTranslate)**:
   - Self-hosted neural machine translation (NMT).
   - Supports English, Khmer, Thai, Vietnamese, Chinese, Japanese, Korean, French, Spanish, German, Portuguese, Russian, Arabic.
   - Modular `TranslationProvider` architecture for swappable backends.
   - Maintains exact segment start/end timestamps and subtitle ordering.

4. **Interactive Subtitle Editor**:
   - Live video preview with interactive subtitle overlay.
   - Displays both original transcript and translated text per segment.
   - Allows live editing of start time, end time, and translated text.
   - Add, delete, save, undo, and redo subtitles.
   - Clicking any subtitle segment automatically seeks the video player to that timestamp.

5. **Hardcoded Subtitle Video Burning**:
   - Burns translated subtitles directly into the video stream via FFmpeg `subtitles` filter with `libx264`.
   - Customizable styling: font size, text color, outline color, outline width, shadow, and positioning (bottom center, top center, middle center).
   - Generates an actual downloadable, playable MP4 file.

6. **Full Downloads**:
   - Download Translated Video (`.mp4`)
   - Download SubRip Subtitles (`.srt`)
   - Download WebVTT Subtitles (`.vtt`)

---

## System Requirements

- **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS (recommended) / Debian 12 / Linux x86_64
- **RAM**:
  - For `large-v3` on CPU: Minimum 8 GB RAM (16 GB recommended).
  - For `small` or `base` models: 4 GB RAM.
  - For GPU: NVIDIA GPU with at least 6 GB VRAM (8 GB+ recommended for `large-v3`).
- **Disk**: 20 GB free space for Docker images, Whisper models, and video processing.
- **Software**: Docker Engine (v24.0+) & Docker Compose (v2.20+).

---

## Deployment Guide (Ubuntu VPS)

### 1. Install Docker & Docker Compose

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 2. (Optional) NVIDIA GPU Setup

If your VPS has an NVIDIA GPU (e.g., T4, A10G, RTX 3090, RTX 4090):

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
  && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Test GPU passthrough
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

Then in `docker-compose.yml`, uncomment the `deploy.resources.reservations.devices` block under `worker`.

---

### 3. Clone and Configure

```bash
git clone <your-repo-url> video-translator
cd video-translator

# Copy environment template
cp .env.example .env
```

Review `.env`:

```env
WHISPER_MODEL=large-v3        # Options: tiny, base, small, medium, large-v3
WHISPER_DEVICE=auto          # auto, cuda, or cpu
WHISPER_COMPUTE_TYPE=auto    # auto, float16, int8, float32

LIBRETRANSLATE_URL=http://libretranslate:5000

REDIS_URL=redis://redis:6379/0

MAX_UPLOAD_SIZE_MB=2048

STORAGE_PATH=/data
TEMP_PATH=/data/temp

PORT=8000
```

---

### 4. Start the Application

```bash
# Start all services in the background
docker compose up -d --build
```

Docker will launch:
1. `video_translator_nginx` (Port 80)
2. `video_translator_frontend` (Port 3000)
3. `video_translator_backend` (Port 8000)
4. `video_translator_worker` (Celery background processor)
5. `video_translator_redis` (Port 6379)
6. `video_translator_libretranslate` (Port 5000)

---

### 5. Check Service Status & Logs

```bash
# Check running containers
docker compose ps

# View backend logs
docker compose logs -f backend

# View Celery worker logs (Whisper and FFmpeg execution)
docker compose logs -f worker

# View LibreTranslate model download logs
docker compose logs -f libretranslate
```

---

### 6. Verify Health Endpoint

Verify that all dependencies are running:

```bash
curl http://localhost/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "ffmpeg": true,
  "ffprobe": true,
  "whisper": true,
  "redis": true,
  "libretranslate": true
}
```

---

### 7. How to Stop the Application

```bash
# Stop all services
docker compose down

# Stop and remove all volumes (cleans up cached files)
docker compose down -v
```

---

## Troubleshooting

### 1. `LibreTranslate is unavailable`
- On first startup, LibreTranslate downloads language models for the specified languages (`LT_LOAD_ONLY`).
- Check logs: `docker compose logs -f libretranslate`
- Ensure port 5000 is open between containers.

### 2. Worker runs out of memory (OOM) during transcription
- If running on CPU with limited RAM, switch model from `large-v3` to `small` or `medium` in `.env`:
  ```env
  WHISPER_MODEL=small
  ```
- Restart worker: `docker compose restart worker`

### 3. Subtitle burning takes a long time
- Video encoding (`libx264`) depends on video duration and CPU cores.
- Using a GPU worker accelerates processing significantly.

---

## Security & Cleanup Policy

- Uploaded files are given randomized UUID names to prevent path traversal attacks.
- Temporary extracted audio files (`.wav`) are automatically deleted immediately after transcription completes.
- FFmpeg commands run with validated argument arrays without invoking raw shell subshells.
