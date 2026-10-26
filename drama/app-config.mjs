const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hexColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

function validStore(value) {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

export function validateAppConfig(config) {
  if (!record(config) || config.schemaVersion !== 1 ||
      typeof config.id !== 'string' || !/^[a-z0-9-]+$/.test(config.id) ||
      typeof config.name !== 'string' || config.name.trim() === '' ||
      typeof config.logo !== 'string' || !/^(?:\.\/|\/)assets\/[a-zA-Z0-9._-]+$/.test(config.logo)) {
    throw new TypeError('Invalid app identity or logo configuration');
  }

  const theme = config.theme;
  const gradient = theme?.gradient;
  if (!record(theme) || !hexColor(theme.textColor) || !record(gradient) ||
      !Number.isFinite(gradient.angle) || gradient.angle < 0 || gradient.angle > 360 ||
      !Array.isArray(gradient.stops) || gradient.stops.length < 2) {
    throw new TypeError('Invalid app theme configuration');
  }

  let previousPosition = -1;
  for (const stop of gradient.stops) {
    if (!record(stop) || !hexColor(stop.color) || !Number.isFinite(stop.position) ||
        stop.position < 0 || stop.position > 1 || stop.position < previousPosition) {
      throw new TypeError('Invalid app gradient stop');
    }
    previousPosition = stop.position;
  }

  if (!record(config.labels) || typeof config.labels.open !== 'string' || config.labels.open.trim() === '' ||
      typeof config.labels.continue !== 'string' || config.labels.continue.trim() === '' ||
      !record(config.stores) || !validStore(config.stores.ios) || !validStore(config.stores.android)) {
    throw new TypeError('Invalid app labels or store destinations');
  }

  // Keep legacy /assets values local to this landing page under repository paths.
  return {...config, logo: config.logo.replace(/^\/assets\//, './assets/')};
}
