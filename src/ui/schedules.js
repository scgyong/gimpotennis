// ============================================================================
// 환경 감지 (Electron vs Browser)
// ============================================================================
const isElectron = () => {
    try {
        return typeof window !== 'undefined' && 
               typeof window.api !== 'undefined' && 
               window.api !== null;
    } catch (e) {
        return false;
    }
};

// ============================================================================
// API Wrapper (Electron 환경 체크)
// ============================================================================
const electronApi = {
  getCachedSchedules: async () => {
    if (!isElectron()) {
      console.log('[schedules] running in browser mode, cache disabled');
      return {};
    }
    try {
      return await window.api.getCachedSchedules();
    } catch (e) {
      console.error('[schedules] getCachedSchedules error:', e);
      return {};
    }
  },
  
  sendScheduleForDate: async (ymd, scheduleData) => {
    if (!isElectron()) {
      console.log('[schedules] browser mode, skipping cache update');
      return;
    }
    try {
      return await window.api.sendScheduleForDate(ymd, scheduleData);
    } catch (e) {
      console.error('[schedules] sendScheduleForDate error:', e);
    }
  },
  
  makeReservation: async (resv) => {
    if (!isElectron()) {
      console.log('[schedules] browser mode, reservation not available');
      alert('예약은 Electron 애플리케이션에서만 가능합니다.');
      return;
    }
    try {
      return await window.api.makeReservation(resv);
    } catch (e) {
      console.error('[schedules] makeReservation error:', e);
    }
  }
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Date 객체를 'YYYYMMDD' 문자열로 변환
 */
function formatYmd(date) {
    const yy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return yy + mm + dd;
}

// ============================================================================
// Main Load
// ============================================================================
async function onLoad() {
    try {
        $('#date_prev').click(()=>{loadDate(null, -1)})
        $('#date_next').click(()=>{loadDate(null, 1)})
        $('#date_refresh').click(()=>{loadDate(currentDate, 0, true)})
        fillHours()

        $('.hour').click(onAvailableCell)

        currentDate = new Date()
        const ymd = formatYmd(currentDate)
        
        // Main에서 캐시받기 (async/await, 환경 체크)
        const cached = await electronApi.getCachedSchedules();
        if (cached && Object.keys(cached).length > 0) {
            Object.assign(schedules, cached);
            console.log('[schedules] 📦 캐시 복원:', Object.keys(schedules).length, '개 날짜');
            
            // 첫 날짜가 캐시에 있으면 그것을 사용
            if (schedules[ymd]) {
                console.log('[schedules] ✅ 캐시에서 로드:', ymd);
                updateSchedule(ymd);
                return;
            }
        }
        
        // 캐시 없으면 서버에서 로드
        console.log('[schedules] 🌐 네트워크에서 로드:', ymd);
        await loadDate(currentDate);
    } catch (e) {
        console.error('[schedules] onLoad error:', e);
    }
}

const HANJA_WEEKDAYS = "日月火水木金土";

let currentDate = null
const schedules = {}

async function onAvailableCell(e) {
    const $cell = $(e.currentTarget)

    if (!$cell.hasClass('available')) {
        $('.hour.selected').removeClass('selected')
        return
    }
    if ($cell.hasClass('selected')) {
        makeReservation()
        return
    }
    const { court, hour } = court_and_hour_from_cell($cell)
    const $selected_hour_cell = $('.hour.available.selected')
    if ($selected_hour_cell.length == 1) {
        const prev = court_and_hour_from_cell($selected_hour_cell.eq(0))
        const sameCourt = prev.court == court
        const oneHourDiff = Math.abs(prev.hour - hour) == 1
        if (sameCourt && oneHourDiff) {
            $cell.addClass('selected')
            return
        }
    }
    $selected_hour_cell.removeClass('selected')
    $cell.addClass('selected')
}

function court_and_hour_from_cell($cell) {
    const num = Number($cell.attr('id').split('_')[1])
    const court = Math.floor(num / 100)
    const hour = num % 100
    return { court, hour }
}

function makeReservation() {
    const $selected = $('.hour.selected')
    const { court, hour } = court_and_hour_from_cell($selected.eq(0))
    const hours = $selected.length 
    const d = currentDate
    const ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
    const hour_str = hour.toString().padStart(2, '0') + ':00';
    const resv = {
        court, date: String(ymd),
        start: hour, time: hour_str, hours,
    }

    electronApi.makeReservation(resv)
}

async function loadDate(date, dayDiff, forced) {
    try {
        if (!date) {
            date = new Date(currentDate.setDate(currentDate.getDate() + dayDiff));
        }

        const yy = date.getFullYear()
        const mm = (date.getMonth() + 1).toString().padStart(2, '0')
        const dd = date.getDate().toString().padStart(2, '0')
        const wd = HANJA_WEEKDAYS.charAt(date.getDay())

        $('#date').html(`${yy}.${mm}.${dd}(${wd})`)

        const ymd = yy+mm+dd
        const existing = schedules[ymd]
        if (!forced && existing) {
            console.log('[schedules] ✅ 캐시에서 로드:', ymd);
            updateSchedule(ymd)
            return
        }

        console.log('[schedules] 🌐 네트워크에서 로드:', ymd);
        const now = new Date()
        const res = await $.ajax({
            url: 'http://www.gimposports.or.kr/skin/orders/timeSlots.php',
            type: 'POST',
            data: { orderDate: ymd },
            dataType: 'json',
        })

        schedules[ymd] = { time: now, data: res }
        
        // Main에 전송 (날짜별 증분 업데이트, 환경 체크)
        await electronApi.sendScheduleForDate(ymd, { time: now, data: res });
        
        console.log('[schedules] 💾 캐시에 저장:', ymd);
        console.log(res)
        updateSchedule(ymd)
    } catch (e) {
        console.error('[schedules] loadDate error:', e);
    }
}

const hour_classes = [
    'available', 'reserved', 'not-available', 'booked',
]

function maskName(str) {
    if (!str) return "";

    const len = str.length;
    if (len <= 2) {
        return str[0] + "*";
    }
    return str[0] + "*".repeat(len - 2) + str[len - 1];
}
function updateSchedule(ymd) {
    const sched = schedules[ymd]
    for (let court = 1; court <= 8; court += 1) {
        const slots = sched.data[court]
        for (let hour = 6; hour <= 23; hour += 1) {
            const hour_str = hour.toString().padStart(2, '0') + ':00';
            const court_hour = court * 100 + hour
            const $hid = $(`#h_${court_hour}`)
            hour_classes.forEach((cl)=>{ $hid.removeClass(cl) })
            const value = slots[hour_str]
            if (Array.isArray(value) && value.length >= 2) {
                const [name, team] = value
                $hid.html(`
                    <div class="resv-order-name">${maskName(name)}</div>
                    <div class="resv-order-team">${team}</div>
                `)
                $hid.addClass('booked')
            } else {
                $hid.html(hour_str)
                $hid.addClass(hour_classes[value])
            }
        }
    }

    const hours = String(sched.time.getHours()).padStart(2, '0'); // 시간 (예: 09)
    const minutes = String(sched.time.getMinutes()).padStart(2, '0'); // 분 (예: 05)
    const seconds = String(sched.time.getSeconds()).padStart(2, '0'); // 초 (예: 01)

    $('.update-time').html(`${hours}:${minutes}:${seconds}`)
}

function fillHours() {
    const $sched = $('.schedule')
    let html = $sched.html()

    for (let hour = 6; hour <= 23; hour += 1) {
        const hour_str = hour.toString().padStart(2, '0') + ':00';
        html += `<ul class="time-line">
                <li class="hour" data-court_hour="${hour}">${hour_str}</li>`
        for (let court = 1; court <= 8; court += 1) {
            const court_hour = court * 100 + hour
            html += `
                <li class="hour" id="h_${court_hour}">${hour_str}</li>
            `
        }
        html += `</ul>`
    }
    $sched.html(html)
}

