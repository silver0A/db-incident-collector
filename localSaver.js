/**
 * Local File Saver - 테스트용 로컬 파일 저장
 * S3 업로드 대신 로컬에 저장하여 테스트
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { serializeSnapshot } = require('./dbCollector');

class LocalFileSaver {
  /**
   * 로컬 파일 저장기 - 테스트용
   * @param {string} baseDir 기본 저장 디렉토리
   */
  constructor(baseDir = './snapshots') {
    this.baseDir = path.resolve(baseDir);
    this._ensureDirectory();
  }

  /** 저장 디렉토리 생성 */
  _ensureDirectory() {
    fs.mkdirSync(this.baseDir, { recursive: true });
    logger.info(`Snapshot directory: ${this.baseDir}`);
  }

  /**
   * JSON 데이터를 로컬 파일로 저장
   * @param {Object} data 스냅샷 데이터
   * @param {string} filename 파일명 (확장자 제외)
   * @returns {string} 저장된 파일의 절대 경로
   */
  saveJson(data, filename) {
    try {
      const serializedData = serializeSnapshot(data);

      // 날짜별 하위 디렉토리 생성
      const now = new Date();
      const dateDir = path.join(
        this.baseDir,
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      );
      fs.mkdirSync(dateDir, { recursive: true });

      // 파일 경로
      const filepath = path.join(dateDir, `${filename}.json`);

      // JSON 파일 저장
      fs.writeFileSync(filepath, JSON.stringify(serializedData, null, 2), 'utf-8');

      logger.info(`Successfully saved to ${filepath}`);
      return path.resolve(filepath);
    } catch (e) {
      logger.error(`Failed to save file: ${e.message}`);
      throw e;
    }
  }

  /**
   * 데이터를 읽기 쉬운 TXT 형식으로 저장
   * @param {Object} data 스냅샷 데이터
   * @param {string} filename 파일명 (확장자 제외)
   * @returns {string} 저장된 파일의 절대 경로
   */
  saveTxt(data, filename) {
    try {
      const serializedData = serializeSnapshot(data);

      // 날짜별 하위 디렉토리 생성
      const now = new Date();
      const dateDir = path.join(
        this.baseDir,
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      );
      fs.mkdirSync(dateDir, { recursive: true });

      // 파일 경로
      const filepath = path.join(dateDir, `${filename}.txt`);

      // TXT 형식으로 변환
      const content = this._formatAsTxt(serializedData);
      fs.writeFileSync(filepath, content, 'utf-8');

      logger.info(`Successfully saved to ${filepath}`);
      return path.resolve(filepath);
    } catch (e) {
      logger.error(`Failed to save file: ${e.message}`);
      throw e;
    }
  }

  /**
   * 데이터를 읽기 쉬운 텍스트 형식으로 변환
   * @param {Object} data
   * @returns {string}
   */
  _formatAsTxt(data) {
    const lines = [];
    const separator = '='.repeat(80);

    // 헤더
    lines.push(separator);
    lines.push('DB INCIDENT SNAPSHOT REPORT');
    lines.push(separator);
    lines.push(`Collected At: ${data.collected_at || 'N/A'}`);
    lines.push(`DB Type: ${data.db_type || 'N/A'}`);
    lines.push(`DB Version: ${data.db_version || 'N/A'}`);
    lines.push('');

    // Alert 정보
    if (data.alert_info) {
      lines.push(separator);
      lines.push('ALERT INFORMATION');
      lines.push(separator);
      lines.push(`Alert Name: ${data.alert_info.name || 'N/A'}`);
      lines.push(`Triggered At: ${data.alert_info.triggered_at || 'N/A'}`);
      lines.push('');
    }

    // Process List
    lines.push(separator);
    lines.push('PROCESS LIST (SHOW FULL PROCESSLIST)');
    lines.push(separator);
    this._formatTable(lines, data.processlist || []);
    lines.push('');

    // InnoDB Transactions
    lines.push(separator);
    lines.push('INNODB TRANSACTIONS');
    lines.push(separator);
    this._formatTable(lines, data.innodb_trx || []);
    lines.push('');

    // Lock Waits
    lines.push(separator);
    lines.push('LOCK WAITS');
    lines.push(separator);
    this._formatTable(lines, data.lock_waits || []);
    lines.push('');

    // Locks
    lines.push(separator);
    lines.push('CURRENT LOCKS');
    lines.push(separator);
    this._formatTable(lines, data.locks || []);
    lines.push('');

    // InnoDB Status
    lines.push(separator);
    lines.push('INNODB STATUS (SHOW ENGINE INNODB STATUS)');
    lines.push(separator);
    const innodbStatus = data.innodb_status || '';
    lines.push(typeof innodbStatus === 'string' ? innodbStatus : String(innodbStatus));
    lines.push('');

    // Global Status (주요 항목만)
    lines.push(separator);
    lines.push('GLOBAL STATUS (Key Metrics)');
    lines.push(separator);
    const globalStatus = data.global_status || {};
    const keyMetrics = [
      'Threads_connected',
      'Threads_running',
      'Connections',
      'Aborted_clients',
      'Aborted_connects',
      'Slow_queries',
      'Questions',
      'Queries',
      'Innodb_row_lock_waits',
      'Innodb_row_lock_time',
      'Innodb_buffer_pool_reads',
      'Innodb_buffer_pool_read_requests',
      'Table_locks_waited',
      'Table_locks_immediate',
    ];
    for (const key of keyMetrics) {
      if (key in globalStatus) {
        lines.push(`${key}: ${globalStatus[key]}`);
      }
    }
    lines.push('');

    // 전체 Global Status (JSON)
    lines.push(separator);
    lines.push('FULL GLOBAL STATUS (JSON)');
    lines.push(separator);
    lines.push(JSON.stringify(globalStatus, null, 2));
    lines.push('');

    lines.push(separator);
    lines.push('END OF REPORT');
    lines.push(separator);

    return lines.join('\n');
  }

  /**
   * 테이블 형식으로 포맷팅
   * @param {string[]} lines
   * @param {Array} rows
   */
  _formatTable(lines, rows) {
    if (!rows || rows.length === 0) {
      lines.push('(No data)');
      return;
    }

    if (typeof rows[0] === 'object' && rows[0] !== null) {
      // 에러 메시지인 경우
      if ('error' in rows[0] || 'info' in rows[0]) {
        lines.push(JSON.stringify(rows[0]));
        return;
      }

      // 컬럼 헤더
      const headers = Object.keys(rows[0]);
      lines.push(headers.join(' | '));
      lines.push('-'.repeat(80));

      // 데이터 행
      for (const row of rows) {
        const values = headers.map((h) => {
          const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
          return val.substring(0, 50); // 50자 제한
        });
        lines.push(values.join(' | '));
      }
    } else {
      for (const row of rows) {
        lines.push(String(row));
      }
    }
  }
}

module.exports = LocalFileSaver;
