/**
 * Logger - winston 기반 로깅 설정
 */

const winston = require('winston');
const { getKSTTimestampForLogger } = require('./dateUtils');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: getKSTTimestampForLogger }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - ${level.toUpperCase()} - ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
