export function devicePlatform({userAgent='',platform='',maxTouchPoints=0}={}) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return null;
}
export function storeDestination(stores,platform,search='') {
  const configured=stores?.[platform];
  if (!configured) return null;
  const url=new URL(configured);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  const rawQuery=search.startsWith('?')?search.slice(1):search;
  if(platform==='android'&&url.hostname==='play.google.com'&&url.pathname==='/store/apps/details'&&rawQuery) {
    url.searchParams.set('referrer',rawQuery);
    return url.href;
  }
  return configured;
}

// Native store URLs are only selected for a detected mobile platform.
export function storeLaunchDestination(stores, detectedPlatform, search='') {
  const destination = storeDestination(stores, detectedPlatform ?? 'android', search);
  if (!destination) return null;
  const url = new URL(destination);
  if (detectedPlatform === 'ios' && ['apps.apple.com', 'itunes.apple.com'].includes(url.hostname)) {
    return destination.replace(/^https:/, 'itms-apps:');
  }
  if (detectedPlatform !== 'android' || url.hostname !== 'play.google.com' || url.pathname !== '/store/apps/details') return destination;
  return `intent://details${url.search}#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=${encodeURIComponent(destination)};end`;
}

export function createStoreNavigator(browserWindow) {
  let cancelPending = null;
  return function launchStore(stores, detectedPlatform, search='') {
    if (cancelPending) cancelPending();
    const destination = storeLaunchDestination(stores, detectedPlatform, search);
    if (!destination) return;
    if (!destination.startsWith('itms-apps:')) {
      browserWindow.location.assign(destination);
      return;
    }

    const fallback = storeDestination(stores, 'ios', search);
    const document = browserWindow.document;
    let timer;
    function cancel() {
      browserWindow.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      browserWindow.removeEventListener('pagehide', cancel);
      browserWindow.removeEventListener('blur', cancel);
      if (cancelPending === cancel) cancelPending = null;
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') cancel();
    }
    cancelPending = cancel;
    document.addEventListener('visibilitychange', onVisibility);
    browserWindow.addEventListener('pagehide', cancel);
    browserWindow.addEventListener('blur', cancel);
    timer = browserWindow.setTimeout(() => {
      const visible = document.visibilityState === 'visible';
      cancel();
      if (visible) browserWindow.location.assign(fallback);
    }, 2000);

    try {
      // Keep the initial native navigation inside the user's click gesture.
      browserWindow.location.assign(destination);
    } catch {
      cancel();
      browserWindow.location.assign(fallback);
    }
  };
}
