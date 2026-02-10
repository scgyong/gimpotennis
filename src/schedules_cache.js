/**
 * Schedules 캐시 관리 모듈
 * 
 * 여러 사용자가 공유하는 schedules 데이터를 Main Process에서 관리
 * - 창이 닫혔다가 다시 열려도 캐시 유지
 * - 모든 사용자가 같은 데이터 공유 (공용 시설 정보)
 * - 날짜별 캐시 관리 (각 날짜마다 유효시간 추적)
 */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

let cache = {
  schedules: {},  // { 'YYYYMMDD': { time, data, cachedAt }, ... }
};

/**
 * 특정 날짜의 캐시가 유효한지 확인
 * @param {string} ymd - 'YYYYMMDD' 형식
 */
function isValidForDate(ymd) {
  if (!cache.schedules[ymd]) {
    return false;
  }
  const cachedAt = cache.schedules[ymd].cachedAt;
  const elapsed = Date.now() - cachedAt;
  return elapsed < CACHE_TTL_MS;
}

/**
 * 날짜별 캐시 조회
 * @param {string} ymd - 'YYYYMMDD' 형식
 * @returns {Object|null} 유효한 캐시 또는 null
 */
function getForDate(ymd) {
  if (!isValidForDate(ymd)) {
    return null;
  }
  const cached = cache.schedules[ymd];
  return {
    time: cached.time,
    data: cached.data,
  };
}

/**
 * 전체 캐시 조회 (여러 날짜)
 * @returns {Object} 유효한 모든 캐시
 */
function getAll() {
  const result = {};
  for (const ymd in cache.schedules) {
    if (isValidForDate(ymd)) {
      const cached = cache.schedules[ymd];
      result[ymd] = {
        time: cached.time,
        data: cached.data,
      };
    }
  }
  return result;
}

/**
 * 캐시 저장 (날짜별)
 * @param {string} ymd - 'YYYYMMDD' 형식
 * @param {Object} scheduleData - { time, data }
 */
function setForDate(ymd, scheduleData) {
  cache.schedules[ymd] = {
    time: scheduleData.time,
    data: scheduleData.data,
    cachedAt: Date.now(),
  };
  console.log('[schedules_cache] cached for', ymd);
}

/**
 * 캐시 저장 (여러 날짜)
 * @param {Object} schedules - { 'YYYYMMDD': { time, data }, ... }
 */
function setAll(schedules) {
  for (const ymd in schedules) {
    cache.schedules[ymd] = {
      time: schedules[ymd].time,
      data: schedules[ymd].data,
      cachedAt: Date.now(),
    };
  }
  console.log('[schedules_cache] cached', Object.keys(schedules).length, 'dates');
}

/**
 * 캐시 초기화
 */
function clear() {
  cache.schedules = {};
  console.log('[schedules_cache] all cache cleared');
}

/**
 * 특정 날짜 캐시 제거
 */
function clearForDate(ymd) {
  delete cache.schedules[ymd];
  console.log('[schedules_cache] cache cleared for', ymd);
}

/**
 * 만료된 캐시 정리
 */
function cleanup() {
  const before = Object.keys(cache.schedules).length;
  for (const ymd in cache.schedules) {
    if (!isValidForDate(ymd)) {
      delete cache.schedules[ymd];
    }
  }
  const after = Object.keys(cache.schedules).length;
  if (before > after) {
    console.log('[schedules_cache] cleaned up', before - after, 'expired entries');
  }
}

/**
 * 캐시 상태 조회 (디버깅용)
 */
function getStatus() {
  const entries = [];
  for (const ymd in cache.schedules) {
    const cached = cache.schedules[ymd];
    entries.push({
      ymd,
      isValid: isValidForDate(ymd),
      cachedAt: new Date(cached.cachedAt).toLocaleTimeString(),
      ageMs: Date.now() - cached.cachedAt,
    });
  }
  return {
    totalEntries: entries.length,
    ttlMs: CACHE_TTL_MS,
    entries,
  };
}

/**
 * timeBoard4.php AJAX 응답을 파싱하여 캐시 저장
 * @param {Object} info - { url, payload, response, status, statusText }
 */
function parseTimeBoard(info) {
  const { url, response } = info;
  console.log('[schedules_cache] parseTimeBoard called, length:', response?.length);
  
  try {
    // URL에서 orderDate 추출
    const urlObj = new URL(url, 'http://example.com');
    const ymd = urlObj.searchParams.get('orderDate');
    
    if (ymd) {
      cache.schedules[ymd] = {
        time: Date.now(),
        data: {
          raw: response,
          parsed: null, // 파싱 완료 후 채워짐
        },
        cachedAt: Date.now(),
      };
      console.log('[schedules_cache] timeBoard4 cached for', ymd);
    } else {
      console.warn('[schedules_cache] parseTimeBoard: orderDate not foundded');
    }
  } catch (e) {
    console.error('[schedules_cache] parseTimeBoard error:', e);
  }
}

module.exports = {
  getForDate,
  getAll,
  setForDate,
  setAll,
  clear,
  clearForDate,
  cleanup,
  getStatus,
  parseTimeBoard,
};
