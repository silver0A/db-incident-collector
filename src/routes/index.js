/**
 * Routes - 모든 라우트 통합
 */

const webhookRoutes = require('./webhookRoutes');
const healthRoutes = require('./healthRoutes');

/**
 * Express 앱에 모든 라우트 등록
 * @param {import('express').Application} app
 */
function registerRoutes(app) {
  app.use(webhookRoutes);
  app.use(healthRoutes);
}

module.exports = registerRoutes;
