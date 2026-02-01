/**
 * Webhook Controller - Grafana Alert 수신 처리
 */

const logger = require('../utils/logger');
const { collectAndUpload } = require('../services/snapshotService');

/**
 * POST /webhook/grafana - Grafana Webhook 수신 엔드포인트
 */
function handleGrafanaWebhook(req, res) {
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
          const application = (alert.labels && alert.labels.application) || null;
          logger.info(`Alert firing: ${alertName}, application: ${application || 'unknown'}`);
          // 백그라운드에서 실행 (응답을 블로킹하지 않음)
          collectAndUpload(alertName, payload, application);
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
}

/**
 * POST /test/collect - 테스트용 수동 수집 트리거
 * body.application으로 대상 환경 지정 가능 (기본값: 'dev')
 */
function handleTestCollect(req, res) {
  const application = (req.body && req.body.application) || 'dev';
  logger.info(`Test collection triggered for application: ${application}`);
  collectAndUpload('manual_test', { test: true }, application);
  res.json({ status: 'ok', message: 'Collection triggered', application });
}

module.exports = { handleGrafanaWebhook, handleTestCollect };
