/**
 * Health Controller - 헬스체크 엔드포인트
 */
const { toKSTString } = require('../utils/dateUtils');

/**
 * GET /health - 헬스체크
 */
function getHealth(_req, res) {
  res.json({ status: 'healthy', timestamp: toKSTString() });
}

module.exports = { getHealth };
