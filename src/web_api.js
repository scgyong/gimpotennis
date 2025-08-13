const scripts = require('./scripts')

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
        console.log('WebApi.start()')

        window.webContents.on('did-finish-load', ()=>this.onLoad())

        window.loadURL(LOGIN_URL)
    }
    onLoad() {
        const currentUrl = this.window.webContents.getURL();
        console.log("onLoad(): ", currentUrl);
        if (currentUrl == LOGIN_URL) {
            const script = scripts.login(this.session.user_id, this.session.user_pw)
            console.log(script)
            this.window.webContents.executeJavaScript(script)
        } else if (currentUrl == ROOT_URL) {
            this.window.loadURL(MAIN_URL)
        } else if (currentUrl.startsWith(CONFIRM_URL)) {
            this.window.webContents.executeJavaScript(scripts.confirm(this.session.user_pw))
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
        const script = scripts.reservation(r)
        console.log(script)
        this.window.webContents.executeJavaScript(script)
    }
}

module.exports = { WebApi }
