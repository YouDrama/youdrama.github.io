(function (window, document) {
  if (window.AdAttribution) return;

  var pixelId = '';
  var landingTask = null;
  var pendingImages = new Set();
  var sdkUrl = 'https://connect.facebook.net/en_US/fbevents.js';

  function readCookie(name) {
    var prefix = name + '=';
    var item = document.cookie.split(';').map(function (value) {
      return value.trim();
    }).find(function (value) {
      return value.indexOf(prefix) === 0;
    });
    return item ? item.slice(prefix.length) : '';
  }

  function initializePixel(id) {
    if (!window.fbq) {
      var fbq = function () {
        if (fbq.callMethod) {
          fbq.callMethod.apply(fbq, arguments);
        } else {
          fbq.queue.push(Array.prototype.slice.call(arguments));
        }
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;
    }
    if (!window._fbq) window._fbq = window.fbq;

    if (!document.querySelector('script[src="' + sdkUrl + '"]')) {
      var script = document.createElement('script');
      script.async = true;
      script.src = sdkUrl;
      document.head.appendChild(script);
    }

    window.fbq('init', id);
  }

  function waitForBrowserId() {
    return new Promise(function (resolve) {
      var attempts = 0;
      function check() {
        if (readCookie('_fbp') || attempts >= 10) {
          resolve();
          return;
        }
        attempts += 1;
        window.setTimeout(check, 100);
      }
      check();
    });
  }

  function buildAdjustParams(entryQuery, timestamp, extraParams) {
    var query = new URLSearchParams(entryQuery);
    var params = new URLSearchParams();
    var ua = window.navigator.userAgent || '';
    var fbclid = query.get('fbclid') || '';
    var fbp = readCookie('_fbp');
    var fbc = readCookie('_fbc');

    if (!fbc && fbclid) {
      fbc = 'fb.1.' + timestamp + '.' + fbclid;
    }

    function set(name, value) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(name, String(value));
      }
    }

    set('campaign', query.get('c') || query.get('campaign'));
    set('adgroup', query.get('adset') || query.get('adgroup'));
    set('creative', query.get('ad') || query.get('creative'));
    set('fbclid', fbclid);

    if (/android/i.test(ua)) set('os_name', 'android');
    else if (/iPhone|iPad|iPod/i.test(ua)) set('os_name', 'ios');

    // 同一标识写入多个接收字段，接收方按约定使用。
    set('adj_sub1', fbp);
    set('fbpid', fbp);
    set('dc_fbp', fbp);
    set('adj_sub2', fbc);
    set('dc_fbc', fbc);
    set('adj_sub4', ua);
    set('dc_ua', ua);

    Object.keys(extraParams || {}).forEach(function (key) {
      set(key, extraParams[key]);
    });
    return params;
  }

  function sendAdjust(token, params, storageKey) {
    try {
      if (window.localStorage.getItem(storageKey) === 'true') return;
      // Mark the attempt before dispatch; image onerror may be a normal store redirect.
      window.localStorage.setItem(storageKey, 'true');
    } catch (error) {
      // Browsers can deny storage. The existing landingTask still deduplicates this page.
      window.console.warn('Adjust deduplication storage unavailable; refresh deduplication is disabled.');
    }
    var image = new window.Image();
    // 持有引用，直到请求结束。
    pendingImages.add(image);
    image.onload = image.onerror = function () {
      pendingImages.delete(image);
    };
    image.src = 'https://app.adjust.com/' + encodeURIComponent(token)
      + '?' + params.toString();
  }

  function init(options) {
    // 同一页面重复初始化时，复用第一次的调用。
    if (landingTask) return landingTask;
    options = options || {};
    var id = String(options.pixelId || '').trim();
    var token = String(options.adjustToken || '').trim();
    if (!id || !token) {
      throw new Error('请填写 pixelId 和 adjustToken。');
    }

    // 初始化时保存落地参数，避免后续页面操作修改 URL。
    var entryQuery = window.location.search;
    var timestamp = Date.now();
    var extraParams = Object.assign({}, options.extraParams || {});
    var scope = String(options.appId || window.location.pathname.replace(/[^/]*$/, ''));
    var storageKey = 'drama:adjust-sent:' + encodeURIComponent(scope) + ':' + encodeURIComponent(token);
    pixelId = id;
    initializePixel(pixelId);
    window.fbq('track', 'PageView');

    landingTask = waitForBrowserId().then(function () {
      window.fbq('track', 'ViewContent');
      var params = buildAdjustParams(entryQuery, timestamp, extraParams);
      sendAdjust(token, params, storageKey);
    });
    return landingTask;
  }

  function track(eventName, eventParams) {
    if (!pixelId) {
      throw new Error('请先调用 AdAttribution.init()。');
    }
    window.fbq('trackCustom', eventName, eventParams || {});
  }

  window.AdAttribution = { init: init, track: track };
})(window, document);
