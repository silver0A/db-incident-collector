/**
 * S3 Uploader - IAM Role 기반 인증
 * 수집된 스냅샷을 S3에 업로드
 */

const { S3Client, PutObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');
const { serializeSnapshot } = require('./dbCollector');

class S3Uploader {
  /**
   * S3 업로더 - IAM Role 사용
   * @param {string} bucket S3 버킷명
   * @param {string} region AWS 리전
   */
  constructor(bucket, region = 'ap-northeast-2') {
    this.bucket = bucket;
    this.region = region;
    // IAM Role 사용 시 credentials 자동 획득
    this.s3Client = new S3Client({ region });
  }

  /**
   * JSON 데이터를 S3에 업로드
   * @param {Object} data 스냅샷 데이터
   * @param {string} key S3 키(경로)
   * @returns {Promise<string>} S3 URL
   */
  async uploadJson(data, key) {
    try {
      // 직렬화 가능한 형태로 변환
      const serializedData = serializeSnapshot(data);

      // JSON 문자열로 변환
      const jsonContent = JSON.stringify(serializedData, null, 2);

      // S3 업로드
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: Buffer.from(jsonContent, 'utf-8'),
          ContentType: 'application/json',
        })
      );

      const s3Url = `s3://${this.bucket}/${key}`;
      logger.info(`Successfully uploaded to ${s3Url}`);
      return s3Url;
    } catch (e) {
      logger.error(`Failed to upload to S3: ${e.message}`);
      throw e;
    }
  }

  /**
   * 버킷 접근 권한 확인
   * @returns {Promise<boolean>}
   */
  async checkBucketAccess() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      logger.info(`Bucket ${this.bucket} is accessible`);
      return true;
    } catch (e) {
      const statusCode = e.$metadata?.httpStatusCode;
      if (statusCode === 403) {
        logger.error(`Access denied to bucket ${this.bucket}`);
      } else if (statusCode === 404) {
        logger.error(`Bucket ${this.bucket} does not exist`);
      } else {
        logger.error(`Error accessing bucket: ${e.message}`);
      }
      return false;
    }
  }
}

module.exports = S3Uploader;
