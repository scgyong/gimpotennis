// main.js
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { WebApi } = require('./web_api')
const config = require('./config.json')

let webApiMap = {};
function getWebApiFromWindow(win) {
  for (const s in webApiMap) {
    const api = webApiMap[s]
    if (api.window == win) return api;
  }
  return null
}

function createWindows() {
  // Main reservation window (initially blank)
  for (const sess of config.sessions) {
    const win = new BrowserWindow({
      width: 1280,
      height: 960,
      icon: path.join(__dirname, 'ui/icon.icns'), // 또는 .ico/.icns
      webPreferences: {
        partition: sess.user_id,
        preload: path.join(__dirname, 'preload_main.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      console.log('결제 창 요청 URL:', url);

      // 새 BrowserWindow 생성
      const paymentWin = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          session: win.webContents.session, // ★ 동일 세션 공유
          preload: path.join(__dirname, 'preload_main.js'),
          contextIsolation: true,
          nodeIntegration: false,
          nativeWindowOpen: true
        }
      });

      paymentWin.loadURL(url);
      
      return { action: 'allow' }; // 원래 브라우저 새 창은 막음
    });

    //win.webContents.openDevTools();
    const web_api = new WebApi()
    web_api.start(win, sess)
    webApiMap[sess.user_id] = web_api
  }

  buildMenuFromReservations(config.reservations)
}

function fmtDate(yyyymmdd) {
  return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`;
}

function buildMenuFromReservations(reservations) {
  // 중복 제거(같은 court/date/time/hours 조합)
  const seen = new Set();
  const unique = reservations.filter(r => {
    const key = `${r.court}|${r.date}|${r.time}|${r.hours}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(reservations)
  console.log(unique)

  const reservationSubmenu = unique.map((r, idx) => ({
    id: `reserve-${idx}`,
    label: `${fmtDate(r.date)} • 코트 ${r.court} • ${r.time} • ${r.hours}시간`,
    click: () => {
      // 메인 윈도우로 선택 이벤트 전달 (렌더러/프리로드에서 받아 처리)
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        console.log('No focused Window')
        return
      }
      const web_api = getWebApiFromWindow(win)
      if (!web_api) {
        console.log('No associated web_api')
        return
      }
      web_api.onMenuReservation(r)
    }
  }));

  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
        }]
      : []),
    {
      label: '예약',
      submenu: [
        { label: '예약 목록', enabled: false },
        { type: 'separator' },
        ...reservationSubmenu,
        { type: 'separator' },
        {
            label: '환경설정…',
            accelerator: 'CmdOrCtrl+,',
            click: () => showSettings(BrowserWindow.getFocusedWindow())
        }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' }
  ];

  console.log(template)


  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

let settingsWindow; // 싱글턴

function showSettings(parentWin) {
  // 이미 열려 있으면 앞으로
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (!settingsWindow.isVisible()) settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  // 새로 만들기 (parent를 주면 모달처럼 UX 가능)
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '예약일/시간 설정',
    parent: parentWin || BrowserWindow.getFocusedWindow() || undefined,
    modal: true, // true로 하면 모달 동작
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload_settings.js'),
      contextIsolation: true,
      // 메인과 세션 공유(로그인/쿠키 필요하면)
      session: parentWin.webContents.session
    }
  });

  // 파일 또는 로컬 페이지 로드
  settingsWindow.loadFile(path.join(__dirname, 'ui/settings.html'));

  settingsWindow.on('closed', () => { settingsWindow = null; });
}

app.whenReady().then(createWindows);

ipcMain.handle('navigate', (event, user_id, target) => {
  const web_api = webApiMap[user_id]
  if (!web_api) {
    console.error(`WebApi not found for ${user_id}`)
    return
  }
  web_api.navigate(event, target)
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
