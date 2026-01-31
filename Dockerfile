FROM node:20-slim

WORKDIR /app

# 시스템 패키지 설치 (헬스체크용 curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# pnpm 설치
RUN corepack enable && corepack prepare pnpm@latest --activate

# 의존성 설치
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# 애플리케이션 복사
COPY src/ ./src/

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 실행
EXPOSE 8000
CMD ["node", "src/server.js"]
