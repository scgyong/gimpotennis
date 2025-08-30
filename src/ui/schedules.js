async function onLoad() {
    $('#date_prev').click(()=>{loadDate(null, -1)})
    $('#date_next').click(()=>{loadDate(null, 1)})
    $('#date_refresh').click(()=>{loadDate(currentDate, 0, true)})
    fillHours()

    currentDate = new Date()
    await loadDate(currentDate)
}

let currentDate = null
const schedules = {}

async function loadDate(date, dayDiff, forced) {
    if (!date) {
        date = new Date(currentDate.setDate(currentDate.getDate() + dayDiff));
    }

    const yy = date.getFullYear()
    const mm = (date.getMonth() + 1).toString().padStart(2, '0')
    const dd = date.getDate().toString().padStart(2, '0')

    $('#date').html(yy+'.'+mm+'.'+dd)

    const ymd = yy+mm+dd
    const existing = schedules[ymd]
    if (!forced && existing) {
        updateSchedule(ymd)
        return
    }

    const now = new Date()
    const res = await $.ajax({
        url: 'http://www.gimposports.or.kr/skin/orders/timeSlots.php',
        type: 'POST',
        data: { orderDate: ymd },
        dataType: 'json',
    })

    schedules[ymd] = { time: now, data: res }
    console.log(res)
    updateSchedule(ymd)
}

const hour_classes = [
    'available', 'reserved', 'not-available', 'booked',
]

function updateSchedule(ymd) {
    const sched = schedules[ymd]
    for (let court = 1; court <= 8; court += 1) {
        const slots = sched.data[court]
        for (let hour = 6; hour <= 23; hour += 1) {
            const hour_str = hour.toString().padStart(2, '0') + ':00';
            const value = slots[hour_str]
            const court_hour = court * 100 + hour
            const $hid = $(`#h_${court_hour}`)
            hour_classes.forEach((cl)=>{ $hid.removeClass(cl) })
            $hid.addClass(hour_classes[value])
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

