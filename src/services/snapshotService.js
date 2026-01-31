/**
 * Snapshot Service - DB 스냅샷 수집 및 저장 비즈니스 로직
 */

const settings = require('../config');
const logger = require('../utils/logger');
const { DBSnapshotCollector } = require('../models/dbCollector');
const S3Uploader = require('../models/s3Uploader');
const LocalFileSaver = require('../models/localSaver');

/**
 * 스냅샷을 로컬 파일로 저장
 * @param {Object} snapshot 수집된 스냅샷 데이터
 * @param {string} filename 파일명 (확장자 제외)
 * @returns {string[]} 저장된 경로 목록
 */
function saveSnapshotLocal(snapshot, filename) {
  logger.info('Saving snapshot to local file');
  const localSaver = new LocalFileSaver(settings.localSnapshotDir);
  const results = [];

  if (['json', 'both'].includes(settings.localSaveFormat)) {
    const jsonPath = localSaver.saveJson(snapshot, filename);
    results.push(`Local JSON: ${jsonPath}`);
  }

  if (['txt', 'both'].includes(settings.localSaveFormat)) {
    const txtPath = localSaver.saveTxt(snapshot, filename);
    results.push(`Local TXT: ${txtPath}`);
  }

  return results;
}

/**
 * 스냅샷을 S3에 업로드
 * @param {Object} snapshot 수집된 스냅샷 데이터
 * @param {string} filename 파일명 (확장자 제외)
 * @returns {Promise<string[]>} 업로드된 S3 URL 목록
 */
async function uploadSnapshotToS3(snapshot, filename) {
  logger.info('Uploading snapshot to S3');
  const uploader = new S3Uploader(settings.s3Bucket, settings.awsRegion);

  // 파일 경로: db-snapshots/YYYY/MM/DD/{alert_name}_{timestamp}.json
  const s3Now = new Date();
  const s3Key = [
    'db-snapshots',
    s3Now.getFullYear(),
    String(s3Now.getMonth() + 1).padStart(2, '0'),
    String(s3Now.getDate()).padStart(2, '0'),
    `${filename}.json`,
  ].join('/');

  const s3Url = await uploader.uploadJson(snapshot, s3Key);
  return [`S3: ${s3Url}`];
}

/**
 * 백그라운드에서 DB 스냅샷 수집 및 저장 (S3/로컬)
 * @param {string} alertName 알림 이름
 * @param {Object} alertData 알림 원본 데이터
 */
async function collectAndUpload(alertName, alertData) {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const filename = `${alertName}_${timestamp}`;

  try {
    // DB 스냅샷 수집
    logger.info(`Starting DB snapshot collection for alert: ${alertName}`);
    const collector = new DBSnapshotCollector({
      host: settings.dbHost,
      port: settings.dbPort,
      user: settings.dbUser,
      password: settings.dbPassword,
      database: settings.dbName,
    });

    const snapshot = await collector.collectAll();
    snapshot.alert_info = {
      name: alertName,
      triggered_at: timestamp,
      raw_data: alertData,
    };

    const savedLocations = [];

    // 로컬 저장 (storageMode가 "local" 또는 "both"인 경우)
    if (['local', 'both'].includes(settings.storageMode)) {
      savedLocations.push(...saveSnapshotLocal(snapshot, filename));
    }

    // S3 업로드 (storageMode가 "s3" 또는 "both"인 경우)
    if (['s3', 'both'].includes(settings.storageMode)) {
      savedLocations.push(...await uploadSnapshotToS3(snapshot, filename));
    }

    logger.info(`Snapshot saved successfully: ${savedLocations.join(', ')}`);
  } catch (e) {
    logger.error(`Failed to collect/upload snapshot: ${e.message}`, { stack: e.stack });
  }
}

module.exports = { collectAndUpload };
