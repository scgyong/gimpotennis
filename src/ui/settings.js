import { reservationItemToString } from '../common/menu_time_esm.js'

window.onLoad = onLoad
window.fillConfig = fillConfig
window.addToMenu = addToMenu
window.addAccount = addAccount
window.saveSettings = saveSettings
window.editReservationAt = editReservationAt
window.removeReservationAt = removeReservationAt
window.removeAccountAt = removeAccountAt
window.onAccountItem = onAccountItem

import Sortable from './lib/sortable.esm.js'

function getThisWeekSunday() {
  const today = new Date();
  const day = today.getDay(); // 0 (일요일) ~ 6 (토요일)
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day); // 이번 주 일요일은 현재 날짜에서 day 만큼 빼면 됨
  sunday.setHours(0, 0, 0, 0); // 시간 초기화 (선택사항)
  return sunday;
}
function getNextCutoffDate(targetDate) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const date = targetDate.getDate();

  // 이번 달의 마지막 날
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (date === 15) {
    // 15일이면 → 그 달의 말일 반환
    return new Date(year, month, lastDayOfMonth);
  } else {
    // 말일이면 → 다음 달 15일 기준 주의 토요일 반환
    const nextMonth15th = new Date(year, month + 1, 15);
    const dayOfWeek = nextMonth15th.getDay(); // 0: 일 ~ 6: 토
    const diffToSaturday = 6 - dayOfWeek;
    const saturday = new Date(nextMonth15th);
    saturday.setDate(nextMonth15th.getDate() + diffToSaturday);
    return saturday;
  }
}
function getTargetDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0~11
  const day = today.getDate();

  let target;

  if (day <= 4) {
    // 이번 달 15일
    target = new Date(year, month, 15);
  } else if (day <= 19) {
    // 이번 달 말일 (다음 달 0일)
    target = new Date(year, month + 1, 0);
  } else {
    // 다음 달 15일
    target = new Date(year, month + 1, 15);
  }

  return target;
}
function makeCalendar() {
  let today = new Date()
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let d = getThisWeekSunday()
  let td = getTargetDate()
  let end = getNextCutoffDate(td)
  // console.log({today, d, end, td})
  let html = ''
  document.querySelector('#year_month').innerText = `${d.getFullYear()}.${d.getMonth()+1}`
  while (d <= end) {
    let arg = 'class="no"'
    if (today <= d) {
      const ymd = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
      if (d <= td) {
        arg = `class="date on week${d.getDay()}" data-date="${ymd}"`
      } else {
        arg = `class="date no" data-date="${ymd}"`
      }
    }
    // console.log(d, td, arg)
    const month = d.getMonth() + 1
    let day = d.getDate()
    if (day == 1) {
      day = `${month}/${day}`
    }
    // console.log(arg)
    html += `<li ${arg}><p>${day}</p></li>`

    // 날짜를 하루 증가
    d.setDate(d.getDate() + 1);
  }
  while (d.getDay() != 0) {
    html += '<li><p></p></li>'
    d.setDate(d.getDate() + 1);
  }
  const dates_ul = document.querySelector('.calendar ul.dates')
  // console.log(html)
  dates_ul.innerHTML = html
}
function makeHours() {
  let hour = 6
  const end = 23
  let html = ''
  while (hour <= end) {
    const hour_str = hour.toString().padStart(2, '0') + ':00';
    html += `
      <div class="hour-item" id="hour_item_${hour}">
        <input type="radio" id="hour_radio_${hour}" name="hour_start" value="${hour}">
        <label for="hour_radio_${hour}">${hour_str}</label>
      </div>
    `
    hour += 1
  }
  document.querySelector('.time-select-box').innerHTML = html
}
function hilightHours() {
  const $hour = $('.hour-item input[type="radio"]:checked')
  if ($hour.length == 0) return;

  $('.hour-item.ok').removeClass('ok')

  const hours = $('input.hours-radio[type="radio"]:checked').val()
  const hour = Number($hour.val())

  // console.log({hour,hours})
  $(`#hour_item_${hour}`).addClass('ok')
  if (hours > 1) {
    $(`#hour_item_${hour+1}`).addClass('ok')
  }
}
let tempOutput = []
function updateTempOutput() {
  tempOutput = []
  const $target = $('li.court.ok');
  const court = $target.data().court
  const $hours = $('input.hours-radio[type="radio"]:checked')
  let hours = Number($hours.val())
  const $start = $('.hour-item.ok input')
  const start = Number($start.val())
  if (!court || !hours || !start) {
    return
  }
  if (start == 23) hours = 1;
  const dates = $('.date.ok').map((i, el) => $(el).data().date).get();
  for (const date of dates) {
    tempOutput.push({
      court,
      date: String(date),
      start: start,
      time: start.toString().padStart(2, '0') + ':00',
      hours,
    })
  }
  //console.log(tempOutput)
  document.querySelector('.temp-output-box').innerHTML = tempOutput.map((r)=>{
    return `<div class="output-item">${reservationItemToString(r)}</div>`
  }).join('\n')
}
function addToMenu() {
  const $account = $('.account-item.active')
  const accountIndex = Number($account.attr('id').match(/\d+/)[0])
  const user_id = config.sessions[accountIndex].user_id

  const added = tempOutput.map(r=>{return {...r, user_id}})
  let reservations = [...config.reservations, ...added]

  console.log(reservations)

  // 중복 제거: date + time + court 기준
  const seen = new Set();
  reservations = reservations.filter(item => {
    const key = `${item.date}-${item.time}-${item.court}`;
    console.log(key, seen)
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(reservations)

  const hours = {}
  for (const item of reservations) {
    if (!item.user_id) continue;
    const key = `${item.user_id}-${item.date}`
    if (!hours[key]) hours[key] = 0;
    hours[key] += item.hours
    if (hours[key] > 2) {
      const msg = `${hours[key]} hours for ${item.user_id}`
      alert(msg)
      return
    }
  }

  config.reservations = reservations

  updateReservations()
}
let config = null
function fillConfig(cfg) {
  config = cfg
  removePastReservations()
  updateReservations()
  updateAccounts()
  $('#groupName').val(cfg.groupName)
  $('#groupCount').val(cfg.groupCount)
}
function removePastReservations() {
  const now = new Date()
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const now_ymd = year * 10000 + month * 100 + day
  config.reservations = config.reservations.filter(item => {
    console.log(item.date, Number(item.date) >= now_ymd)
    return Number(item.date) >= now_ymd
  });
}
function updateReservations() {
  document.querySelector('.menu-parent').innerHTML = config.reservations.map((r, i)=>{
    return `
      <div class="menu-wrapper">
        <div class="menu-item" onclick="editReservationAt(${i})">${reservationItemToString(r)}</div>
        <div class="menu-action">
          <button type="button" class="btn-close" aria-label="Close" onclick="removeReservationAt(${i})"></button>
        </div>
      </div>
    `
  }).join('\n')
}
function editReservationAt(i) {
  const r = config.reservations[i]

  $('li.court.ok').removeClass('ok')
  const $court = $(`.court[data-court="${r.court}"]`);
  $court.addClass('ok')

  $('li.date.ok').removeClass('ok')
  const $date = $(`.date[data-date="${r.date}"]`);
  $date.addClass('ok')

  $(`#hour${r.hours}`).prop('checked', true)

  $('div.hour-item.ok').removeClass('ok')
  const hour = Number(r.time.split(':')[0])
  $(`#hour_item_${hour}`).addClass('ok')
  $(`#hour_radio_${hour}`).prop('checked', true)

  updateTempOutput()
}
function removeReservationAt(i) {
  if (i >= 0 && i < config.reservations.length) {
    config.reservations.splice(i, 1);
  }
  updateReservations()  
}
function onAccountItem(index) {
  $('.account-item.active').removeClass('active')
  $(`#account_item_${index}`).addClass('active')
}
function updateAccounts() {
  document.querySelector('.account-parent').innerHTML = config.sessions.map((s, i)=>{
    const active = i == 0 ? ' active' : ''
    return `
      <div class="account-wrapper">
        <div class="account-item${active}" id="account_item_${i}" onclick="onAccountItem(${i})">
          <label class="label-for-input" for="account_id_${i}">ID:</label>
          <input class="form-control" type="text" id="account_id_${i}" size="10" value="${s.user_id}"></input>
          <label class="label-for-input" for="account_pw_${i}">Password:</label>
          <input class="form-control" type="password" id="account_pw_${i}" size="15" value="${s.user_pw}"></input>
        </div>
        <div class="account-action">
          <button type="button" class="btn-close" aria-label="Close" onclick="removeAccountAt(${i})"></button>
        </div>
      </div>
    `
  }).join('\n')
}
function removeAccountAt(i) {
  if (i >= 0 && i < config.sessions.length) {
    config.sessions.splice(i, 1)
  }
  updateAccounts()
}
function addAccount() {
  config.sessions.push({
    user_id: '', user_pw: ''
  })
  updateAccounts()
}
function saveSettings() {
  let index = 0
  const sessions = []
  while (true) {
    const $id = $(`#account_id_${index}`)
    const $pw = $(`#account_pw_${index}`)
    if (!$id.length || !$pw.length) {
      console.log(index, 'not found')
      break
    }
    const user_id = $id.val().trim()
    const user_pw = $pw.val()
    if (user_id != '' && user_pw != '') {
      sessions.push({ user_id, user_pw })
    } else {
      console.log({user_id, user_pw})
    }
    index += 1
  }
  config.sessions = sessions
  if (!window.settingsAPI) {
    console.log('this window is not from electron')
    console.log(config)
    updateAccounts()
    return
  }
  config.groupName = $('#groupName').val()
  config.groupCount = Number($('#groupCount').val())
  if (config.groupName.trim() == '') {
    config.groupName = 'Tennis'
  }
  if (!config.groupCount || config.groupCount < 1 || config.groupCount > 4) {
    config.groupCount = 4
  }

  window.settingsAPI.save(config)
  window.close()
}
function onLoad() {
  makeCalendar()
  makeHours()

  const $court1 = $('.court[data-court="1"]');
  $court1.addClass('ok')

  $('li.court').click((e)=>{
    const $target = $(e.currentTarget);
    const court = $target.data().court
    $('li.court.ok').removeClass('ok')
    $target.addClass('ok')
    updateTempOutput()
  })
  $('li.weekday').click((e)=>{
    const $target = $(e.currentTarget);
    const withoutShift = !e.shiftKey
    if (withoutShift) $('li.date.ok').removeClass('ok');
    $(`.week${$target.data().week}`).addClass('ok')
    updateTempOutput()
  })
  $('li.date').click((e)=>{
    const withoutShift = !e.shiftKey
    const $target = $(e.currentTarget);
    if (withoutShift) {
      $('li.date.ok').removeClass('ok');
    } else {
      // console.log($target.hasClass('ok'))
      if ($target.hasClass('ok')) {
        $target.removeClass('ok')
        updateTempOutput()
        return
      }
    }
    $target.addClass('ok')
    updateTempOutput()
  })
  $('input.hours-radio').click((e)=>{
    hilightHours()
    updateTempOutput()
  })
  $('.hour-item input').click((e)=>{
    hilightHours()
    updateTempOutput()
  })
  new Sortable(
    document.querySelector('.menu-parent'),
    { 
      animation: 150,
      onEnd(evt) {
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;

        // 배열 재정렬 (핵심)
        const moved = config.reservations.splice(oldIndex, 1)[0];
        config.reservations.splice(newIndex, 0, moved);

        //console.log("새 reservations:", reservations);
      }
    }
  )
  fillConfig({
      "groupName": "굿맨",
      "groupCount": 4,
      "!sessions": [
          {
              "user_id": "scgyong",
              "user_pw": "zz"
          }
      ],
      "sessions": [
          {
              "user_id": "scgyong",
              "user_pw": "xzz/d"
          },
          {
              "user_id": "hongchs",
              "user_pw": "css!"
          }
      ],
      "reservations": [
          {
              "court": 5,
              "date": "20250814", 
              "time": "08:00",
              "hours": 2
          },
          {
              "court": 5,
              "date": "20250815", 
              "time": "12:00",
              "hours": 2
          },
          {
              "court": 5,
              "date": "20250816", 
              "time": "15:00",
              "hours": 2
          }
      ]
  })
}

