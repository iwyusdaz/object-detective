/**
 * True-size view: the object on the table beside familiar references at
 * matching scale — a 30 cm ruler with centimetre ticks, a US quarter
 * (24.26 mm diameter) and a bank card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm).
 * Sizes verified in research/sources.md. The record dimensions are also
 * stated in text (plan section 8, Phase 8).
 * @module systems/true-size-view
 */
import * as THREE from 'three';

export const REFERENCES = {
  ruler: { lengthM: 0.30, widthM: 0.032, label: '30 cm ruler' },
  quarter: { diameterM: 0.02426, thicknessM: 0.00175, label: 'US quarter (24.26 mm across)' },
  card: { widthM: 0.0856, heightM: 0.05398, label: 'bank card (85.6 × 54 mm)' },
};

function rulerTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1a1a1a';
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  const pxPerCm = c.width / 30;
  for (let mm = 0; mm <= 300; mm++) {
    const x = Math.round(mm * (pxPerCm / 10));
    const len = mm % 10 === 0 ? 90 : mm % 5 === 0 ? 60 : 34;
    g.fillRect(Math.min(x, c.width - 3), 0, mm % 10 === 0 ? 4 : 2, len);
    if (mm % 10 === 0 && mm > 0 && mm < 300) g.fillText(String(mm / 10), x, 150);
  }
  g.font = '32px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('cm', 12, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildReferences() {
  const group = new THREE.Group();
  group.name = 'true-size-references';
  const ruler = new THREE.Mesh(
    new THREE.BoxGeometry(REFERENCES.ruler.lengthM, 0.002, REFERENCES.ruler.widthM),
    [null, null, new THREE.MeshStandardMaterial({ map: rulerTexture(), roughness: 0.6 }), null, null, null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#d9d3c3', roughness: 0.6 })),
  );
  ruler.position.y = 0.001;
  ruler.receiveShadow = true;
  ruler.castShadow = true;
  ruler.name = 'ruler';
  const quarter = new THREE.Mesh(
    new THREE.CylinderGeometry(REFERENCES.quarter.diameterM / 2, REFERENCES.quarter.diameterM / 2, REFERENCES.quarter.thicknessM, 48),
    new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 1, roughness: 0.32 }),
  );
  quarter.position.y = REFERENCES.quarter.thicknessM / 2;
  quarter.castShadow = true;
  quarter.name = 'quarter';
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(REFERENCES.card.widthM, 0.00076, REFERENCES.card.heightM),
    new THREE.MeshStandardMaterial({ color: '#2e5d8f', roughness: 0.4 }),
  );
  card.position.y = 0.0004;
  card.castShadow = true;
  card.name = 'card';
  group.add(ruler, quarter, card);
  return { group, ruler, quarter, card };
}

/** Lay the references out in front of an object whose footprint is sizeX × sizeZ (metres). */
export function layoutReferences(refs, sizeX, sizeZ) {
  const front = sizeZ / 2 + 0.03;
  refs.ruler.position.set(0, refs.ruler.position.y, front + REFERENCES.ruler.widthM / 2);
  refs.card.position.set(Math.max(sizeX / 2, 0.06) + 0.07, refs.card.position.y, 0);
  refs.quarter.position.set(-(Math.max(sizeX / 2, 0.06) + 0.04), refs.quarter.position.y, 0);
}

/** Text statement of size, using the record's dimensions (never the scan's). */
export function sizeStatement(obj) {
  const d = obj.dimensionsCm;
  return `${obj.title}: the Smithsonian record gives ${obj.measurementsText}. That is ${comparisons(d)}`;
}

export function comparisons(dimsCm) {
  const longest = Math.max(...dimsCm);
  const quarters = longest / 2.426;
  const cards = longest / 8.56;
  return `about ${quarters.toFixed(0)} quarters laid edge to edge, or ${cards.toFixed(1)} bank cards long, at its longest (${longest.toFixed(1)} cm).`;
}
