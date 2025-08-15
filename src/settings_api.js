const path = require('path');
const configLoader = require('./configLoader')
const { ipcMain } = require('electron');

class SettingsApi {
    setWindow(window) {
        this.window = window
        // console.log(`SettingsApi.start(${window})`)
        if (!window) return;

        // 파일 또는 로컬 페이지 로드
        window.webContents.on('did-finish-load', ()=>this.onLoad())
        window.loadFile(path.join(__dirname, 'ui/settings.html'));
    }
    onLoad() {
        const config = configLoader.getConfig()
        this.window.webContents.executeJavaScript(`
            fillConfig(${JSON.stringify(config)})
        `)
    }
    save(event, cfg) {
        // console.log('cfg:', cfg)
        configLoader.saveConfig(cfg)
    }
}

module.exports = { SettingsApi }

