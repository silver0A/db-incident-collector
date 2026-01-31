/**
 * Configuration - 환경변수 기반 설정 관리 (.env 파일에서 로드)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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

module.exports = settings;
