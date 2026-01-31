/**
 * Health Routes - 헬스체크 라우트
 */

const { Router } = require('express');
const { getHealth } = require('../controllers/healthController');

const router = Router();

router.get('/health', getHealth);

module.exports = router;
