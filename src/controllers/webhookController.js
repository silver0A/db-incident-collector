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
}

/**
 * POST /test/collect - 테스트용 수동 수집 트리거
 */
function handleTestCollect(_req, res) {
  collectAndUpload('manual_test', { test: true });
  res.json({ status: 'ok', message: 'Collection triggered' });
}

module.exports = { handleGrafanaWebhook, handleTestCollect };
