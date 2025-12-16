const hour_emoji = {
  6:  "🕕06",
  7:  "🕖07",
  8:  "🕗08",
  9:  "🕘09",
  10: "🕙10",
  11: "🕚11",
  12: "🕛12",
  13: "🕐13",
  14: "🕑14",
  15: "🕒15",
  16: "🕓16",
  17: "🕔17",
  18: "🕕18",
  19: "🕖19",
  20: "🕗20",
  21: "🕘21",
  22: "🕙22",
  23: "🕚23"
};

function fmtDate(yyyymmdd) {
  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);

  const date = new Date(`${year}-${month}-${day}`);

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];

  // return `${year}-${month}-${day}(${weekday})`;
  return `${month}/${day}(${weekday})`;
}

function reservationItemToString(r) {
  const start = Number(r.start) ?? Number(r.time.substring(0,2))
  // console.log(start, r.start, r.time)
  let time = hour_emoji[start]
  if (r.hours > 1) {
    time += '+'+hour_emoji[start+1]
  }
  const uid_str = r.user_id ? ` • ${r.user_id}` : ''
  return `${fmtDate(r.date)} • 코트 ${r.court} • ${time}${uid_str}`
}

module.exports = {
  reservationItemToString,
}
