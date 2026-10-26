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
