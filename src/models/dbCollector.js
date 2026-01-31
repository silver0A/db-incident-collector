/**
 * DB Snapshot Collector - MariaDB 10.6 호환
 * 장애 시점의 DB 상태 정보를 수집
 */

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class DBSnapshotCollector {
  /**
   * MariaDB 스냅샷 수집기
   * @param {Object} params
   * @param {string} params.host
   * @param {number} params.port
   * @param {string} params.user
   * @param {string} params.password
   * @param {string|null} params.database
   */
  constructor({ host, port, user, password, database = null }) {
    this.connectionParams = {
      host,
      port,
      user,
      password,
      database,
      charset: 'utf8mb4',
      connectTimeout: 10000,
      // mysql2는 read_timeout 대신 timeout 사용 가능하지만,
      // 쿼리별 timeout은 query options에서 지정
    };
  }

  /** DB 연결 생성 */
  async _getConnection() {
    return mysql.createConnection(this.connectionParams);
  }

  /**
   * 쿼리 실행 및 결과 반환
   * @param {import('mysql2/promise').Connection} conn
   * @param {string} query
   * @param {string} description
   * @returns {Promise<Array<Object>>}
   */
  async _executeQuery(conn, query, description) {
    try {
      const [rows] = await conn.query({ sql: query, timeout: 30000 });
      logger.info(`${description}: ${rows.length} rows`);
      return rows;
    } catch (e) {
      logger.warn(`Failed to execute ${description}: ${e.message}`);
      return [{ error: e.message }];
    }
  }

  /**
   * SHOW 명령어 실행 및 결과 반환
   * @param {import('mysql2/promise').Connection} conn
   * @param {string} command
   * @param {string} description
   * @returns {Promise<string>}
   */
  async _executeShowCommand(conn, command, description) {
    try {
      const [rows] = await conn.query({ sql: command, timeout: 30000 });
      if (rows && rows.length > 0) {
        const result = rows[0];
        // SHOW ENGINE INNODB STATUS의 경우 'Status' 컬럼에 결과가 있음
        if ('Status' in result) {
          return result.Status;
        }
        return JSON.stringify(result);
      }
      return '';
    } catch (e) {
      logger.warn(`Failed to execute ${description}: ${e.message}`);
      return `Error: ${e.message}`;
    }
  }

  /** 현재 실행 중인 프로세스 목록 */
  async collectProcesslist(conn) {
    return this._executeQuery(conn, 'SHOW FULL PROCESSLIST', 'Process List');
  }

  /** 현재 실행 중인 트랜잭션 */
  async collectInnodbTrx(conn) {
    return this._executeQuery(
      conn,
      'SELECT * FROM information_schema.INNODB_TRX',
      'InnoDB Transactions'
    );
  }

  /** 락 대기 상태 확인 - MariaDB 10.6 호환 */
  async collectLockWaits(conn) {
    const queries = [
      {
        sql: 'SELECT * FROM sys.innodb_lock_waits',
        desc: 'sys.innodb_lock_waits',
      },
      {
        sql: `SELECT
                r.trx_id AS waiting_trx_id,
                r.trx_mysql_thread_id AS waiting_thread,
                r.trx_query AS waiting_query,
                b.trx_id AS blocking_trx_id,
                b.trx_mysql_thread_id AS blocking_thread,
                b.trx_query AS blocking_query
              FROM information_schema.innodb_lock_waits w
              JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
              JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id`,
        desc: 'information_schema lock waits',
      },
    ];

    for (const { sql, desc } of queries) {
      try {
        const [rows] = await conn.query({ sql, timeout: 30000 });
        logger.info(`Lock Waits (${desc}): ${rows.length} rows`);
        return rows;
      } catch (e) {
        logger.debug(`${desc} not available: ${e.message}`);
        continue;
      }
    }

    return [{ info: 'Lock wait information not available in this MariaDB version' }];
  }

  /** 현재 락 정보 - MariaDB 10.6 호환 */
  async collectLocks(conn) {
    const queries = [
      {
        sql: 'SELECT * FROM information_schema.INNODB_LOCKS',
        desc: 'INNODB_LOCKS',
      },
      {
        sql: 'SELECT * FROM performance_schema.data_locks',
        desc: 'performance_schema.data_locks',
      },
    ];

    for (const { sql, desc } of queries) {
      try {
        const [rows] = await conn.query({ sql, timeout: 30000 });
        logger.info(`Locks (${desc}): ${rows.length} rows`);
        return rows;
      } catch (e) {
        logger.debug(`${desc} not available: ${e.message}`);
        continue;
      }
    }

    return [{ info: 'Lock information not available in this MariaDB version' }];
  }

  /** InnoDB 상태 (버퍼풀, I/O 등) */
  async collectInnodbStatus(conn) {
    return this._executeShowCommand(conn, 'SHOW ENGINE INNODB STATUS', 'InnoDB Status');
  }

  /** 전역 상태 변수 */
  async collectGlobalStatus(conn) {
    try {
      const [rows] = await conn.query({ sql: 'SHOW GLOBAL STATUS', timeout: 30000 });
      const statusDict = {};
      for (const row of rows) {
        statusDict[row.Variable_name] = row.Value;
      }
      logger.info(`Global Status: ${Object.keys(statusDict).length} variables`);
      return statusDict;
    } catch (e) {
      logger.warn(`Failed to get global status: ${e.message}`);
      return { error: e.message };
    }
  }

  /** 주요 전역 변수 (추가 정보) */
  async collectGlobalVariables(conn) {
    try {
      const [rows] = await conn.query({ sql: 'SHOW GLOBAL VARIABLES', timeout: 30000 });
      const statusDict = {};
      for (const row of rows) {
        statusDict[row.Variable_name] = row.Value;
      }
      logger.info(`Global Variables: ${Object.keys(statusDict).length} variables`);
      return statusDict;
    } catch (e) {
      logger.warn(`Failed to get global variables: ${e.message}`);
      return { error: e.message };
    }
  }

  /** 모든 스냅샷 정보 수집 */
  async collectAll() {
    const snapshot = {
      collected_at: new Date().toISOString(),
      db_type: 'MariaDB',
    };

    let conn;
    try {
      conn = await this._getConnection();

      // 버전 정보
      const [versionRows] = await conn.query('SELECT VERSION() as version');
      snapshot.db_version = versionRows.length > 0 ? versionRows[0].version : 'unknown';

      // 각 정보 수집
      snapshot.processlist = await this.collectProcesslist(conn);
      snapshot.innodb_trx = await this.collectInnodbTrx(conn);
      snapshot.lock_waits = await this.collectLockWaits(conn);
      snapshot.locks = await this.collectLocks(conn);
      snapshot.innodb_status = await this.collectInnodbStatus(conn);
      snapshot.global_status = await this.collectGlobalStatus(conn);
      snapshot.global_variables = await this.collectGlobalVariables(conn);

      logger.info('Snapshot collection completed successfully');
    } catch (e) {
      logger.error(`Failed to collect snapshot: ${e.message}`, { stack: e.stack });
      snapshot.error = e.message;
    } finally {
      if (conn) {
        await conn.end();
      }
    }

    return snapshot;
  }
}

module.exports = { DBSnapshotCollector };
