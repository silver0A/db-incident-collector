/**
 * Server Entry Point - 서버 시작
 */

const app = require('./app');
const settings = require('./config');
const logger = require('./utils/logger');

app.listen(settings.serverPort, settings.serverHost, () => {
  logger.info(
    `DB Incident Collector started on ${settings.serverHost}:${settings.serverPort}`
  );
  logger.info(`Storage mode: ${settings.storageMode}`);
});
