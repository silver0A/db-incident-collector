/**
 * Grafana Alert Receiver - Express Application
 * DB 장애 시 자동으로 스냅샷을 수집하여 S3에 저장
 */

const express = require('express');
const settings = require('./config');
const logger = require('./logger');
const { DBSnapshotCollector } = require('./dbCollector');
const S3Uploader = require('./s3Uploader');
const LocalFileSaver = require('./localSaver');

const app = express();
app.use(express.json());

/**
 * 백그라운드에서 DB 스냅샷 수집 및 저장 (S3/로컬)
 * @param {string} alertName 알림 이름
 * @param {Object} alertData 알림 원본 데이터
 */
async function collectAndUpload(alertName, alertData) {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const filename = `${alertName}_${timestamp}`;

  try {
    // DB 스냅샷 수집
    logger.info(`Starting DB snapshot collection for alert: ${alertName}`);
    const collector = new DBSnapshotCollector({
      host: settings.dbHost,
      port: settings.dbPort,
      user: settings.dbUser,
      password: settings.dbPassword,
      database: settings.dbName,
    });

    const snapshot = await collector.collectAll();
    snapshot.alert_info = {
      name: alertName,
      triggered_at: timestamp,
      raw_data: alertData,
    };

    const savedLocations = [];

    // 로컬 저장 (storageMode가 "local" 또는 "both"인 경우)
    if (['local', 'both'].includes(settings.storageMode)) {
      logger.info('Saving snapshot to local file');
      const localSaver = new LocalFileSaver(settings.localSnapshotDir);

      if (['json', 'both'].includes(settings.localSaveFormat)) {
        const jsonPath = localSaver.saveJson(snapshot, filename);
        savedLocations.push(`Local JSON: ${jsonPath}`);
      }

      if (['txt', 'both'].includes(settings.localSaveFormat)) {
        const txtPath = localSaver.saveTxt(snapshot, filename);
        savedLocations.push(`Local TXT: ${txtPath}`);
      }
    }

    // S3 업로드 (storageMode가 "s3" 또는 "both"인 경우)
    if (['s3', 'both'].includes(settings.storageMode)) {
      logger.info('Uploading snapshot to S3');
      const uploader = new S3Uploader(settings.s3Bucket, settings.awsRegion);

      // 파일 경로: db-snapshots/YYYY/MM/DD/{alert_name}_{timestamp}.json
      const s3Now = new Date();
      const s3Key = [
        'db-snapshots',
        s3Now.getFullYear(),
        String(s3Now.getMonth() + 1).padStart(2, '0'),
        String(s3Now.getDate()).padStart(2, '0'),
        `${filename}.json`,
      ].join('/');

      const s3Url = await uploader.uploadJson(snapshot, s3Key);
      savedLocations.push(`S3: ${s3Url}`);
    }

    logger.info(`Snapshot saved successfully: ${savedLocations.join(', ')}`);
  } catch (e) {
    logger.error(`Failed to collect/upload snapshot: ${e.message}`, { stack: e.stack });
  }
}

// POST /webhook/grafana - Grafana Webhook 수신 엔드포인트
app.post('/webhook/grafana', (req, res) => {
  try {
    const payload = req.body;
    logger.info(`Received webhook payload: ${JSON.stringify(payload)}`);

    // Grafana 버전에 따라 payload 형식이 다름
    // Grafana 9+ (Unified Alerting)
    if (payload.alerts && Array.isArray(payload.alerts) && payload.alerts.length > 0) {
      const status = payload.status || '';
      if (status === 'firing') {
        for (const alert of payload.alerts) {
          const alertName = (alert.labels && alert.labels.alertname) || 'unknown';
          logger.info(`Alert firing: ${alertName}`);
          // 백그라운드에서 실행 (응답을 블로킹하지 않음)
          collectAndUpload(alertName, payload);
        }
      }
    }
    // Grafana 8 이하 (Legacy Alerting)
    else if (payload.state === 'alerting') {
      const alertName = payload.ruleName || 'unknown';
      logger.info(`Legacy alert firing: ${alertName}`);
      collectAndUpload(alertName, payload);
    }
    // 상태가 firing이 아닌 경우
    else {
      logger.info(
        `Alert status is not firing, skipping. Status: ${payload.status || payload.state || 'unknown'}`
      );
    }

    res.json({ status: 'ok', message: 'Webhook received' });
  } catch (e) {
    logger.error(`Error processing webhook: ${e.message}`, { stack: e.stack });
    res.json({ status: 'error', message: e.message });
  }
});

// GET /health - 헬스체크 엔드포인트
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// POST /test/collect - 테스트용 수동 수집 트리거
app.post('/test/collect', (_req, res) => {
  collectAndUpload('manual_test', { test: true });
  res.json({ status: 'ok', message: 'Collection triggered' });
});

// 서버 시작
app.listen(settings.serverPort, settings.serverHost, () => {
  logger.info(
    `DB Incident Collector started on ${settings.serverHost}:${settings.serverPort}`
  );
  logger.info(`Storage mode: ${settings.storageMode}`);
});
