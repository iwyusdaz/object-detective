/**
 * Raking light: a single hard light skimming the object's surface at a low
 * angle, as conservators do to reveal relief, tool marks and stamped marks.
 * Controlled by azimuth / elevation / intensity (sliders + keyboard); while on,
 * the gallery switches to 'raking' mode (environment and studio light dimmed).
 * Physically based: a DirectionalLight with a tight shadow camera around the stage.
 * @module systems/raking-light
 */
import * as THREE from 'three';
import { TABLE_Y } from '../scenes/gallery.js';

export const RAKING_DEFAULTS = { azimuth: 300, elevation: 12, intensity: 3.2 };
/** Elevation at or below which a raking-light "reveal" counts as discovered. */
export const RAKING_REVEAL_MAX_ELEVATION = 20;

export function clampRaking({ azimuth, elevation, intensity }) {
  return {
    azimuth: ((Math.round(azimuth) % 360) + 360) % 360,
    elevation: Math.min(60, Math.max(2, Math.round(elevation))),
    intensity: Math.min(6, Math.max(0.5, +(+intensity).toFixed(1))),
  };
}

/** Direction (unit vector, light -> origin reversed) for an azimuth/elevation in degrees. */
export function rakingDirection(azimuthDeg, elevationDeg) {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}

export class RakingLight {
  constructor(scene, gallery) {
    this.gallery = gallery;
    this.state = { ...RAKING_DEFAULTS };
    this.on = false;
    this.light = new THREE.DirectionalLight('#fff6ea', 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.0002;
    this.light.shadow.normalBias = 0.004;
    const cam = this.light.shadow.camera;
    cam.left = -0.45; cam.right = 0.45; cam.top = 0.45; cam.bottom = -0.45; cam.near = 0.05; cam.far = 3;
    this.light.target.position.set(0, TABLE_Y + 0.05, 0);
    scene.add(this.light, this.light.target);
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }

  set(partial) {
    this.state = clampRaking({ ...this.state, ...partial });
    this._apply();
  }

  setEnabled(on) {
    this.on = on;
    this.gallery.setMode(on ? 'raking' : 'inspect');
    this._apply();
  }

  /** Is the light currently low enough to reveal surface relief? */
  get revealing() { return this.on && this.state.elevation <= RAKING_REVEAL_MAX_ELEVATION; }

  _apply() {
    const [x, y, z] = rakingDirection(this.state.azimuth, this.state.elevation);
    const t = this.light.target.position;
    this.light.position.set(t.x + x * 1.4, t.y + y * 1.4, t.z + z * 1.4);
    this.light.intensity = this.on ? this.state.intensity : 0;
    for (const fn of this.listeners) fn(this.state, this.on);
  }

  describe() {
    const s = this.state;
    return `Raking light ${this.on ? 'on' : 'off'}: from ${s.azimuth}° around, ${s.elevation}° above the table, intensity ${s.intensity}.`;
  }
}
