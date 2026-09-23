FROM nvidia/cuda:12.2.2-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

RUN mkdir -p /data/uploads /data/audio /data/subtitles /data/output /data/temp /root/.cache/huggingface

# The worker shares the backend codebase
COPY ../backend/app ./app

CMD ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info", "--concurrency=1"]
