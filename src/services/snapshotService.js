/**
 * Snapshot Service - DB 스냅샷 수집 및 저장 비즈니스 로직
 */

const settings = require('../config');
const { getDbConfig } = require('../config');
const logger = require('../utils/logger');
const { getKSTDateParts } = require('../utils/dateUtils');
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

  // 파일 경로: db-snapshots/YYYY/MM/DD/{alert_name}_{timestamp}.json (KST 기준)
  const s3Kst = getKSTDateParts();
  const s3Key = [
    settings.s3KeyPrefix,
    s3Kst.year,
    s3Kst.month,
    s3Kst.day,
    `${filename}.json`,
  ].join('/');

  const s3Url = await uploader.uploadJson(snapshot, s3Key);
  return [`S3: ${s3Url}`];
}

/**
 * 백그라운드에서 DB 스냅샷 수집 및 저장 (S3/로컬)
 * @param {string} alertName 알림 이름
 * @param {Object} alertData 알림 원본 데이터
 * @param {string|null} application 애플리케이션 식별자 (예: "dev", "stg")
 */
async function collectAndUpload(alertName, alertData, application = null) {
  const kst = getKSTDateParts();
  const timestamp = `${kst.year}${kst.month}${kst.day}_${kst.hour}${kst.minute}${kst.second}`;

  // 파일명: {application}_{alertName}_{timestamp} 또는 {alertName}_{timestamp}
  const prefix = application ? `${application}_` : '';
  const filename = `${prefix}${alertName}_${timestamp}`;

  // 애플리케이션별 DB 접속 정보 조회
  const dbConfig = getDbConfig(application);
  if (!dbConfig) {
    logger.error(`DB config not found for application: ${application}. Skipping snapshot collection.`);
    return;
  }

  try {
    // DB 스냅샷 수집
    logger.info(
      `Starting DB snapshot collection for alert: ${alertName}, application: ${application || 'default'}, db host: ${dbConfig.host}`
    );
    const collector = new DBSnapshotCollector(dbConfig);

    const snapshot = await collector.collectAll();
    snapshot.alert_info = {
      name: alertName,
      application: application || 'default',
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
