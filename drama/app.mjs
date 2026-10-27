import {startAttribution,trackStoreClick} from './landing-attribution.mjs';
import {loadDetail} from './detail.mjs';
import {validateAppConfig} from './app-config.mjs';
import {devicePlatform,createStoreNavigator} from './navigation.mjs';

const byTestId = id => document.querySelector(`[data-testid="${id}"]`);
const byAction = action => document.querySelector(`[data-action="${action}"]`);
const status = document.querySelector('[role="status"]');
const retryButton = byAction('retry');
const cover = byTestId('drama-cover');
const placeholder = byTestId('cover-placeholder');
const backdrop = byTestId('backdrop');
const synopsis = byTestId('drama-description');

function updateSynopsisFade() {
  synopsis.dataset.moreBelow = String(synopsis.scrollHeight - synopsis.clientHeight - synopsis.scrollTop > 1);
}
synopsis.addEventListener('scroll', updateSynopsisFade, {passive: true});
new ResizeObserver(updateSynopsisFade).observe(synopsis);
const previewMode = document.querySelector('meta[name="preview-mode"]').content === 'true';
const endpoint = document.querySelector('meta[name="detail-endpoint"]').content;

const launchStore = createStoreNavigator(window);
let appConfig;

function setState(state, message = '') {
  document.body.dataset.state = state;
  status.textContent = message;
}

function navigate(detectedPlatform) {
  launchStore(appConfig.stores,detectedPlatform,window.location.search);
}
function openStore(position) {
  const detectedPlatform = devicePlatform(navigator);
  trackStoreClick(position, appConfig.id, detectedPlatform ?? 'android');
  navigate(detectedPlatform);
}

function applyAppConfig(config) {
  appConfig = validateAppConfig(config);
  document.body.dataset.appId = appConfig.id;
  byTestId('app-name').textContent = appConfig.name;
  const logo = byTestId('app-logo');
  logo.src = appConfig.logo;
  logo.alt = `${appConfig.name} logo`;
  logo.hidden = false;
  byAction('open').textContent = appConfig.labels.open;
  document.querySelector('.continue-button span').textContent = appConfig.labels.continue;

  const stops = appConfig.theme.gradient.stops
    .map(stop => `${stop.color} ${stop.position * 100}%`)
    .join(', ');
  document.body.style.setProperty(
    '--brand-gradient',
    `linear-gradient(${appConfig.theme.gradient.angle}deg, ${stops})`,
  );
  document.body.style.setProperty('--brand-text', appConfig.theme.textColor);

  for(const name of ['open','cover','continue']) {
    const action=byAction(name);action.disabled=false;action.removeAttribute('aria-disabled');action.onclick=()=>openStore(name);
  }
  document.querySelector('.continue-button .play-icon').style.backgroundColor=appConfig.theme.textColor;
  byTestId('preview-marker').hidden = !previewMode;
}

async function readAppConfig() {
  const response = await fetch('./app.json');
  if (!response.ok) throw new Error(`App settings could not be loaded (${response.status}).`);
  applyAppConfig(await response.json());
  startAttribution(appConfig.attribution, appConfig.id);
}

function setCoverPlaceholder(message = 'Cover unavailable') {
  cover.hidden = true;
  placeholder.hidden = false;
  placeholder.querySelector('span').textContent = message;
}

function bindCover(drama) {
  cover.alt = drama.title;
  cover.hidden = false;
  placeholder.hidden = false;
  placeholder.querySelector('span').textContent = 'Loading cover…';
  cover.addEventListener('load', () => {
    if (cover.naturalWidth > 0) {
      placeholder.hidden = true;
      backdrop.src = cover.currentSrc;
      backdrop.hidden = false;
    }
  }, {once: true});
  cover.addEventListener('error', () => {
    setCoverPlaceholder('Cover unavailable');
    backdrop.hidden = true;
  }, {once: true});
  if (drama.coverUrl) {
    cover.src = drama.coverUrl;
  } else {
    setCoverPlaceholder('Cover unavailable');
  }
}

function showDetail(result) {
  document.body.dataset.dramaId = result.drama.id;
  byTestId('drama-title').textContent = result.drama.title;
  byTestId('drama-description').textContent = result.drama.description || 'No description available.';
  const tags = byTestId('drama-tags');
  tags.replaceChildren();
  for (const value of result.drama.tags) {
    if (value.trim() === '') continue;
    const tag = document.createElement('span');
    tag.className = 'drama-tag';
    tag.textContent = value;
    tags.append(tag);
  }
  bindCover(result.drama);
  setState('ready');
  updateSynopsisFade();
}

function showResult(result) {
  if (result.state === 'ready') {
    retryButton.hidden = true;
    showDetail(result);
    return;
  }

  document.body.dataset.dramaId = '';
  byTestId('drama-title').textContent = '';
  byTestId('drama-description').textContent = '';
  byTestId('drama-tags').replaceChildren();
  setCoverPlaceholder(result.state === 'missing' ? 'Add a drama ID to show its cover' : 'Cover unavailable');
  retryButton.hidden = result.state !== 'error';

  if (result.state === 'missing') {
    setState('missing', 'Add platform_id to load this drama.');
  } else if (result.state === 'not-found') {
    setState('not-found', 'Drama not found.');
  } else {
    setState('error', 'Could not load drama details. Retry to try again.');
  }
}

async function requestDrama() {
  setState('loading', 'Loading drama details…');
  const result = await loadDetail(window.location.search, {endpoint});
  showResult(result);
}

retryButton.addEventListener('click', () => {
  void requestDrama();
});

function startAnimation() {
  const player=globalThis.lottie;
  if(!player)return;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation=player.loadAnimation({container:byTestId('hand'),renderer:'svg',loop:!reduceMotion,autoplay:!reduceMotion,path:'./lottie/finger-double-tap.json',rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
  if(reduceMotion)animation.addEventListener('DOMLoaded',()=>animation.goToAndStop(0,true));
}
async function start() {
  startAnimation();
  try {await readAppConfig();await requestDrama();}
  catch {retryButton.hidden=true;setCoverPlaceholder('Page settings unavailable');setState('error','Page settings could not be loaded. Please reload to try again.');}
}
void start();
