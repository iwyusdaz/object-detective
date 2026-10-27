/**
 * Data-driven cinematic shot player (standards section 3.2).
 * Shots come from content/cinematics.json: camera path points, target, duration,
 * easing, captions, purpose tag. Every shot is skippable from the first frame
 * (Skip button + Esc), captioned, with a text description, and has a reduced-motion
 * version (still frames + captions). Cinematics never play during assessment.
 * @module cinematics/shot-player
 */
import { Vector3, CatmullRomCurve3 } from 'three';

export const EASINGS = {
  linear: (t) => t,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeOut: (t) => 1 - (1 - t) ** 3,
};

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container   overlay that hosts captions/skip UI
 * @param {import('three').PerspectiveCamera} opts.camera
 * @param {import('../a11y/motion.js').MotionPrefs} opts.motion
 * @param {Function} [opts.onDone]
 * @param {Function} [opts.onSkip]       called when skipped (logged as experienced)
 */
/**
 * Index of the caption to show `elapsed` seconds into a shot. `captionTimes`
 * (seconds, ascending, same length as `captions`) times each caption to the
 * moment it describes; without it the captions are spread evenly.
 */
export function captionIndexAt(shot, elapsed) {
  const n = shot.captions?.length || 0;
  if (n <= 1) return 0;
  const times = shot.captionTimes?.length === n ? shot.captionTimes : shot.captions.map((_, i) => (i * (shot.duration || 10)) / n);
  let idx = 0;
  for (let i = 0; i < n; i++) if (elapsed >= times[i]) idx = i;
  return idx;
}

export class ShotPlayer {
  constructor({ container, camera, motion, onDone, onSkip, captionsOn = () => true, inertTargets = () => [] }) {
    this.container = container;
    this.camera = camera;
    this.motion = motion;
    this.onDone = onDone;
    this.onSkip = onSkip;
    this.captionsOn = captionsOn;
    this.inertTargets = inertTargets;
    this._inerted = [];
    this.shots = [];
    this.index = -1;
    this.playing = false;
    this._t = 0;
    this._raf = null;
    this._buildUI();
  }

  _buildUI() {
    this.root = document.createElement('div');
    this.root.className = 'cinematic-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Cinematic');
    this.caption = document.createElement('p');
    this.caption.className = 'cinematic-caption';
    this.caption.setAttribute('aria-live', 'polite');
    this.desc = document.createElement('p');
    this.desc.className = 'cinematic-audio-description visually-hidden';
    this.progress = document.createElement('p');
    this.progress.className = 'cinematic-progress';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'cinematic-skip';
    skip.textContent = 'Skip cinematic (Esc)';
    skip.addEventListener('click', () => this.skip());
    this.skipBtn = skip;
    // Reduced-motion stills wait for the learner instead of a timer.
    this.continueBtn = document.createElement('button');
    this.continueBtn.type = 'button';
    this.continueBtn.className = 'cinematic-continue';
    this.continueBtn.textContent = 'Continue';
    this.continueBtn.hidden = true;
    this.continueBtn.addEventListener('click', () => { this.continueBtn.hidden = true; this._nextShot(); });
    this.root.append(this.progress, this.caption, this.continueBtn, this.desc, skip);
    this.container.appendChild(this.root);
    this.root.hidden = true;
    this._esc = (e) => { if (e.key === 'Escape' && this.playing) this.skip(); };
    document.addEventListener('keydown', this._esc);
  }

  /** Load a cinematic definition { id, title, shots: [...] } from content JSON. */
  load(def) {
    this.def = def;
    this.shots = def.shots || [];
    this.index = -1;
  }

  play() {
    if (!this.shots.length) { this.onDone?.(); return; }
    this.playing = true;
    this.root.hidden = false;
    this.caption.hidden = !this.captionsOn();
    // The task UI is inert while a cinematic owns the screen (no Tab into the
    // case file, no duplicate live-region announcements); focus goes to Skip.
    this._inerted = this.inertTargets().filter((el) => el && !el.inert);
    for (const el of this._inerted) el.inert = true;
    this.index = -1;
    this._nextShot();
    this.skipBtn.focus({ preventScroll: true });
  }

  _releaseInert() {
    for (const el of this._inerted) el.inert = false;
    this._inerted = [];
  }

  _nextShot() {
    this.index++;
    clearTimeout(this._stillTimer);
    if (this.index >= this.shots.length) return this._finish();
    const shot = this.shots[this.index];
    this.progress.textContent = `Shot ${this.index + 1} of ${this.shots.length} — purpose: ${shot.purpose}`;
    this.desc.textContent = shot.description || '';
    this._t = 0;
    this._shownCaption = -1;
    if (this.motion.reduced) {
      // Reduced-motion version: still frame at the end of the path, all captions,
      // and a Continue button (learner-paced, no auto-advance).
      this._placeAt(shot, 1);
      this.caption.textContent = (shot.captions || []).join(' ');
      this.continueBtn.hidden = false;
    } else {
      this.continueBtn.hidden = true;
      this._showCaption(shot, 0);
      this._start = performance.now();
      cancelAnimationFrame(this._raf);
      const step = () => {
        if (!this.playing) return;
        const elapsed = (performance.now() - this._start) / 1000;
        const dur = shot.duration || 10;
        const t = Math.min(1, elapsed / dur);
        this._placeAt(shot, t);
        this._showCaption(shot, elapsed);
        if (t >= 1) { this._nextShot(); return; }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    }
  }

  /** Timed captions: show the caption whose start time (captionTimes) has passed. */
  _showCaption(shot, elapsed) {
    const i = captionIndexAt(shot, elapsed);
    if (i === this._shownCaption) return;
    this._shownCaption = i;
    this.caption.textContent = shot.captions?.[i] || '';
  }

  _placeAt(shot, t) {
    const ease = EASINGS[shot.easing] || EASINGS.easeInOut;
    const k = ease(t);
    const pts = (shot.path || []).map(p => new Vector3(...p));
    const target = new Vector3(...(shot.target || [0, 0, 0]));
    let pos;
    if (pts.length === 0) pos = this.camera.position.clone();
    else if (pts.length === 1) pos = pts[0];
    else if (pts.length === 2) pos = pts[0].clone().lerp(pts[1], k);
    else pos = new CatmullRomCurve3(pts).getPoint(k);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
  }

  skip() {
    if (!this.playing) return;
    clearTimeout(this._stillTimer);
    cancelAnimationFrame(this._raf);
    this.playing = false;
    this.root.hidden = true;
    this.continueBtn.hidden = true;
    this._releaseInert();
    this.onSkip?.(this.def?.id);
    this.onDone?.();
  }

  _finish() {
    this.playing = false;
    this.root.hidden = true;
    this.continueBtn.hidden = true;
    this._releaseInert();
    this.onDone?.();
  }

  dispose() {
    document.removeEventListener('keydown', this._esc);
    clearTimeout(this._stillTimer);
    cancelAnimationFrame(this._raf);
    this.root?.remove();
  }
}
