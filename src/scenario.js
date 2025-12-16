const { Menu } = require('electron');

class Scenario {
    constructor() {
        this.index = -1
    }
    // start() {
    //     if (this.index >= 0) {
    //         console.log(`start() called while this.index=${this.index}`)
    //         return
    //     }
    //     this.index = -1
    //     this.next()
    // }
    next() {
        this.index += 1
        const menuId = `reserve-${this.index}`
        const menu = Menu.getApplicationMenu()
        const menuItem = menu.getMenuItemById(menuId)
        if (!menuItem) {
            this.endScenario()
            return
        }
        const label = `시나리오 - ${this.index+1}: ${menuItem.label}`
        this.updateMenuLabel(label)
        console.log({menuId, menuItem})
        menuItem.click()
    }
    endScenario() {
        this.index = -1
        this.updateMenuLabel('시나리오: 중지')
    }
    updateMenuLabel(text) {
        let item = Menu.getApplicationMenu()
            .getMenuItemById('scenarioStatus')
        console.log({item, text})
        if (item) {
            item.label = text
        }
    }
}

module.exports = new Scenario()
