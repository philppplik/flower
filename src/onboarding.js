import { TOUR_STEPS, hasSeenWelcome, rememberWelcome, placePopover } from './core/onboarding.js';

export function setupOnboarding({ setPanel, upload }) {
  const welcome = document.querySelector('#welcome-dialog');
  const tour = document.querySelector('#tour-dialog');
  const card = tour.querySelector('.tour-card');
  const highlight = tour.querySelector('.tour-highlight');
  let index = 0, returnFocus, revision = 0;
  const storage = (() => { try { return window.localStorage; } catch { return null; } })();
  function close() { revision++; if (tour.open) tour.close(); rememberWelcome(storage); setPanel('look'); returnFocus?.focus(); }
  function position() {
    if (!tour.open) return;
    const target = document.querySelector(TOUR_STEPS[index].target).getBoundingClientRect();
    const place = placePopover(target, { width: innerWidth, height: innerHeight }, { width: 350, height: card.offsetHeight });
    Object.assign(card.style, { left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px` });
    Object.assign(highlight.style, { left: `${target.left - 6}px`, top: `${target.top - 6}px`, width: `${target.width + 12}px`, height: `${target.height + 12}px` });
  }
  function showStep(next) {
    index = next; const step = TOUR_STEPS[index], current = ++revision;
    setPanel(step.panel);
    document.querySelector(step.target).scrollIntoView({ block: 'nearest', behavior: 'instant' });
    tour.querySelector('#tour-title').textContent = step.title;
    tour.querySelector('#tour-description').textContent = step.text;
    tour.querySelector('#tour-count').textContent = `${index + 1} / ${TOUR_STEPS.length}`;
    tour.querySelector('#tour-next').textContent = index === TOUR_STEPS.length - 1 ? 'Let’s make something ↗' : 'Next →';
    tour.querySelector('#tour-back').disabled = index === 0;
    requestAnimationFrame(() => { if (current === revision) position(); });
    tour.querySelector('#tour-next').focus({ preventScroll: true });
  }
  function start() {
    returnFocus = document.activeElement;
    welcome.close(); document.querySelector('#help-dialog').close();
    if (!tour.open) tour.showModal(); showStep(0);
  }
  welcome.querySelector('#welcome-tour').onclick = start;
  welcome.querySelector('#welcome-skip').onclick = () => { rememberWelcome(storage); welcome.close(); document.querySelector('#upload').focus(); };
  welcome.querySelector('#welcome-upload').onclick = () => { rememberWelcome(storage); welcome.close(); upload(); };
  welcome.addEventListener('cancel', () => rememberWelcome(storage));
  document.querySelector('#restart-tour').onclick = start;
  document.querySelector('#tour-skip').onclick = close;
  document.querySelector('#tour-back').onclick = () => { if (index > 0) showStep(index - 1); };
  document.querySelector('#tour-next').onclick = () => index < TOUR_STEPS.length - 1 ? showStep(index + 1) : close();
  tour.addEventListener('cancel', event => { event.preventDefault(); close(); });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  return { welcome: () => { if (!hasSeenWelcome(storage)) welcome.showModal(); }, start };
}
