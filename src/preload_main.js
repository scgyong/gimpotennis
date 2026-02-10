const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onOrderAlert: (info) => ipcRenderer.invoke('order-alert', info),
  onAjaxComplete: (info) => ipcRenderer.invoke('ajax-complete', info),
});
// preload.js
console.log('[preload] loaded');

(function() {
  // 이 코드는 preload가 로드되자마자 즉시 실행됨 (DOM 이전)
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const origAlert = window.alert;
      window.alert = function(msg) {
        try {
          if (window.electronAPI && window.electronAPI.onOrderAlert) {
            window.electronAPI.onOrderAlert({ url: location.href, message: String(msg) });
          }
        } catch (e) { }
        return origAlert.call(window, msg);
      };
      console.log("[PATCH] alert installed at document-start", location.href);
    })();
  `;
  // documentElement 는 DOM 파싱 초기 단계에서 항상 존재함
  (document.documentElement || document.head || document.body).prepend(script);
  script.remove();
})();

// --- 메인 월드로 주입할 코드: AJAX 완료 감지 + alert 통보 ---
window.addEventListener('DOMContentLoaded', () => {
  try {
    const script = document.createElement('script');
    script.textContent = `
(() => {
  // ---- jQuery $.ajax 완료 감지 ----
  const $ = window.jQuery || window.$;
  if ($ && $.ajax) {
    const origAjax = $.ajax;
    
    $.ajax = function(options) {
      const origComplete = options.complete;
      const url = options.url || (typeof options === 'string' ? options : '');
      const data = options.data || '';
      
      options.complete = function(xhr, status) {
        // AJAX 완료 시 Main Process로 전달
        if (window.electronAPI && window.electronAPI.onAjaxComplete) {
          window.electronAPI.onAjaxComplete({
            url: url,
            payload: data,
            status: xhr.status,
            statusText: xhr.statusText
          });
        }
        
        return origComplete && origComplete.call(this, xhr, status);
      };
      
      return origAjax.call(this, options);
    };
    
    console.log('[patch] $.ajax wrapper installed');
  }
})();
    `;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
    console.log('[preload] injection done @', location.href);
  } catch (e) {
    console.error('[preload] injection failed', e);
  }
});

