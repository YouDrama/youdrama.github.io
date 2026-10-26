export const DETAIL_ENDPOINT = 'https://drama2-api.thinkyeah.com/api/drama/detail';

function unavailable(state, reason) {
  return {state, reason};
}

function coverFor(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  const candidate = value.trim();

  try {
    if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
      const url = new URL(candidate);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
        return url.href;
      }
      return '';
    }

    const localPath = candidate.split(/[?#]/, 1)[0];
    const decodedPath = decodeURIComponent(localPath);
    if (localPath === '' || candidate.startsWith('//') || candidate.includes('\\') ||
        decodedPath.split('/').includes('..')) return '';
    const url = new URL(candidate, 'https://local.invalid/');
    if (url.origin === 'https://local.invalid') {
      return candidate;
    }
  } catch {
    return '';
  }

  return '';
}

function requestEndpoint(endpoint) {
  if (endpoint === DETAIL_ENDPOINT) return new URL(DETAIL_ENDPOINT);
  if (endpoint === '/api/drama/detail' && globalThis.location) {
    return new URL(endpoint, globalThis.location.origin);
  }
  throw new TypeError('Unsupported detail endpoint');
}

export async function loadDetail(search = '', {fetchImpl = globalThis.fetch, endpoint = DETAIL_ENDPOINT} = {}) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search.toString());
  const platform = params.get('platform') ?? 'self';
  const platformId = params.get('platform_id');
  const language = params.get('language') ?? 'en';

  if (platform !== 'self' || platformId === null || platformId.trim() === '') {
    return unavailable('missing', platform !== 'self' ? 'unsupported-platform' : 'missing-platform-id');
  }

  const url = requestEndpoint(endpoint);
  url.search = '';
  url.searchParams.set('platform', platform);
  url.searchParams.set('platform_id', platformId);
  url.searchParams.set('language', language);

  let response;
  try {
    response = await fetchImpl(url.href, {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
    });
  } catch {
    return unavailable('error', 'network-request-failed');
  }

  if (response.status === 404) {
    return unavailable('not-found', 'drama-not-found');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return unavailable('error', 'invalid-json-response');
  }
  if (payload?.code === 404000) return unavailable('not-found', 'drama-not-found');
  if (!response.ok || payload?.code !== 200 || !payload.data || typeof payload.data !== 'object' ||
      Array.isArray(payload.data) || typeof payload.data.name !== 'string' || payload.data.name.trim() === '') {
    return unavailable('error', 'unrecognized-detail-response');
  }

  const data = payload.data;
  // Confirmed against real detail responses for platform_id 1000192 and 999999 (2026-10-23).
  return {
    state: 'ready',
    drama: {
      id: platformId,
      title: data.name,
      description: typeof data.description === 'string' ? data.description : '',
      coverUrl: coverFor(data.cover),
      tags: Array.isArray(data.tags) ? data.tags.filter(tag => typeof tag === 'string') : [],
    },
  };
}
