/**
 * Health Controller - 헬스체크 엔드포인트
 */

/**
 * GET /health - 헬스체크
 */
function getHealth(_req, res) {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
}

module.exports = { getHealth };
