import './attribution.js';

let active = false;
let clickEvent = '';

export function startAttribution(config, appId) {
  if (active || config?.enabled !== true) return;
  if (typeof config.pixelId !== 'string' || !config.pixelId.trim() ||
      typeof config.adjustToken !== 'string' || !config.adjustToken.trim()) {
    console.warn('Attribution is enabled but pixelId or adjustToken is missing. Tracking was skipped.');
    return;
  }
  try {
    const task = window.AdAttribution.init({...config, appId});
    active = true;
    clickEvent = typeof config.clickEvent === 'string' ? config.clickEvent.trim() : '';
    void task.catch(error => console.warn('Attribution initialization failed.', error));
  } catch (error) {
    console.warn('Attribution initialization failed.', error);
  }
}

export function trackStoreClick(position, appId, platform) {
  if (!active || !clickEvent) return;
  try {
    window.AdAttribution.track(clickEvent, {position, app_id: appId, platform});
  } catch (error) {
    console.warn('Attribution click event failed.', error);
  }
}
