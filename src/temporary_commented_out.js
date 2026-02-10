/**
 * 임시 보관 파일: 비활성화된 DB 에러 캐싱 로직
 * 
 * 원래 preload_main.js에 포함되어 있던 코드
 * 필요시 다시 활성화할 수 있도록 보관 중
 * 
 * 사용 방법:
 * 1. 이 파일의 코드를 preload_main.js의 script.textContent에 복사-붙여넣기
 * 2. ERROR_PATTERNS, CACHE_TTL_MS 등의 설정값 활성화
 * 3. 캐싱 로직 주석 제거
 */

// ============================================================================
// 설정값
// ============================================================================
const ERROR_PATTERNS = [
  'mysql', 'mysqli', 'sqlstate', 'pdoexception',
  'you have an error in your sql syntax', 'warning:'
];
const ENABLE_LOG = true;
const CACHE_TTL_MS = 1000; // 1초

// ============================================================================
// 유틸리티 함수들
// ============================================================================

/**
 * 현재 시간 (ms)
 */
const now = () => Date.now();

/**
 * 캐시 저장소: key -> { body, status, headersObj, ts }
 */
const lastGood = new Map();

/**
 * MySQL 에러 문자열 판별
 */
const looksLikeMysqlError = (t) => {
  if (!t) return false;
  t = String(t).toLowerCase();
  return ERROR_PATTERNS.some(p => t.includes(p));
};

/**
 * body 직렬화 (다양한 타입 지원)
 * - string
 * - URLSearchParams
 * - FormData
 * - Blob/ArrayBuffer (무시)
 * - object
 */
const serializeBody = (body) => {
  try {
    if (!body) return '';
    if (typeof body === 'string') return body;

    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      return body.toString();
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      const parts = [];
      for (const [k, v] of body.entries()) parts.push(k + '=' + encodeURIComponent(String(v)));
      return parts.join('&');
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) return '';
    if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return '';

    if (typeof body === 'object') {
      const $ = window.jQuery || window.$;
      if ($ && typeof $.param === 'function') return $.param(body);
      return Object.keys(body).sort().map(k => k + '=' + encodeURIComponent(String(body[k]))).join('&');
    }
    return String(body);
  } catch { return ''; }
};

/**
 * fetch 요청의 고유 키 생성
 */
const makeKeyFromFetch = (url, init = {}) => {
  try {
    const u = typeof url === 'string' ? url : (url && url.toString()) || '';
    const m = (init && init.method ? init.method : 'GET').toUpperCase();
    const b = serializeBody(init && init.body);
    return m + ' ' + u + ' # ' + b;
  } catch { return 'GET ' + String(url); }
};

/**
 * XHR/jQuery 요청의 고유 키 생성
 */
const makeKeyFromXHR = (m, u, b='') => (String(m||'GET').toUpperCase() + ' ' + String(u||'') + ' # ' + serializeBody(b));

/**
 * Headers 객체 복제
 */
const cloneHeadersObj = (h) => {
  const out = {};
  try { for (const [k,v] of h.entries()) out[k]=v; } catch {}
  return out;
};

// ============================================================================
// fetch 패치 (TTL 선반영 + 에러시 캐시 대체)
// ============================================================================

const origFetch = window.fetch.bind(window);
if (ENABLE_LOG) console.log('[patch] fetch -> on', typeof origFetch);

window.fetch = async function(url, init = {}) {
  const key = makeKeyFromFetch(url, init);
  if (ENABLE_LOG) console.log('[patch] fetch call', key);

  // 1) 최근 TTL 내 캐시면 네트워크 우회
  const cached0 = lastGood.get(key);
  if (cached0 && (now() - cached0.ts) <= CACHE_TTL_MS) {
    if (ENABLE_LOG) console.log('[patch] fetch HIT ttl, use cache', key);
    return new Response(cached0.body, { status: 200, headers: cached0.headersObj || {} });
  }

  try {
    const res = await origFetch(url, init);
    const ct = (res.headers.get('content-type') || '');
    const isText = /html|text|json/i.test(ct);
    if (!res.ok || !isText) return res;

    const txt = await res.clone().text();

    if (looksLikeMysqlError(txt)) {
      if (cached0) {
        if (ENABLE_LOG) console.warn('[patch] fetch mysql-like, fallback cache', key);
        return new Response(cached0.body, { status: 200, headers: cached0.headersObj || {} });
      }
      return new Response('', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    // 정상 응답 저장(ts 포함)
    lastGood.set(key, { body: txt, status: res.status, headersObj: cloneHeadersObj(res.headers), ts: now() });
    return new Response(txt, { status: res.status, headers: cloneHeadersObj(res.headers) });

  } catch (e) {
    const cached = lastGood.get(key);
    if (cached) {
      if (ENABLE_LOG) console.warn('[patch] fetch failed, use cache', key, e?.message);
      return new Response(cached.body, { status: 200, headers: cached.headersObj || {} });
    }
    return new Response('', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
};

// ============================================================================
// jQuery $.ajax TTL 우회 + 정상 응답 캐시 갱신
// ============================================================================

(function wrapJqueryAjaxTTL(){
  const $ = window.jQuery || window.$;
  if (!$ || !$.ajax || $.__ajax_ttl_patched__) return;
  const origAjax = $.ajax;

  $.ajax = function(options){
    const url    = options.url || (typeof options === 'string' ? options : '');
    const method = (options.type || options.method || 'GET').toUpperCase();
    const data   = options.data || '';
    const key    = makeKeyFromXHR(method, url, data);

    console.log({key})

    const cached = lastGood.get(key);
    if (cached && (now() - cached.ts) <= CACHE_TTL_MS) {
      if (ENABLE_LOG) console.log('[patch] $.ajax HIT ttl, use cache', key);
      const dfd = $.Deferred();
      setTimeout(() => {
        options.success && options.success(cached.body, 'success', null);
        options.complete && options.complete(null, 'success');
        dfd.resolve(cached.body, 'success', null);
      }, 0);
      return dfd.promise();
    }

    // 정상 응답 수신 시 캐시(ts) 갱신 (에러 HTML은 저장 안 함)
    const origSuccess = options.success;
    options.success = function(data, status, xhr){
      if (typeof data === 'string' && !looksLikeMysqlError(data)) {
        lastGood.set(key, { body: data, status: 200, headersObj: {}, ts: now() });
        if (url.indexOf('timeBoard4.php') >= 0) {
          window.electronAPI.onTimeboard({url:options.url, data:options.data}, data)
        }
      }
      return origSuccess && origSuccess.call(this, data, status, xhr);
    };

    return origAjax.call(this, options);
  };

  $.__ajax_ttl_patched__ = true;
  if (ENABLE_LOG) console.log('[patch] $.ajax ttl wrapper on');
})();

// ============================================================================
// XHR 패치 (에러 응답 치환 + 캐시 갱신)
// ============================================================================

const OrigXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function PatchedXHR() {
  const xhr = new OrigXHR();
  let _m = 'GET', _u = '', _b;

  const origOpen = xhr.open;
  xhr.open = function(method, url, ...rest) {
    _m = method; _u = url;
    if (ENABLE_LOG) console.log('[patch] XHR open', method, url);
    return origOpen.call(this, method, url, ...rest);
  };

  const origSend = xhr.send;
  xhr.send = function(body) {
    _b = body;

    const onRS = () => {
      try {
        if (xhr.readyState !== 4) return;
        const key = makeKeyFromXHR(_m, _u, _b);
        const ctype = xhr.getResponseHeader && (xhr.getResponseHeader('content-type') || '');
        const isText = /html|text|json/i.test(String(ctype||''));
        const ok = (xhr.status >= 200 && xhr.status < 300);

        if (ok && isText) {
          const txt = xhr.responseText;
          if (looksLikeMysqlError(txt)) {
            const cached = lastGood.get(key);
            if (cached) {
              if (ENABLE_LOG) console.warn('[patch] XHR using cached response for', key);
              try { Object.defineProperty(xhr, 'responseText', { configurable: true, value: cached.body }); } catch {}
              try { Object.defineProperty(xhr, 'response',     { configurable: true, value: cached.body }); } catch {}
            } else {
              if (ENABLE_LOG) console.warn('[patch] XHR mysql-like error, no cache for', key);
              try { Object.defineProperty(xhr, 'responseText', { configurable: true, value: '' }); } catch {}
              try { Object.defineProperty(xhr, 'response',     { configurable: true, value: '' }); } catch {}
            }
          } else {
            // 정상 응답 캐시(ts 포함)
            lastGood.set(key, { body: txt, status: xhr.status, headersObj: {}, ts: now() });
          }
        }
      } catch (e) {
        if (ENABLE_LOG) console.error('[patch] XHR interceptor error', e);
      }
    };

    try { xhr.addEventListener('readystatechange', onRS, true); } catch {}
    return origSend.call(this, body);
  };

  return xhr;
};

if (ENABLE_LOG) console.log('[patch] fetch/$.ajax/XHR patched in Main World');
