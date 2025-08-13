// # scripts.js
const config = require('./config')

const re_date = /^\d{8}$/;
const re_time = /^(\d{2}):00$/;

class Scripts {
    login(uid, upw) {
        return `
            document.querySelector('#login_id').value='${uid}'
            document.querySelector('#login_pw').value='${upw}'
            document.flogin.submit()
        `
    }
    confirm(upw) {
        return `
            document.querySelector('#confirm_mb_password').value='${upw}'
            document.fmemberconfirm.submit()
        `
    }
    reservation(r) {
        const names = [
            '', 'A관', 'B관', 'C관', 'D관', 'E관', 'F관', 'G관', 'H관'
        ]
        const sRoom = names[r.court] ?? names[1]
        const hourRadio = r.hours > 1 ? 'selectTim02' : 'selectTim01'
        const hours = r.hours > 1 ? 2 : 1
        if (!re_date.test(r.date)) {
            console.log('Date format is incorrect')
            return
        }
        if (!re_time.test(r.time)) {
            console.log('Time format is incorrect')
            return
        }
        let time2 = ''
        if (hours > 1) {
            const [hh, mm] = r.time.split(':').map(Number);
            const newHour = hh + 1
            if (newHour > 23) {
                console.log('Time 23:00 and 2 hours is incorrect')
                return
            }
            time2 = `${String(newHour).padStart(2, '0')}:00`;
        }

        return `
            reservForm.sRoom.value = '${sRoom}';
            checkVlas.value = 'Y';
            ${hourRadio}.checked = true;
            reservForm.timers.value = ${hours};
            reservForm.dateYmd.value = '${r.date}';
            reservForm.dateTime.value = '${r.time}';
            reservForm.dateTime2.value = '${time2}';
            reservWriteFunc()

            document.querySelector('#xieyi').click()
            document.querySelector('#teamName').value = "${config.groupName}"
            document.querySelector('#teamCnt').value = ${config.groupCount}
            document.querySelector('#area1').click()
            document.querySelector('#payGubunTypes1').click()
            
            reservFormSubFunc()

        `
            // ` 예제: 
            //     reservForm.sRoom.value='E관'
            //     checkVlas.value = 'Y'
            //     selectTim02.checked = true
            //     reservForm.timers.value=2
            //     reservForm.dateYmd.value='20250814'
            //     reservForm.dateTime.value='08:00'
            //     reservForm.dateTime2.value='02:00'
            //     reservWriteFunc()
            // `
    }
    openReservationWindow() {
        //reservWriteFunc()
    }

}

const scripts = new Scripts()

module.exports = scripts

