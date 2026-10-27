/**
 * Core renderer + loop (shared template, extended for object-detective):
 * optional postprocessing composer per preset, and "overlay passes" rendered
 * after the main frame (used by the magnifier lens).
 * Conventions: 1 unit = 1 meter. sRGB output, ACES Filmic tone mapping.
 * @module core/engine
 */
import * as THREE from 'three';
import { QualityManager } from './quality.js';
import { createPost } from './post.js';

/**
 * Detect a software WebGL implementation (SwiftShader, llvmpipe, ...). Headless
 * test browsers always use one, and on a 2-vCPU CI runner a back-to-back render
 * loop starves the main thread so badly that overlay clicks time out.
 * @returns {string|null} the renderer string when it is a software renderer
 */
function detectSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

export class Engine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    // Software WebGL: no MSAA, Low preset at half resolution, ~5 fps cap (see DECISIONS.md).
    this.softwareGL = detectSoftwareGL();
    this.minFrameMs = this.softwareGL ? 200 : 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.softwareGL, powerPreference: 'high-performance', preserveDrawingBuffer: Boolean(opts.preserveDrawingBuffer) });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    this.baseFov = this.camera.fov;

    this.quality = new QualityManager(this.renderer, opts.preset || (this.softwareGL ? 'low' : undefined));
    if (this.softwareGL && !opts.preset) { this.quality.auto = false; this.quality.resolutionScale = 0.5; }
    this.clock = new THREE.Clock();
    this._updateFns = [];
    this._overlayPasses = [];
    this._running = false;
    this._paused = false;
    this._visible = true;
    this.frames = 0;
    this.fps = 0;
    this._fpsT = 0;
    this._fpsFrames = 0;
    this._benchT = 0;
    this._benchFrames = 0;
    this.post = null;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => { this._visible = !document.hidden; });
    this.quality.onChange(() => { this.rebuildPost(); this.resize(); });
    this.rebuildPost();
    this.resize();
  }

  rebuildPost() {
    this.post?.dispose();
    this.post = createPost(this.renderer, this.scene, this.camera, this.quality.presetDef);
    this.renderer.shadowMap.enabled = this.quality.presetDef.shadowMapSize > 0;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * this.quality.resolutionScale);
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this._updateFns.push(fn); return fn; }
  /** fn(renderer) is called after the main frame each tick (e.g. magnifier). */
  addOverlayPass(fn) { this._overlayPasses.push(fn); }

  renderOnce() {
    this.renderer.info.reset();
    if (this.post?.composer) this.post.composer.render();
    else this.renderer.render(this.scene, this.camera);
    for (const fn of this._overlayPasses) fn(this.renderer);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    // Keep rendering at or below ~50% of the main thread so the overlay stays
    // responsive when a single frame is expensive (software WebGL on CI).
    const schedule = (delayMs) => {
      if (delayMs > 4) setTimeout(() => requestAnimationFrame(tick), delayMs);
      else requestAnimationFrame(tick);
    };
    const tick = () => {
      if (!this._running) return;
      if (this._paused || !this._visible) { schedule(100); return; }
      if (this.canvas.style.visibility === 'hidden') { schedule(100); return; } // text mode: no GPU work
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      const t0 = performance.now();
      for (const fn of this._updateFns) fn(dt, t);
      this.renderOnce();
      const cost = performance.now() - t0;
      this.frames++; this._fpsFrames++;
      this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = this._fpsFrames / this._fpsT; this._fpsT = 0; this._fpsFrames = 0; }
      if (t < 20 && this.quality.auto) {
        this._benchFrames++; this._benchT += dt;
        if (this._benchT >= 2) {
          this.quality.autoSelect(this._benchFrames / this._benchT);
          this._benchFrames = 0; this._benchT = 0;
        }
      }
      schedule(Math.max(cost > 20 ? cost : 0, this.minFrameMs - cost));
    };
    requestAnimationFrame(tick);
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this.clock.getDelta(); }
  dispose() { this._running = false; window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
