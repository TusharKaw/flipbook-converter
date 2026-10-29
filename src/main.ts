import './style.css';
import { PageFlip } from 'page-flip';
import { unlockPageSound, playPageSound } from './page-sound';
import { createAudioBook } from './audio-book';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const base = import.meta.env.BASE_URL;
const imageUrl = (page: number) => `${base}book/${String(page).padStart(3, '0')}.webp`;
const storageKey = 'vidhan-chetna-2026-03-page';
const input = $<HTMLInputElement>('page-input');
const book = $('book');
const loaded = new Set<number>();
let count = 208;
let current = 0;
let flip: PageFlip;
let ready = false;
const lastVisiblePage = () => Math.min(count - 1, current + (flip.getOrientation() === 'landscape' && current > 0 && current < count - 1 ? 1 : 0));
const audiobook = createAudioBook({
  page: () => current, lastVisible: lastVisiblePage, count: () => count,
  next: forward, settled: () => ready && ['read', 'fold_corner'].includes(flip.getState()),
});
// Browsers permit audio after a real click, touch, or keyboard gesture.
document.addEventListener('pointerdown', unlockPageSound, { capture: true });
document.addEventListener('keydown', unlockPageSound, { capture: true });

function savedPage() {
  const hash = location.hash.match(/^#page=(\d+)$/);
  if (hash) return Number(hash[1]);
  try { return Number(localStorage.getItem(storageKey)) || 1; } catch { return 1; }
}
function loadNearby() {
  // Bound decoded image memory while preloading both sides of every upcoming turn.
  for (const index of loaded) {
    if (Math.abs(index - current) <= 12) continue;
    book.querySelector<HTMLImageElement>(`img[data-page="${index + 1}"]`)?.removeAttribute('src');
    loaded.delete(index);
  }
  for (let index = Math.max(0, current - 4); index <= Math.min(count - 1, current + 7); index++) {
    if (loaded.has(index)) continue;
    const image = book.querySelector<HTMLImageElement>(`img[data-page="${index + 1}"]`);
    if (image) { image.src = imageUrl(index + 1); loaded.add(index); }
  }
}
function updatePage() {
  current = flip.getCurrentPageIndex();
  const landscape = flip.getOrientation() === 'landscape';
  $('book-wrap').classList.toggle('cover', current === 0 && landscape);
  $('book-wrap').classList.toggle('back-cover', current === count - 1 && landscape);
  input.value = String(current + 1);
  $('announcement').textContent = `Page ${current + 1} of ${count}`;
  for (const id of ['back', 'first']) $<HTMLButtonElement>(id).disabled = current === 0;
  const lastVisible = Math.min(count - 1, current + (landscape && current > 0 && current < count - 1 ? 1 : 0));
  for (const id of ['forward', 'last']) $<HTMLButtonElement>(id).disabled = lastVisible === count - 1;
  try { localStorage.setItem(storageKey, input.value); } catch { /* Storage can be disabled. */ }
  history.replaceState(null, '', `#page=${current + 1}`);
  loadNearby();
  audiobook.pageChanged();
}
function jump(page: number) {
  if (!ready || !Number.isFinite(page)) return;
  flip.turnToPage(Math.max(0, Math.min(count - 1, Math.round(page) - 1)));
  updatePage();
  audiobook.pageChanged(Math.max(0, Math.min(count - 1, Math.round(page) - 1)));
}
function forward() { if (ready && flip.getState() !== 'flipping') { loadNearby(); flip.flipNext(); } }
function backward() { if (ready && flip.getState() !== 'flipping') flip.flipPrev(); }
$('forward').onclick = forward;
$('back').onclick = backward;
$('first').onclick = () => jump(1);
$('last').onclick = () => jump(count);
$('page-form').onsubmit = event => { event.preventDefault(); jump(Number(input.value)); input.blur(); };
window.addEventListener('hashchange', () => jump(savedPage()));
window.addEventListener('keydown', event => {
  if ((event.target as HTMLElement).matches('input, textarea, select') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); forward(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); backward(); }
  if (event.key === 'Home') { event.preventDefault(); jump(1); }
  if (event.key === 'End') { event.preventDefault(); jump(count); }
});

async function init() {
  try {
    const response = await fetch(`${base}book/manifest.json`);
    if (!response.ok) throw new Error('Page assets are missing. Run npm run convert first.');
    const manifest = await response.json();
    count = manifest.pages;
    if (!Number.isInteger(count) || count < 1) throw new Error('Invalid book manifest.');
    input.max = String(count);
    $('page-total').textContent = `/ ${count}`;
    current = Math.max(0, Math.min(count - 1, savedPage() - 1));
    for (let index = 0; index < count; index++) {
      const page = document.createElement('div');
      page.className = 'page';
      page.dataset.density = index === 0 || index === count - 1 ? 'hard' : 'soft';
      const image = new Image();
      image.dataset.page = String(index + 1);
      image.alt = `Page ${index + 1}`;
      image.decoding = 'async';
      image.draggable = false;
      page.append(image);
      book.append(page);
    }
    loadNearby();
    await Promise.all([current + 1, Math.min(count, current + 2)].map(page =>
      book.querySelector<HTMLImageElement>(`img[data-page="${page}"]`)?.decode()
    ));
    const stage = $('stage');
    function measure() {
      const mobile = stage.clientWidth <= 600;
      const availableWidth = stage.clientWidth - (mobile ? 24 : 56);
      const availableHeight = stage.clientHeight - (mobile ? 105 : 124);
      const width = Math.floor(Math.min(availableWidth / (mobile ? 1 : 2), availableHeight * manifest.width / manifest.height));
      return { width, height: Math.round(width * manifest.height / manifest.width), mobile };
    }
    function sizeBook(dimensions: ReturnType<typeof measure>) {
      book.style.width = `${dimensions.width * (dimensions.mobile ? 1 : 2)}px`;
      book.style.height = `${dimensions.height}px`;
      book.style.minWidth = `${dimensions.width}px`;
      book.style.minHeight = book.style.height;
    }
    const dimensions = measure();
    sizeBook(dimensions);
    flip = new PageFlip(book, {
      width: dimensions.width, height: dimensions.height,
      size: 'fixed', startPage: current, showCover: true, usePortrait: true,
      flippingTime: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 950,
      maxShadowOpacity: .24, drawShadow: true, mobileScrollSupport: true,
      showPageCorners: true, useMouseEvents: false, swipeDistance: 25, autoSize: false,
    });
    let sounded = false;
    flip.on('changeState', event => {
      if (event.data === 'read') sounded = false;
      if ((event.data === 'flipping' || event.data === 'user_fold') && !sounded) {
        sounded = true;
        playPageSound();
      }
    });
    flip.on('flip', updatePage);
    flip.on('changeOrientation', () => { if (ready) updatePage(); });
    flip.on('init', () => { ready = true; updatePage(); $('loading').hidden = true; });
    flip.loadFromHTML(document.querySelectorAll<HTMLElement>('#book .page'));
    void audiobook.load(base);
    // Immediate touch/mouse tracking with pointer capture; no touch-and-hold delay.
    const surface = book.querySelector<HTMLElement>('.stf__block')!;
    let pointer: { id: number; x: number; y: number; time: number } | null = null;
    const position = (event: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    surface.addEventListener('pointerdown', event => {
      if (!ready || !event.isPrimary || event.button !== 0 || flip.getState() === 'flipping') return;
      const point = position(event);
      pointer = { id: event.pointerId, ...point, time: performance.now() };
      loadNearby();
      surface.setPointerCapture(event.pointerId);
      surface.classList.add('dragging');
      flip.startUserTouch(point);
    });
    surface.addEventListener('pointermove', event => {
      if (!ready || (pointer && pointer.id !== event.pointerId)) return;
      flip.userMove(position(event), event.pointerType !== 'mouse');
    });
    const release = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const point = position(event);
      const dx = point.x - pointer.x;
      const quickSwipe = event.type !== 'pointercancel' && event.pointerType !== 'mouse'
        && Math.abs(dx) > 35 && Math.abs(point.y - pointer.y) < 70
        && performance.now() - pointer.time < 300;
      flip.userStop(point, quickSwipe);
      if (quickSwipe) dx < 0 ? flip.flipNext() : flip.flipPrev();
      pointer = null;
      surface.classList.remove('dragging');
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
    let resizeTimer: ReturnType<typeof setTimeout>;
    new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!ready) return;
        const dimensions = measure();
        sizeBook(dimensions);
        Object.assign(flip.getSettings(), { width: dimensions.width, height: dimensions.height });
        flip.update();
        updatePage();
      }, 100);
    }).observe(stage);
  } catch (error) {
    console.error(error);
    $('loading').textContent = error instanceof Error ? error.message : 'Could not open the book. Please refresh.';
  }
}
void init();
