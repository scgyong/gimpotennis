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
    
    onTodayCheckComplete(info) {
        console.log('[WebApi] onTodayCheckComplete called with:', {date:info.payload.dateYmd, response:info.response});
        // todaycheck.php 응답 처리
        // 필요한 비즈니스 로직 추가
    }
    
    onTimeboardResult(info) {
        // console.log('[WebApi] onTimeboardResult called with:', info);
        
        const { payload, response } = info;
        if (!payload || !payload.orderDate) {
            console.warn('[WebApi] onTimeboardResult: no orderDate in payload');
            return;
        }
        
        // sRoom에서 코트 번호 추출 (예: "B관" -> 2)
        const courtName = payload.sRoom;
        const courtNum = courtName ? courtName.charCodeAt(0) - 'A'.charCodeAt(0) + 1 : null;
        
        if (!courtNum) {
            console.warn('[WebApi] onTimeboardResult: invalid sRoom', courtName);
            return;
        }
        
        // schedules_cache에 전달
        const schedules_cache = require('./schedules_cache');
        const resv = {
            date: payload.orderDate,
            court: courtNum
        };
        schedules_cache.parseTimeBoard(resv, response);
    }
    
    onAjaxComplete(info) {
        const { url } = info;
        // console.log('[WebApi] onAjaxComplete:', url);
        
        // todaycheck.php 처리
        if (url.includes('/skin/orders/todaycheck.php')) {
            this.onTodayCheckComplete(info);
        }
        
        // timeBoard4.php 처리
        if (url.includes('/skin/orders/timeBoard4.php')) {
            this.onTimeboardResult(info);
        }
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
            // alert 리스너 설치
            this.setupAlertListener()
            // if (this.prevUrl.indexOf('/orderAction.php') >= 0) {
            //     setTimeout(()=>{
            //         scenario.next()
            //     }, 1000)
            // }
        } else if (currentUrl == ORDER_ACTION) {
            this.closePaymentWindow()
        }
    }
    
    setupAlertListener() {
        const script = `
        (function() {
            const origAlert = window.alert;
            window.alert = function(msg) {
                console.log('[Renderer] alert:', msg);
                
                // orderAction.php 에서 온 alert만 관심 있음
                if (location.href.includes('orderAction.php')) {
                    if (msg.includes('이미예약된 데이터')) {
                        console.log('[Alert] ❌ 중복 예약');
                    } else if (msg.includes('예약이 완료되었습니다')) {
                        console.log('[Alert] ✅ 예약 성공');
                    } else {
                        console.log('[Alert] (기타)', msg);
                    }
                }
                
                return origAlert.call(window, msg);
            };
            console.log('[WebApi] alert listener installed');
        })();
        `;
        
        this.window.webContents.executeJavaScript(script);
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
        this.reservation = r
        this.window.webContents.executeJavaScript(script)
    }
    async updateBookedState() {
        if (!this.reservation) {
            console.log('No reservation Data on updateBookedState()')
            return
        }
        // console.log(this.reservation)
        const ymd = this.reservation.date
        const script = scripts.dateTimeslot(ymd)
        const result = await this.window.webContents.executeJavaScript(script)
        configLoader.markReserved(ymd, result)
    }
    onTimeCheck(arg) {
        if (arg?.success && arg?.responseText) {
            const schedules_cache = require('./schedules_cache')
            schedules_cache.parseTimeBoard(this.reservation, arg.responseText)
        }
        // TODO: schedules_cache에서 alreadyBooked 체크 후 재활성화
        if (this.alreadyBooked(this.reservation)) {
            this.showBooked(this.reservation)
            return
        }
        this.makeReservation(this.reservation)
    }
    alreadyBooked(r) {
        const schedules_cache = require('./schedules_cache');
        return schedules_cache.alreadyBooked(r);
    }
}

module.exports = { WebApi };
