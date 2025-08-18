const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const userConfigPath = path.join(app.getPath('userData'), 'config.json');
console.log({userConfigPath})

// let config = require('./config.json');
let config = null

function getConfig() {
  if (!config) {
    try {
      if (fs.existsSync(userConfigPath)) {
        const raw = fs.readFileSync(userConfigPath, 'utf8');
        config = JSON.parse(raw);
      }
    } catch (err) {
      console.error('❌ 설정 로드 실패:', err);
    }

    if (!config) {
      config = {
        groupName: "Tennis",
        groupCount: 4,
        sessions: [],
        reservations: []
      }
    }
  }
  if (config.enc_sessions) {
    const plain = safeStorage.decryptString(Buffer.from(config.enc_sessions, 'base64')); // 복호화
    // console.log(plain)
    config.sessions = JSON.parse(plain)
  }
  if (config.sessions.length == 0) {
    config.sessions = [
      { user_id: 'unknown', user_pw: ''}
    ]
  }
  if (typeof(config.checksAvailability) == 'undefined') {
    config.checksAvailability = true
  }

  return config;
}

function reloadConfig() {
  config = null
  getConfig()
  if (reloadCallback) {
    reloadCallback()
  }
}

let reloadCallback = null
function setReloadCallback(cb) {
  reloadCallback = cb
}

function saveConfig(cfg) {
  config = cfg
  const { sessions, ...cfgToSave } = cfg; // sessions 제외

  const sessions_json = JSON.stringify(sessions)
  const enc_sessions = safeStorage.encryptString(sessions_json).toString('base64');
  cfgToSave.enc_sessions = enc_sessions

  // 저장
  fs.writeFileSync(userConfigPath, JSON.stringify(cfgToSave, null, 4), 'utf8');

  if (reloadCallback) {
    reloadCallback()
  }
}

module.exports = { getConfig, reloadConfig, saveConfig, setReloadCallback };
