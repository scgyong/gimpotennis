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
    cachedAt: cached.cachedAt,
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
        cachedAt: cached.cachedAt,
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

/**
 * timeBoard4.php에서 파싱된 slots 데이터를 저장
 * @param {string} ymd - 'YYYYMMDD' 형식
 * @param {number} court - 코트 번호 (1-8)
 * @param {Object} slots - { '06:00': true/false, '07:00': true/false, ... }
 */
function setTimeBoard(ymd, court, slots) {
  // 날짜가 존재하지 않으면: time은 1시간 전, data에 코트번호 key로 slots 저장
  if (!cache.schedules[ymd]) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    console.log('날짜없음')
    cache.schedules[ymd] = {
      time: oneHourAgo,
      data: {
        [court]: slots
      },
      cachedAt: Date.now(),
    };
    console.log('[schedules_cache] setTimeBoard (new):', {ymd, court, slotCount: Object.keys(slots).length});
    return;
  }
  
  // 날짜가 존재하면: time은 건드리지 말고 data를 본다
  const data = cache.schedules[ymd].data;
  console.log('[schedules_cache] setTimeBoard (exists):', {ymd, court, slotCount: Object.keys(slots).length});
  // 코트번호가 존재하지 않으면: 새로 추가
  if (!data[court]) {
    console.log('코트번호 없음')
    data[court] = slots;
    console.log('[schedules_cache] setTimeBoard (add court):', {ymd, court, slotCount: Object.keys(slots).length});
    return;
  }
  
  // 코트번호가 존재하면: 시간별로 업데이트
  const courtData = data[court];
  console.log('코트번호 있음:', court);
  let updated = 0
  for (const time in slots) {
    if (slots[time] === 0) {
      // slots에 true이면 예약가능으로 업데이트
      courtData[time] = 0;
      updated++;
    } else {
      // slots에 false인 경우, 기존자료가 예약가능일때만 업데이트
      if (courtData[time] === 0) {
        courtData[time] = slots[time];
        updated++;
      }
    }
  }
  console.log('[schedules_cache] setTimeBoard (update):', {ymd, court, slotCount: Object.keys(slots).length, updated});
}

/**
 * timeBoard4.php HTML 응답을 파싱하여 캐시 저장
 * @param {Object} resv - 예약 정보 { date, court, ... }
 * @param {string} htmlData - timeBoard4.php의 HTML 응답
 */
function parseTimeBoard(resv, htmlData) {
  const date = resv.date
  const court = resv.court
  const slots = {}
  console.log('[schedules_cache] parseTimeBoard called for', date, 'court', court)
  
  for (const line of htmlData.split(/\n/)) {
    const m = line.match(/^\s*<label class="(on|no) labelDate" data="(\d{2}:\d{2})"/)
    if (!m) continue;
    slots[m[2]] = m[1] == "on" ? 0 : ["???", "???"]
  }
  
  const timeCount = Object.keys(slots).length
  // console.log('[schedules_cache] parseTimeBoard parsed slots:', slots)
  
  if (timeCount > 0) {
    setTimeBoard(date, court, slots)
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
  setTimeBoard,
  alreadyBooked,
};

/**
 * 예약 가능 여부 체크
 * @param {Object} r - 예약 정보 { date, court, time, hours }
 * @returns {boolean} true면 이미 예약됨, false면 예약 가능
 */
function alreadyBooked(r) {
  const cached = getForDate(r.date);
  
  if (!cached) {
    console.log(`[alreadyBooked] No cache for ${r.date}`);
    return false;
  }
  
  const courtData = cached.data[r.court];
  if (!courtData) {
    console.log(`[alreadyBooked] No court ${r.court} data for ${r.date}`);
    return false;
  }
  
  // 요청된 시간 확인 (slot이 0이어야만 예약 가능)
  const slot = courtData[r.time];
  if (slot) {
    console.log(`[alreadyBooked] ${r.date} ${r.time} Court ${r.court} is booked`);
    return true;
  }

  // hours > 1인 경우 다음 시간도 확인
  if (r.hours > 1) {
    const hour = Number(r.time.split(':')[0]) + 1;
    const nextTime = hour.toString().padStart(2, '0') + ':00';
    const nextSlot = courtData[nextTime];
    if (nextSlot) {
      console.log(`[alreadyBooked] ${r.date} ${nextTime} Court ${r.court} is booked`);
      return true;
    }
  }
  
  return false;
}
