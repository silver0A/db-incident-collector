/**
 * 스냅샷 데이터를 JSON 직렬화 가능한 형태로 변환
 * datetime, Buffer 등을 문자열로 변환
 */
const { toKSTString } = require('./dateUtils');

function serializeSnapshot(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (obj instanceof Date) {
    return toKSTString(obj);
  }
  if (Buffer.isBuffer(obj)) {
    return obj.toString('utf-8');
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeSnapshot(item));
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeSnapshot(value);
    }
    return result;
  }
  return obj;
}

module.exports = { serializeSnapshot };
