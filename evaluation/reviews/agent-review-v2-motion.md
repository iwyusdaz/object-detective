# Agent review — v2.0.0 motion & ambient life (plan 09 §2.2, §4.2, §10 decision 1)

Reviewer: agent review. Build: HEAD `16bff87` at 127.0.0.1:4193, headless Chromium (software GL → Low; the repo caps dt at 0.1 s, so wall-clock rates below are lower-bound evidence — headed "is it alive" capture remains the owner's step).

## Ambient-life inventory — 5 live systems + ring pulse (≥ 5 required: met)

| # | System | Implementation | Live evidence (sampled deltas, exploring / calm off) |
|---|---|---|---|
| 1 | Dust motes in the spotlight cones | `AmbientLifeManager.addParticleVolume`, 130 motes, centre [0, 1.9, −4], extents 8.5 × 2.6 × 7 through the case-spot cones | position[0] and [1] changed between samples 2.5 s apart |
| 2 | Grandfather-clock pendulum | procedural brass rod+bob on `life.addOscillator(axis z, rotate, amp 0.09, freq 1.0)` (src/scenes/gallery.js:437-456) | rotation.z −0.0707 → 0.0842 |
| 3 | Night-guard torch sweep, ~25 s period | custom updater: 25 s cycle, ~6 s visible pass, moving SpotLight (intensity up to 26) + emissive blade past the archive doorway | torch.position.z −4.111 → −3.875 → −3.81 across samples |
| 4 | Rain streaks on both windows | canvas-texture streaks (46 strokes) UV-scrolled at 0.55/s on two 2.14 × 2.04 planes behind the glass | texture offset.y monotonic decrease (−0.2796 → −1.0146 → −1.2196) |
| 5 | Chandelier candle-flicker (+ clock glow) | updater: `14 × (0.82 + 0.18·sin·sin)` on the chandelier point light | intensity 11.08 → 11.71 → 11.13 (flicker band 11.5–14) |
| + | Hotspot ring pulse / diamond bob | `InWorldInteractionManager.update`, scaled by the calm factor | visible in screenshots; frozen under reduced motion |

## Calm mode — verified both by observation and code trace

- **Exploring (welcome/wrap-up):** `gallery.life.calm === false`, `calmFactor === 1` — full speed, full particle opacity.
- **Case/transfer inspection:** `_updateV2` computes `exploring = !inInspection() && !textMode && !playing && !cameraLocked`, then `gallery.setCalmMode(!exploring && this.inInspection())`. Measured on entering Case 1: `calm = true`, **calmFactor converged 1.00 → 0.41 → 0.35 (target 0.30)**; ambient `elapsed` advances at ~30 % rate; particle opacity scales to `0.45 + 0.55 × 0.3 ≈ 0.62` of base (dimmed, not frozen); ring pulses scale by the same factor. Motion load during reading is low: `setMode('inspect')` also sinks room lights to ~0.42 and the raking mode goes near-black so only the lit cue remains.
- **Code trace of the working-tree "characters freeze at calm 0" patch** (src/v2/ambient-life.js): `targetCalm = reducedMotion ? 0.0 : calm ? 0.30 : 1.0`; characters now receive `c.update(dt, elapsed, this.calmFactor)` with no `Math.max(0.25, …)` floor, and `update()` `continue`s past characters entirely under reduced motion — so under `prefers-reduced-motion` characters are fully frozen (the old floor kept them crawling at 25 %), and during calm they run at 30 %. **This repo instantiates no characters** (decision D-14; `stylized-character.js` is imported only for its contact-shadow texture), so the patch has no runtime effect here either way; the patch's other hunk (removing `setEnabled`) breaks the app — see `agent-review-v2-interaction.md` V2-CRIT-1.

## Reduced motion (`prefers-reduced-motion: reduce`, emulated context) — everything non-essential freezes

| Quantity | Sample 1 | Sample 2 (3 s later) | Verdict |
|---|---|---|---|
| `life.reducedMotion` | true | true | flag reaches the manager via `MotionPrefs.onChange` |
| Pendulum rotation.z | 0 | 0 | frozen |
| Torch z | −4.2 | −4.2 | frozen |
| Rain texture offset | 0 | 0 | frozen |
| Dust position | 1.1007 | 1.1007 | frozen |
| Ring pulse | — | — | guarded by `if (!this.reducedMotion)` |
| Hotspot glide | (2.6, 2.2) → (0, 2.6) instantly (< 0.4 s, no tween) | | `glideTo` short-circuits to a teleport |

Residual nit: `life.elapsed` creeps 0.17 → 0.37 while `calmFactor` decays to 0 after load (the exponential settle runs before the reduced-motion early return), then stops — imperceptible and non-essential motion only.

## Findings

| ID | Sev | Finding |
|---|---|---|
| V2-MOT-1 | Minor | Ambient `elapsed` creep during the calm-factor settle under reduced motion (above) — cosmetic only. |
| V2-MOT-2 | Minor | The calm-mode dimming of dust is opacity-only; at Low preset (where the headed budget check matters most) the dimming is hard to perceive. Consider also scaling `size` or count on Low. |

No critical, no major. The calm-mode and reduced-motion gates behave exactly as OD-V1 and the art bible §6 promise, and all five planned ambient systems are measurably alive.
