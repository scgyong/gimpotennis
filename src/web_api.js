const scripts = require('./scripts')
const configLoader = require('./configLoader')

const BASE_URL = 'http://www.gimposports.or.kr'
const ROOT_URL = `${BASE_URL}/`
const LOGIN_URL = `${BASE_URL}/bbs/login.php`
const MAIN_URL = `${BASE_URL}/bbs/orderCourse.php`
const CONFIRM_URL = `${BASE_URL}/bbs/member_confirm.php`

// const TOOLBAR_FILE = 'ui/toolbar.html'

class WebApi {
    start(window, session) {
        this.window = window
        this.session = session
        console.log(`WebApi.start(${session.user_id})`)

        window.webContents.on('did-finish-load', ()=>this.onLoad())

        window.loadURL(LOGIN_URL)
    }
    onLoad() {
        const currentUrl = this.window.webContents.getURL();
        // console.log("onLoad(): ", currentUrl);
        if (currentUrl == LOGIN_URL) {
            const script = scripts.login(this.session.user_id, this.session.user_pw)
            // console.log(script)
            this.window.webContents.executeJavaScript(script)
        } else if (currentUrl == ROOT_URL) {
            this.window.loadURL(MAIN_URL)
        } else if (currentUrl.startsWith(CONFIRM_URL)) {
            this.window.webContents.executeJavaScript(scripts.confirm(this.session.user_pw))
        } else if (currentUrl == MAIN_URL) {
            this.window.webContents.executeJavaScript(scripts.showCalendar())
        }
    }
    navigate(event, target) {
        console.log({navigate: target})
        if (target == 'login') {
            this.window.loadURL(LOGIN_URL)
        } else if (target == 'window') {
            this.window.loadURL(MAIN_URL)
        }
    }
    onMenuReservation(r) {
        const config = configLoader.getConfig()
        if (config.checksAvailability) {
            if (this.alreadyBooked(r)) {
                this.showBooked(r)
                return
            }
            this.reservation = r
            const script = scripts.checkTimeslot(this.session.user_id, r.court, r.date)
            console.log(script)
            this.window.webContents.executeJavaScript(script)
        } else {
            this.makeReservation(r)
        }
    }
    showBooked(r) {
        this.window.webContents.executeJavaScript(`alert("Already booked")`)
    }
    makeReservation(r) {
        if (this.alreadyBooked(r)) {
            this.showBooked(r)
            return
        }
        this.window.webContents.executeJavaScript(scripts.hilightDate(r.date))
        const script = scripts.reservation(r)
        console.log(script)
        this.window.webContents.executeJavaScript(script)
    }
    onTimeCheck(success) {
        console.log(`onTimeCheck(${success})`)
        this.makeReservation(this.reservation)
    }
    alreadyBooked(r) {
        const key = `${r.date}_${r.court}`
        const slots = timetable[key]
        if (!slots) return false;
        if (slots[r.time] == 'no') {
            console.log(`${r.date} ${r.time} Court ${r.court} is blocked`)
            return true;
        }
        if (r.hours > 1) {
            const hour = Number(r.time.split(/:/)[0])+1
            const hour_str = hour.toString().padStart(2, '0') + ':00';
            if (stots[hour_str] == 'no') { 
                console.log(`${r.date} ${r.time} Court ${r.court} is blocked`)
                return true;
            }
        }
        return false
    }
}

let timetable = {}

function handleTimeboard(opts, data) {
    const date = opts.data.orderDate
    const court = opts.data.sRoom[0].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    const slots = {}
    for (const line of data.split(/\n/)) {
        const m = line.match(/^\s*<label class="(on|no) labelDate" data="(\d{2}:\d{2})"/)
        if (!m) continue;
        slots[m[2]] = m[1]
    }
    const key = `${date}_${court}`
    const timeCount = Object.keys(slots).length
    if (timeCount > 0) {
        timetable[key] = slots
        console.log('timetable add:', {key, count: timeCount})
    }
    //console.log('timetable add:', {key})

    //console.log({opts, len:data.length})
}

module.exports = { WebApi, handleTimeboard }
