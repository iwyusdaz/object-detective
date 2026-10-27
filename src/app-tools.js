/**
 * ToolController — wires the 3D inspection tools to pointer, keyboard and the
 * on-screen tool pad: orbit/zoom (drag, wheel, buttons, keys), preset views,
 * raking light, magnifier, two-point and preset measurement, true-size view
 * and side-by-side compare (synchronized rotation). Also reports which tools
 * are "active" on an object, so a finding is only recorded with the right tool.
 * @module app-tools
 */
import * as THREE from 'three';
import { Input } from './core/input.js';
import { ToolPad } from './ui/tool-pad.js';
import { buildReferences, layoutReferences, sizeStatement } from './systems/true-size-view.js';
import { announce } from './a11y/announcer.js';

/** Preset measurement across the object's longest side (normalized local-box points). */
export function longestPreset(size) {
  const axes = [size.x, size.y, size.z];
  const i = axes.indexOf(Math.max(...axes));
  const a = [0.5, 0.12, 0.5]; const b = [0.5, 0.12, 0.5];
  a[i] = 0; b[i] = 1;
  if (i === 1) { a[0] = b[0] = 0.5; }
  return { id: 'longest', label: 'Longest side', a, b };
}

export class ToolController {
  constructor(app) {
    this.app = app;
    const { engine, inspection, rake, magnifier, measure } = app;
    Object.assign(this, { engine, inspection, rake, magnifier, measure });
    this.pointMeasure = false;
    this.trueSize = false;
    this.compareId = null;
    this.measureText = '';
    this.trueSizeText = '';
    this.refs = buildReferences();
    this.refs.group.visible = false;
    inspection.stage.add(this.refs.group);
    measure.onMeasured = (m) => {
      this.measureText = `${m.method === 'preset' ? 'Longest side' : 'Distance between your two points'}: ${m.text}`;
      announce(`Measured: ${m.text}`);
      app.record.log('experienced', { id: `measure-${m.objectId}`, name: 'Measurement' }, { response: m.text });
      this.refresh();
    };
    this.pad = new ToolPad(document.getElementById('viewport'), {
      keys: app.keys,
      do: (a) => this.action(a),
      preset: (name) => { const label = inspection.preset(name); this._afterMove(); announce(`View: ${label}`); },
      setRaking: (p) => { rake.set(p); },
      toggleRaking: (on) => { rake.setEnabled(on); announce(rake.describe()); this.refresh(); },
      toggleMagnifier: (on) => { magnifier.setEnabled(on); this.lensToHotspot(); announce(on ? `Magnifier on, ${magnifier.zoom} times` : 'Magnifier off'); this.refresh(); },
      cycleMag: () => { const z = magnifier.cycleZoom(1); announce(`Magnifier ${z} times`); this.refresh(); },
      moveLens: (dx, dy) => magnifier.nudge(dx, dy),
      measurePreset: () => this.measureLongest(),
      setPointMeasure: (on) => { this.pointMeasure = on; measure.clear(); announce(on ? 'Two-point measuring: click a first point on the object.' : 'Two-point measuring off.'); this.refresh(); },
      toggleTrueSize: (on) => this.setTrueSize(on),
      setCompare: (id) => this.setCompare(id),
    });
    magnifier.onHiRes = (ok) => { if (ok) announce('Sharper 4096-pixel scan texture loaded for the magnifier.'); };
    this._initInput();
    inspection.onChange = () => { if (this.trueSize) this._layoutRefs(); };
  }

  _initInput() {
    const canvas = this.engine.canvas;
    this.input = new Input(canvas);
    let downAt = null;
    this.input.onPointer((p, kind) => {
      if (kind === 'down') downAt = { x: p.x, y: p.y };
      if (kind === 'move') {
        if (p.down && downAt && this.app.player && !this.app.player.playing) this.inspection.drag(p.dx, p.dy);
        if (this.magnifier.on) {
          const r = canvas.getBoundingClientRect();
          if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) this.magnifier.moveTo((p.x - r.left) / r.width, (p.y - r.top) / r.height);
        }
      }
      if (kind === 'up' && downAt) {
        const moved = Math.abs(p.x - downAt.x) + Math.abs(p.y - downAt.y);
        if (moved < 5 && this.pointMeasure && this.scaleOk()) {
          const r = canvas.getBoundingClientRect();
          const hit = this.measure.pick(((p.x - r.left) / r.width) * 2 - 1, -((p.y - r.top) / r.height) * 2 + 1);
          if (!hit && this.measure.points.length === 1) announce('First point placed. Click a second point.');
        }
        downAt = null;
      }
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.inspection.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    this.input.onKey((code, e, phase) => {
      if (phase !== 'down') return;
      if (document.querySelector('dialog[open]')) return;
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (this.app.shell.textMode || !this.visible || this.app.player?.playing) return;
      const action = this.app.keys.actionFor(code);
      if (!action) return;
      e.preventDefault();
      this.action(action);
    });
  }

  action(a) {
    const insp = this.inspection; const rake = this.rake;
    switch (a) {
      case 'turnLeft': insp.turn(-15); break;
      case 'turnRight': insp.turn(15); break;
      case 'tiltUp': insp.tilt(8); break;
      case 'tiltDown': insp.tilt(-8); break;
      case 'zoomIn': insp.zoom(0.8); break;
      case 'zoomOut': insp.zoom(1.25); break;
      case 'flip': insp.flip(); announce(insp.view.pose === 'flipped' ? 'Object turned over: you see the underside.' : 'Object turned upright.'); break;
      case 'raking': rake.setEnabled(!rake.on); announce(rake.describe()); this.refresh(); return;
      case 'rakeAzLeft': rake.set({ azimuth: rake.state.azimuth - 10 }); announce(rake.describe()); this.refresh(); return;
      case 'rakeAzRight': rake.set({ azimuth: rake.state.azimuth + 10 }); announce(rake.describe()); this.refresh(); return;
      case 'rakeLower': rake.set({ elevation: rake.state.elevation - 3 }); announce(rake.describe()); this.refresh(); return;
      case 'rakeHigher': rake.set({ elevation: rake.state.elevation + 3 }); announce(rake.describe()); this.refresh(); return;
      case 'magnifier': this.magnifier.setEnabled(!this.magnifier.on); this.lensToHotspot(); announce(this.magnifier.on ? 'Magnifier on' : 'Magnifier off'); this.refresh(); return;
      case 'magZoom': announce(`Magnifier ${this.magnifier.cycleZoom(1)} times`); this.refresh(); return;
      case 'measure': this.measureLongest(); return;
      case 'trueSize': this.setTrueSize(!this.trueSize); return;
      default: return;
    }
    this._afterMove();
  }

  _afterMove() { this.measure.clear(); }

  /** Measuring and true-size are only offered for scans whose scale matches the record. */
  scaleOk(id = this.inspection.primary?.id) { return Boolean(this.app.objects[id]?.scaleVerified); }

  measureLongest() {
    const slot = this.inspection.primary;
    if (!slot) return null;
    if (!this.scaleOk(slot.id)) { this.measureText = 'This scan is not at a verified true scale, so it cannot be measured here. See the record measurements.'; announce(this.measureText); this.refresh(); return null; }
    return this.measure.preset(slot.id, longestPreset(this.inspection.localSize(slot.id)));
  }

  /**
   * Tools whose use currently counts for discovering a finding on `objectId`.
   * With a hotspot, a tool only counts when it actually reveals the mark
   * (agent review H2): the magnifier lens must cover the mark, and raking light
   * must be low with the object in the hotspot's pose (e.g. turned over).
   */
  activeFor(objectId, hs = null) {
    const s = new Set(['view']);
    const posed = !hs || (this.inspection.primary?.id === objectId && this.inspection.viewMatches(hs));
    if (this.magnifier.on && (!hs || (posed && this.magnifier.covers(this.inspection.hotspotScreen(objectId, hs))))) s.add('magnify');
    if (this.rake.revealing && posed) s.add('raking');
    if (this.measure.last && this.measure.last.objectId === objectId) s.add('measure');
    return s;
  }

  /** Why a tool is on but does not reveal the mark yet (null when it does, or is off). */
  whyNotRevealed(objectId, hs, tool) {
    if (tool === 'magnify' && this.magnifier.on) return 'The magnifier is on, but the lens is not over the mark. Move the lens onto the spot (or choose the point of interest again).';
    if (tool === 'raking' && this.rake.on && !this.rake.revealing) return 'The raking light is too high to show faint relief. Lower it to a grazing angle (25° or less).';
    if (tool === 'raking' && this.rake.revealing) return 'The light is low, but this side of the object is not facing the camera. Choose the point of interest again to turn the object to it.';
    return null;
  }

  /** Put the magnifier lens on the current point of interest's mark. */
  lensToHotspot() {
    const cur = this.inspection.current;
    if (!this.magnifier.on || !cur || this.inspection.primary?.id !== cur.id) return;
    const pt = this.inspection.hotspotScreen(cur.id, cur.hs);
    if (pt) this.magnifier.moveTo(pt.x, pt.y);
  }

  setTrueSize(on) {
    if (on && !this.scaleOk()) { announce('True-size view is not available for this scan: its scale does not match the record.'); on = false; }
    this.trueSize = on;
    this.refs.group.visible = on;
    if (on) {
      this._layoutRefs();
      this.inspection.view.elev = 38;
      // Frame the object AND the three references, so the coin and card are in
      // shot (agent review SP8).
      const box = new THREE.Box3();
      for (const s of this.inspection.slots) box.expandByObject(s.model);
      box.expandByObject(this.refs.group);
      if (!box.isEmpty()) {
        const r = box.getBoundingSphere(new THREE.Sphere()).radius;
        const fov = (this.engine.camera.fov * Math.PI) / 180;
        this.inspection.view.dist = THREE.MathUtils.clamp((r / Math.sin(fov / 2)) * 1.15, 0.12, 3);
        this.inspection.view.fitDist = this.inspection.view.dist;
      }
      this.inspection._applyCamera();
      const obj = this.app.objects[this.inspection.primary?.id];
      this.trueSizeText = obj ? sizeStatement(obj) : '';
      if (obj) announce(`True-size view. ${this.trueSizeText}`);
    } else {
      this.trueSizeText = '';
      this.inspection.fitDistance();
      this.inspection._applyCamera();
      announce('True-size view off.');
    }
    this.refresh();
  }

  _layoutRefs() {
    const box = new THREE.Box3();
    for (const s of this.inspection.slots) box.expandByObject(s.model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3()).sub(this.inspection.stage.position);
    layoutReferences(this.refs, size.x, size.z);
    this.refs.group.position.set(c.x, 0, c.z);
  }

  async setCompare(id) {
    const primary = this.inspection.primary?.id;
    if (!primary) return;
    this.compareId = id;
    await this.inspection.show(id ? [primary, id] : primary);
    if (this.trueSize) this._layoutRefs();
    announce(id ? `Comparing ${this.app.objects[primary].title} with ${this.app.objects[id].title}. Turning rotates both.` : 'Comparison off.');
    if (id) this.app.record.log('experienced', { id: `compare-${primary}-${id}`, name: 'Side-by-side compare' });
    this.refresh();
  }

  setVisible(v) {
    this.visible = v;
    this.pad.root.hidden = !v;
    if (!v) { this.magnifier.setEnabled(false); this.rake.setEnabled(false); this.app.gallery.setMode('gallery'); }
  }

  refresh() {
    if (!this.pad) return;
    const primary = this.inspection.primary?.id;
    if (this.compareId && this.inspection.slots.length < 2) this.compareId = null;
    if (this.trueSize && !this.scaleOk(primary)) { this.trueSize = false; this.refs.group.visible = false; }
    this.pad.render({
      compareOptions: this.scaleOk(primary) ? Object.values(this.app.objects).filter((o) => o.id !== primary && o.scaleVerified) : [],
      compareId: this.compareId,
      raking: this.rake.state, rakingOn: this.rake.on,
      magOn: this.magnifier.on, magZoom: this.magnifier.zoom,
      trueSize: this.trueSize, pointMeasure: this.pointMeasure, measureText: this.measureText,
      trueSizeText: this.trueSizeText || '',
    });
  }
}
