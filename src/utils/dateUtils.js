/**
 * KST 날짜 유틸리티 - 서버 시스템 타임존과 무관하게 KST(UTC+09:00) 기준 날짜/시간 제공
 */

const KST_TIMEZONE = 'Asia/Seoul';

/**
 * KST 기준 날짜/시간 구성 요소를 반환 (모두 zero-padded 문자열)
 * 경로 생성, 파일명 생성 등에 사용
 * @param {Date} [date] - 변환할 Date 객체 (기본값: 현재 시각)
 * @returns {{ year: string, month: string, day: string, hour: string, minute: string, second: string }}
 */
function getKSTDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partsArray = formatter.formatToParts(date);
  const map = {};
  for (const part of partsArray) {
    map[part.type] = part.value;
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === '24' ? '00' : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Date 객체를 KST ISO-like 문자열로 변환
 * 예: "2024-01-15T14:30:00+09:00"
 * @param {Date} [date] - 변환할 Date 객체 (기본값: 현재 시각)
 * @returns {string} KST 타임존 표기 포함 문자열
 */
function toKSTString(date = new Date()) {
  const p = getKSTDateParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
}

/**
 * Winston logger용 KST 타임스탬프 포맷 함수
 * 예: "2024-01-15 14:30:00"
 * @returns {string}
 */
function getKSTTimestampForLogger() {
  const p = getKSTDateParts();
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

module.exports = { toKSTString, getKSTDateParts, getKSTTimestampForLogger };
