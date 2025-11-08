FROM node:22-bullseye

# Install system dependencies (ffmpeg includes ffprobe)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fontconfig \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy entire source (we'll choose install path based on UI_SERVICE)
COPY . .

# Install and build conditionally:
# - If UI_SERVICE is set → install full app and build Next
# - Else → use worker package.json and install minimal deps
RUN bash -lc '\
  if [ -n "$UI_SERVICE" ]; then \
    echo \"[Dockerfile] Building UI service\" && \
    npm ci --omit=dev && \
    npx next build ; \
  else \
    echo \"[Dockerfile] Building Worker service\" && \
    cp railway-package.json package.json && \
    npm install --omit=dev ; \
  fi \
'

# Expose port expected by fly.toml
ENV PORT=3000
EXPOSE 3000

# Start the correct server at runtime
CMD bash -lc 'if [ -n "$UI_SERVICE" ]; then npx next start -p ${PORT:-3000}; else node railway-backend.js; fi'


