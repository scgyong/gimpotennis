const scripts = require('./scripts')
const configLoader = require('./configLoader')
const scenario = require('./scenario')

const BASE_URL = 'http://www.gimposports.or.kr'
const ROOT_URL = `${BASE_URL}/`
const LOGIN_URL = `${BASE_URL}/bbs/login.php`
const MAIN_URL = `${BASE_URL}/bbs/orderCourse.php`
const ORDERS_URL = `${BASE_URL}/bbs/member_confirm.php?url=${BASE_URL}/bbs/orders_form.php`
const CONFIRM_URL = `${BASE_URL}/bbs/member_confirm.php`
const ORDER_ACTION = `${BASE_URL}/skin/orders/orderAction.php`
const http = require('http');

async function checkApi(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

class WebApi {
    async start(window, session) {
        this.triedLogin = false
        this.window = window
        this.session = session
        this.paymentWin = null
        console.log(`WebApi.start(${session.user_id})`)

        const this_webApi = this
        const res = await checkApi(`http://hdjd.cafe24app.com/gp/${session.user_id}`)
        if (res.allowed) {
            window.webContents.on('did-finish-load', ()=>this.onLoad())
            window.webContents.on('did-start-navigation', async (e, url, isInPlace, isMainFrame) => {
                if (!isMainFrame) return;
                this_webApi.prevUrl = this_webApi.currentUrl
                this_webApi.currentUrl = url
            })
        }

        window.loadURL(LOGIN_URL)
    }
    onLoad() {
        const currentUrl = this.window.webContents.getURL();
        console.log("onLoad(): ", currentUrl);
        if (currentUrl == LOGIN_URL) {
            if (this.triedLogin) { return }
            this.triedLogin = true
            const script = scripts.login(this.session.user_id, this.session.user_pw)
            // console.log(script)
            this.window.webContents.executeJavaScript(script)
        } else if (currentUrl == ROOT_URL) {
            this.window.loadURL(MAIN_URL)
        } else if (currentUrl.startsWith(CONFIRM_URL)) {
            this.window.webContents.executeJavaScript(scripts.confirm(this.session.user_pw))
        } else if (currentUrl == MAIN_URL) {
            console.log('prevUrl:', this.prevUrl)
            this.window.webContents.executeJavaScript(scripts.showCalendar())
            this.updateBookedState()
            // if (this.prevUrl.indexOf('/orderAction.php') >= 0) {
            //     setTimeout(()=>{
            //         scenario.next()
            //     }, 1000)
            // }
        } else if (currentUrl == ORDER_ACTION) {
            this.closePaymentWindow()
        }
    }
    setPaymentWindow(pwin) {
        this.closePaymentWindow()
        this.paymentWin = pwin
    }
    closePaymentWindow() {
        if (this.paymentWin) {
            this.paymentWin.close()
            this.paymentWin = null
        }
    }
    navigate(event, target) {
        console.log({navigate: target})
        if (target == 'login') {
            this.window.loadURL(LOGIN_URL)
        } else if (target == 'window') {
            this.window.loadURL(MAIN_URL)
        } else if (target == 'orders') {
            this.window.loadURL(ORDERS_URL)
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
            //console.log(script)
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
        console.log('Booking:', r)
        this.reservationData = r
        this.window.webContents.executeJavaScript(script)
    }
    async updateBookedState() {
        if (!this.reservationData) {
            console.log('No reservation Data on updateBookedState()')
            return
        }
        // console.log(this.reservationData)
        const ymd = this.reservationData.date
        const script = scripts.dateTimeslot(ymd)
        const result = await this.window.webContents.executeJavaScript(script)
        configLoader.markReserved(ymd, result)
    }
    onTimeCheck(success) {
        //console.log(`onTimeCheck(${success})`)
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
        console.log('in alreadyBooked(),', {slots, t:typeof(slots)})
        if (r.hours > 1) {
            const hour = Number(r.time.split(/:/)[0])+1
            const hour_str = hour.toString().padStart(2, '0') + ':00';
            if (slots[hour_str] == 'no') { 
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
