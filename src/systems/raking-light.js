/**
 * Raking light: a single hard light skimming the object's surface at a low
 * angle, as conservators do to reveal relief, tool marks and stamped marks.
 * Controlled by azimuth / elevation / intensity (sliders + keyboard); while on,
 * the gallery switches to its 'raking' mode (room lights and reflections dim).
 * v3 (owner G2 feedback 2026-11-07): the light is the inspection lamp's own
 * spotlight. The lamp rig (od/lamp-rig.js) moves the lamp to the side set by
 * azimuth, raises or lowers the shade to the elevation, and keeps the beam on
 * the object; `position` and `target` are set by the rig each frame. The
 * intensity setting is the illuminance on the object (the spot's candela are
 * scaled by the squared distance from the shade mouth).
 * @module systems/raking-light
 */
import * as THREE from 'three';

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
  /**
   * @param {THREE.Scene} scene
   * @param {{ setMode: (m: string) => void }} room   the gallery (dims while the light is on)
   * @param {THREE.Vector3} target                    centre of the object on the table
   */
  constructor(scene, room, target) {
    this.room = room;
    this.state = { ...RAKING_DEFAULTS };
    this.on = false;
    // Tungsten-halogen desk lamp: warm white, a 35° half-angle shade with a soft edge.
    this.light = new THREE.SpotLight('#fff1dc', 0, 3, 0.62, 0.55, 2);
    this.light.name = 'inspection lamp';
    this.light.castShadow = false;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.bias = -0.0002;
    this.light.shadow.normalBias = 0.004;
    this.light.shadow.camera.near = 0.03;
    this.light.shadow.camera.far = 2;
    this.light.position.copy(target).add(new THREE.Vector3(-0.3, 0.3, 0));
    this.light.target.position.copy(target);
    /** Illuminance the lamp gives when the raking light is off (an object on the table). */
    this.ambientLevel = 0;
    scene.add(this.light, this.light.target);
    this.listeners = [];
    this._apply();
  }
  onChange(fn) { this.listeners.push(fn); }
  set(partial) {
    this.state = clampRaking({ ...this.state, ...partial });
    this._apply();
  }
  setEnabled(on) {
    this.on = Boolean(on);
    this.light.castShadow = this.on;
    this.room.setMode(this.on ? 'raking' : 'inspect');
    this._apply();
  }
  /** Is the light currently low enough to reveal surface relief? */
  get revealing() { return this.on && this.state.elevation <= RAKING_REVEAL_MAX_ELEVATION; }
  /** Illuminance on the object now: the raking setting, or the lamp's working level. */
  get level() { return this.on ? this.state.intensity : this.ambientLevel; }
  /** The elevation the lamp is set to now (the working angle when raking is off). */
  get elevationNow() { return this.on ? this.state.elevation : 40; }
  _apply() {
    this.syncIntensity();
    for (const fn of this.listeners) fn(this.state, this.on);
  }
  /** Spot candela for the wanted illuminance at the current shade-to-object distance. */
  syncIntensity() {
    const d = this.light.position.distanceTo(this.light.target.position);
    this.light.intensity = this.level * d * d;
  }
  describe() {
    const s = this.state;
    return `Raking light ${this.on ? 'on' : 'off'}: from ${s.azimuth}° around, ${s.elevation}° above the table, intensity ${s.intensity}.`;
  }
}
