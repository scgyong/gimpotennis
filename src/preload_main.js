try {
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('electronAPI', {
    onAjaxComplete: (info) => ipcRenderer.send('ajax-complete', info),
    onOrderAlert: (info) => ipcRenderer.send('order-alert', info),
    onTimeCheck: (user_id, success) => ipcRenderer.invoke('timecheck', user_id, success),
  });
  console.log('[preload] loaded');
} catch (e) {
  console.error('[preload] contextBridge error:', e);
}

// --- preload가 로드되자마자 즉시 실행 (DOM 이전) ---
(function() {
  try {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
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
        } catch (e) {
          console.error("[PATCH] alert error:", e);
        }
      })();
    `;
    const target = document.documentElement || document.head || document.body;
    if (target) {
      target.prepend(script);
      script.remove();
    }
  } catch (e) {
    console.error('[preload] alert patch error:', e);
  }
})();

// --- DOMContentLoaded 후 AJAX 감지 설치 ---
window.addEventListener('DOMContentLoaded', () => {
  try {
    const script = document.createElement('script');
    script.textContent = `
(() => {
  const $ = window.jQuery || window.$;
  if ($ && $.ajax) {
    const origAjax = $.ajax;
    
    $.ajax = function(options) {
      const origComplete = options.complete;
      const url = options.url || (typeof options === 'string' ? options : '');
      const data = options.data || '';
      
      options.complete = function(xhr, status) {
        if (window.electronAPI && window.electronAPI.onAjaxComplete) {
          window.electronAPI.onAjaxComplete({
            url: url,
            payload: data,
            response: xhr.responseText,
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
    const target = document.documentElement || document.head || document.body;
    if (target) {
      target.appendChild(script);
      script.remove();
      console.log('[preload] injection done @', location.href);
    }
  } catch (e) {
    console.error('[preload] injection failed', e);
  }
});