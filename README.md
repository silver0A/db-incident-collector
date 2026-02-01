# db-incident-collector

Grafana 알림 웹훅을 수신하여 장애 시점의 MariaDB 진단 스냅샷을 자동 수집하는 Node.js 서비스입니다. 수집된 스냅샷은 로컬 파일 또는 AWS S3에 저장되어 사후 분석에 활용됩니다.

## 수집 항목

| 항목 | 설명 |
|------|------|
| Process List | 현재 실행 중인 프로세스 목록 |
| InnoDB Transactions | 활성 트랜잭션 정보 |
| Lock Waits | 락 대기 상태 |
| Locks | 현재 락 정보 |
| InnoDB Status | InnoDB 엔진 상태 (버퍼풀, I/O 등) |
| Global Status | 전역 상태 변수 |
| Global Variables | 전역 시스템 변수 |

## 동작 방식

```
Grafana Alert → POST /webhook/grafana → 200 OK (즉시 응답)
                                            ↓ (백그라운드)
                                   DB 스냅샷 수집 → 로컬 저장 / S3 업로드
```

웹훅 엔드포인트는 즉시 응답을 반환하고, 스냅샷 수집은 백그라운드에서 비동기로 실행됩니다.

## 요구 사항

- Node.js 20+
- pnpm
- MariaDB 10.6+ (대상 DB)
- Docker / Docker Compose (선택)

## 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 DB 접속 정보 등을 설정

# 개발 모드 (파일 변경 시 자동 재시작)
pnpm dev

# 프로덕션 실행
pnpm start
```

### Docker

```bash
docker-compose build
docker-compose up -d
```

### 애플리케이션별 DB 분기

Grafana 알림의 `labels.application` 값과 매칭되어 해당 환경의 DB에 접속합니다. 미설정된 application은 수집이 차단됩니다.

## API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/webhook/grafana` | Grafana 알림 수신 (Grafana 8 Legacy / 9+ Unified Alerting 모두 지원) |
| POST | `/test/collect` | 수동 스냅샷 수집 트리거 |
| GET | `/health` | 헬스체크 |

### 수동 테스트

```bash
# 기본 (application: dev)
curl -X POST http://localhost:8000/test/collect

# 특정 환경 지정
curl -X POST http://localhost:8000/test/collect \
  -H "Content-Type: application/json" \
  -d '{"application": "stg"}'
```

## 프로젝트 구조

```
src/
├── config/          # 환경변수 설정
├── controllers/     # 요청/응답 처리
├── middlewares/      # Express 미들웨어
├── models/          # DB 수집, 파일 저장, S3 업로드
├── routes/          # 엔드포인트 정의
├── services/        # 비즈니스 로직 오케스트레이션
├── utils/           # 공유 유틸리티
├── app.js           # Express 앱 설정
└── server.js        # 서버 진입점
```

## 참고

- MariaDB 10.6 호환을 위해 락 정보 조회 시 fallback 쿼리를 사용합니다.
- 스냅샷은 `YYYY/MM/DD/` 디렉토리 구조로 저장됩니다.
