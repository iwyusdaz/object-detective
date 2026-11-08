/**
 * The inspection lamp as an articulated arm (owner G2 feedback §2): the base,
 * arms and head are solved so the shade mouth sits at the planned light
 * position and the shade axis points at the target.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LAMP, solveArm, jointRotations, classifyIsland, lampPlan, LampRig } from '../../src/od/lamp-rig.js';
// restOnFloor-like offset: the holder's origin is the lamp's box centre, not the post.
const ROOT_OFFSET = [0.0175, 0.088, -0.01];

/** A stand-in lamp mesh: one small triangle island per joint group, at the model's real places. */
function fakeLamp() {
  const tri = (y, z) => [0, y, z, 0.004, y, z, 0, y + 0.004, z];
  const pos = [...tri(-0.05, 0), ...tri(0.15, 0.1), ...tri(0.5, 0.15), ...tri(0.7, -0.2)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const scene = new THREE.Scene();
  const holder = new THREE.Group();
  const root = new THREE.Group(); root.position.fromArray(ROOT_OFFSET);
  root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
  holder.add(root);
  scene.add(holder);
  return { scene, holder };
}

describe('lamp rig', () => {
  it('classifies the model islands into base, lower arm, upper arm and head', () => {
    expect(classifyIsland([-0.01, -0.088, -0.007], [0.009, -0.02, 0.01])).toBe('base');
    expect(classifyIsland([0.01, 0.02, -0.004], [0.027, 0.375, 0.279])).toBe('lower');
    expect(classifyIsland([-0.004, 0.366, -0.078], [0.004, 0.682, 0.279])).toBe('upper');
    expect(classifyIsland([-0.118, 0.583, -0.297], [0.083, 0.805, -0.102])).toBe('head');
  });
  it('the rest pose solves to zero joint turns', () => {
    const t = [LAMP.M[0] + LAMP.AXIS[0], LAMP.M[1] + LAMP.AXIS[1]];
    const j = jointRotations(solveArm(LAMP.M, t));
    for (const v of Object.values(j)) expect(Math.abs(v)).toBeLessThan(1e-3);
  });
  it('puts the shade mouth at the light position and aims it at the object, for every side the lamp can stand', () => {
    const { scene, holder } = fakeLamp();
    const light = new THREE.SpotLight();
    scene.add(light, light.target);
    const rig = new LampRig(holder, { light, reduced: () => true });
    expect(rig.ok).toBe(true);
    const target = new THREE.Vector3(0, 0.04, 0.05);
    for (const azimuth of [0, 45, 90, 135, 180, 230, 270, 300, 330]) {
      for (const elevation of [6, 12, 20, 45]) {
        const plan = lampPlan({ azimuth, elevation }, target);
        rig.aim(target, plan.light, plan.base);
        rig.update(1 / 60);
        scene.updateMatrixWorld(true);
        const mouth = rig.mouth.getWorldPosition(new THREE.Vector3());
        expect(rig.reached, `${azimuth}/${elevation}`).toBe(true);
        expect(mouth.distanceTo(plan.light), `${azimuth}/${elevation}`).toBeLessThan(0.01);
        const toTarget = target.clone().sub(mouth).normalize();
        expect(THREE.MathUtils.radToDeg(rig.axisWorld().angleTo(toTarget)), `${azimuth}/${elevation}`).toBeLessThan(2);
        expect(light.position.distanceTo(mouth)).toBeLessThan(1e-6);
        // The base clamps to the table edge on the light's side; the elbow stays above the table top.
        expect(Math.abs(Math.abs(plan.base.x) - 0.66)).toBeLessThan(1e-9);
        const post = rig.arm.getWorldPosition(new THREE.Vector3());
        expect(Math.hypot(post.x - plan.base.x, post.z - plan.base.z), `${azimuth}/${elevation} post`).toBeLessThan(1e-3);
        expect(rig.elbowY, `${azimuth}/${elevation} elbow`).toBeGreaterThan(0.1);
      }
    }
  });
  it('eases toward a new aim instead of jumping', () => {
    const { scene, holder } = fakeLamp();
    const rig = new LampRig(holder, { light: null, reduced: () => false });
    const target = new THREE.Vector3(0, 0.04, 0.05);
    const a = lampPlan({ azimuth: 300, elevation: 45 }, target);
    rig.aim(target, a.light, a.base);
    for (let i = 0; i < 300; i++) rig.update(1 / 60);
    expect(rig.moving).toBe(false);
    const b = lampPlan({ azimuth: 300, elevation: 10 }, target);
    rig.aim(target, b.light, b.base);
    const before = rig.cur.shoulder;
    rig.update(1 / 60);
    const step = Math.abs(rig.cur.shoulder - before);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(Math.abs(rig.goal.shoulder - before) * 0.2);
    expect(rig.moving).toBe(true);
    scene.updateMatrixWorld(true);
  });
});
