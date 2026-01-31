/**
 * Webhook Routes - Grafana Alert 관련 라우트
 */

const { Router } = require('express');
const { handleGrafanaWebhook, handleTestCollect } = require('../controllers/webhookController');

const router = Router();

router.post('/webhook/grafana', handleGrafanaWebhook);
router.post('/test/collect', handleTestCollect);

module.exports = router;
