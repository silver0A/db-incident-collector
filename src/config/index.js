/**
 * Configuration - 환경변수 기반 설정 관리 (.env 파일에서 로드)
 */

const path = require('path');
// __dirname이 src/config/이므로 프로젝트 루트의 .env를 찾기 위해 두 단계 상위로 이동
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const settings = {
  // DB 설정
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT, 10) || 3306,
  dbUser: process.env.DB_USER || 'admin',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || null,

  // 저장 모드: "s3" | "local" | "both"
  storageMode: process.env.STORAGE_MODE || 'local',

  // 로컬 저장 설정
  localSnapshotDir: process.env.LOCAL_SNAPSHOT_DIR || './snapshots',
  localSaveFormat: process.env.LOCAL_SAVE_FORMAT || 'both',

  // S3 설정
  s3Bucket: process.env.S3_BUCKET || 'your-incident-bucket',
  awsRegion: process.env.AWS_REGION || 'ap-northeast-2',

  // 서버 설정
  serverHost: process.env.SERVER_HOST || '0.0.0.0',
  serverPort: parseInt(process.env.SERVER_PORT, 10) || 8000,
};

/**
 * 애플리케이션(환경)별 DB 접속 정보를 반환
 * 환경변수 규칙: DB_{APP_UPPER}_HOST, DB_{APP_UPPER}_PORT, ...
 * - application이 null이면 기본 DB 설정 반환
 * - application이 있지만 해당 환경변수가 없으면 null 반환 (수집 차단)
 *
 * @param {string|null} application 애플리케이션 식별자 (예: "dev", "stg")
 * @returns {{ host: string, port: number, user: string, password: string, database: string|null }|null}
 */
function getDbConfig(application) {
  // application이 없으면 기본 DB 설정 사용
  if (!application) {
    return {
      host: settings.dbHost,
      port: settings.dbPort,
      user: settings.dbUser,
      password: settings.dbPassword,
      database: settings.dbName,
    };
  }

  const prefix = `DB_${application.toUpperCase()}_`;
  const appHost = process.env[`${prefix}HOST`];

  // 미설정 application → null 반환 (수집 차단)
  if (!appHost) return null;

  return {
    host: appHost,
    port: parseInt(process.env[`${prefix}PORT`], 10) || settings.dbPort,
    user: process.env[`${prefix}USER`] || settings.dbUser,
    password: process.env[`${prefix}PASSWORD`] || settings.dbPassword,
    database: process.env[`${prefix}NAME`] || settings.dbName,
  };
}

module.exports = settings;
module.exports.getDbConfig = getDbConfig;
