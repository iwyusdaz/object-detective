# Art Bible — The Object Detective v2.0.0 ("The Lantern Museum after hours")

## 1. Visual Direction & Mood

**Setting:** the Lantern Museum (fictional), a small gallery of 19th-century
telegraph and electrical artefacts, closed for the night. Real Smithsonian CC0
scans are the six hero objects; the room around them is a real, modelled
gallery: parquet underfoot, wainscoting and plaster walls, brass rails and
picture lights, glass display cases with true refraction, tall windows with
moonlight and rain, and an archive corner behind a doorway.

**Mood:** "night at the museum" — pools of warm tungsten light inside deep
blue-black shadow, glass reflections on the cases, dust drifting through the
spotlight cones, the patient tick of a grandfather clock, a night guard's torch
sweeping past the corridor doorway every ~25 s. The building feels asleep but
alive. Every learning cue (the hero scan under its spotlight, the draft label
card, the raking light) stays the sharpest, most readable element in frame;
the gallery is atmosphere, never competition.

**Honesty framing (unchanged from v1):** the museum is fictional and labelled
so; the six artefacts are real Smithsonian CC0 scans with honest records.

---

## 2. Colour Palette & Cinematic Grade

| Swatch Role | Hex | Usage |
|---|---|---|
| **Tungsten amber** | `#F2B25C` | Spotlights on cases and plinths, picture lights, desk lamp pool, HUD primary accent |
| **Oxblood** | `#5B1A1F` | Wainscoting stain, curtain and bench fabric, archive folios, HUD accent-strong |
| **Gallery green** | `#2F4A3A` | Archive corner paint, felt case decks, folder spines |
| **Brass** | `#B08D57` | Rails, case frames, lamp arms, plinth plaques, tooltip accents |
| **Night blue** | `#1B2433` | Moonlit walls, window night sky, deep shadows, HUD surface `#181311` |

### Grade & Atmosphere (`applyCaseGrade('object-detective')`)
- **Tone mapping:** `THREE.AgXToneMapping` (fallback `ACESFilmic`), exposure `1.12`.
- **Atmosphere:** exponential fog (`#161D29`, density `0.022`) + gradient night
  sky dome (`#0F1624` zenith → `#1F2B3E` horizon → `#17120E` ground) visible
  through the windows; warm highlight / blue-black shadow bias, gentle halation
  on emissive sources via the existing bloom path.
- **IBL:** Poly Haven `brown_photostudio_02` (1k HDRI, CC0) for lighting and
  reflections only; everything within 30 m is real geometry.
- **Grounding:** every prop gets a contact-shadow disc and shadow-casting PBR
  materials; nothing floats.

---

## 3. Typography (`src/styles/case-fonts.css`)

Self-hosted WOFF2 subsets (`font-display: swap`):

| Role | CSS Variable | Typeface | Weight(s) | Licence | Usage |
|---|---|---|---|---|---|
| **Display** | `--font-display` | **Cormorant Garamond** | 600, 700 | SIL OFL 1.1 | App title, chapter headings, plinth label cards |
| **Body** | `--font-body` | **Source Serif 4** | 400, 600 | SIL OFL 1.1 | All instructions, case files, buttons, panel copy |
| **In-world accent** | `--font-accent` | **Special Elite** | 400 | Apache 2.0 | Catalogue cards, archive folios, hover tooltips, typewritten notes |

**Accessibility:** the **Plain font** header toggle sets
`html[data-plain-font="on"]` (persisted), switching all three roles to clean
system sans/mono. Body copy always uses Source Serif 4 (legible); decorative
faces are headings and in-world props only. All text pairs ≥ 4.5:1.

---

## 4. Reference Board (inform only; only CC0 assets shipped)

- Poly Haven `vintage_grandfather_clock_01`, `Chandelier_01`, `drawer_cabinet`, `desk_lamp_arm_01`, `wooden_bookshelf_worn`, `ceramic_vase_01`, `Lantern_01` (CC0) — furniture/prop forms: https://polyhaven.com/models
- ambientCG `WoodFloor043`, `Plaster001`, `Fabric026` (CC0) — parquet, plaster, felt: https://ambientcg.com
- Smithsonian Open Access 3D scans (CC0) — the six hero artefacts: https://www.si.edu/openaccess
- Metropolitan Museum Open Access paintings (CC0, referenced for frame/wall treatment; not shipped in v2.0.0): https://www.metmuseum.org/art/collection

---

## 5. Environment & Composition

- **Gallery room** (12 × 12 m): parquet floor, plaster walls with wainscoting
  and brass rail, skirting, ceiling with a lit chandelier; three glass display
  cases on the north wall each with its own track spotlight and label card.
- **Hero plinths:** the six Smithsonian scans stay the stars — the three case
  objects plus the inspection table under the studio key light; every hero sits
  on a proper plinth/deck with a catalogue card and its own warm spotlight.
- **Windows:** tall north windows with moonlight spill and animated rain
  streaks; doorway east to the **archive corner** (drawer cabinet, bookshelf,
  green wall, picture light).
- **Inspection table:** parquet-side work table with the photographic sweep,
  draft label card and a lit desk lamp; the learner's tools live here.
- **Evidence board:** cork board by the archive doorway with pinned cards —
  the in-world anchor for the case file.

## 6. Ambient-life list (≥ 5 systems)

1. Dust motes drifting through the spotlight cones (particle volume).
2. Grandfather-clock pendulum (harmonic oscillator, `addOscillator`).
3. Night-guard torch beam sweeping past the corridor doorway every ~25 s
   (moving spotlight + emissive blade, spline-driven).
4. Rain streaks on the windows (UV-scroll shader planes).
5. Chandelier candle-flicker (emissive intensity noise) + clock-face glow.
6. **Calm mode:** slows to ~30 % and dims while the magnifier/measure tools or
   a case is active; `prefers-reduced-motion` freezes all of it.

## 7. Interaction list

- Glowing floor rings at the inspection table, each display case, the archive
  cabinet and the evidence board; clicking glides the camera with cinematic
  framing; hover gives a brass highlight + Special Elite tooltip.
- Free navigation: WASD/arrow walking and mouse-drag look in the gallery.
- **Raking light as a physical torch:** aimed with the mouse in 3D; the
  original panel button remains for keyboard/text parity.
- Existing tools unchanged: magnifier, measure, hotspots, compare — all with
  keyboard and text-mode equivalents (v1 contract preserved).
