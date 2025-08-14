const fs = require('fs');
const path = require('path');

// let config = require('./config.json');
let config = null

function getConfig() {
  if (!config) {
    try {
      config = require('./config.json')

      // TODO:
      // const { app } = require('electron');
      // const userConfigPath = path.join(app.getPath('userData'), 'config.json');

    } catch {
      config = {
        sessions: [],
        reservations: []
      }
    }
  }
  if (config.sessions.length == 0) {
    config.sessions = [
      { user_id: 'unknown', user_pw: ''}
    ]
  }
  return config;
}

function reloadConfig() {
  delete require.cache[require.resolve('./config.json')];
  config = require('./config.json');
  if (reloadCallback) {
    reloadCallback()
  }
}

let reloadCallback = null
function setReloadCallback(cb) {
  reloadCallback = cb
}

function saveConfig(cfg) {
  // TODO:
  // const { app } = require('electron');
  // const userConfigPath = path.join(app.getPath('userData'), 'config.json');

  config = cfg

  const configPath = path.join(__dirname, 'config.json');
  console.log(configPath)
  console.log(config)

  // 저장
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

  if (reloadCallback) {
    reloadCallback()
  }
}

module.exports = { getConfig, reloadConfig, saveConfig, setReloadCallback };
