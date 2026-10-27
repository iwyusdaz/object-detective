# Agent review: second pass (independent reviewer)

Agent review (reviewer sub-agent, not the builder). This file adds to the seven `agent-review-*.md` reports already committed in `7df4b62`. I did not overwrite them, because the builder is already fixing against their IDs (H2, V1, V3 …). Each finding below is new or corrects a statement in those reports. Findings are grouped under the report area they belong to.

- **Build reviewed:** commit `7df4b62`. I copied it to a temp directory, built it with `npm run build` (bundle `index-DeWENuIB.js`) and served it with `vite preview` on 127.0.0.1:4192. Every file under `src/` and `content/` in that copy is byte-identical to `HEAD`. The uncommitted fixes in the working tree were **not** reviewed.
- **Method:** headless Chromium (SwiftShader WebGL) at 1440×900 and iPhone 13 emulation, plus axe-core 4.14 and code reading. No GPU, performance or Lighthouse runs.
- **Screenshots:** new evidence is in `screenshots/second-pass/`. Files `30-tutorial-*`, `31-tutorial-*`, `40-s1-cinematic-*`, `41-tutorial-true-size`, `42-tutorial-number-hotspot`, `43-board-no-evidence`, `44-compare-key-relay`, `50-…54-textmode-*`, `60-*`, `61-*`, `70-*`, `71-*` and `80-*…92-*` in `screenshots/` also come from this pass. Two reviewers shared port 4192 at the same time, so the folders mixed. `44-compare-key-relay.png` does **not** show compare: the select was still collapsed. Use `second-pass/93-compare-motor-relay-clean.png` instead.

## Fact audit spot-check (plan §10)

For this check I picked facts that are **visible in the app**: archive excerpts, expert text, transfer excerpt and on-object transcriptions. Most were not in the first reviewer's table. I compared each one with the saved Smithsonian Open Access API response `data/raw/si3d.json` (69 rows; extracted `content.freetext` for the six `record_ID`s).

| # | In-app fact (where shown) | Saved record field | Result |
|---|---|---|---|
| F1 | "accession number: 31652" (tutorial Archive, `tutorial.json:95`) | nmah_1096762 `identifier`: accession number 31652 | Match |
| F2 | "Credit line: from Western Union Telegraph Co." (`tutorial.json:100`) | `creditLine`: from Western Union Telegraph Co. | Match |
| F3 | Battery "ID Number: EM.181178; catalog number: 181178; accession number: 27225" and "Location: Currently not on view" (`main.json:197,202`) | nmah_703292 `identifier` + `notes` Location | Match |
| F4 | Relay "accession number: 323535; serial number: 589" (`main.json:212`) | nmah_712417 `identifier` | Match |
| F5 | Davenport "Wooden base, 9 by 14 in., supported on four curved legs … four rough electro-magnets, painted red, made to revolve within a ring of steel magnets." (`main.json:186`) | nmah_703302 `notes` Description (Brief) | Match, verbatim |
| F6 | Relay "A relay detected a weak signal and used a battery to strengthen the signal so that the receiver would operate." (`main.json:216`) | nmah_712417 `notes` Description | Match, verbatim |
| F7 | Coil "Object type: Patent Model. Object name: Induction Coil"; "patent number: 76654" (`main.json:227-228`) | nmah_703318 `objectType`, `identifier` | Match |
| F8 | Galvanometer transfer excerpt: object name, "ca 1870", "Western Electric", "rubber, glass, brass, copper, steel (part materials)", "from Western Union Corporation", measurements (`items.json:55-59`) | nmah_703325 `freetext` | Match |
| F9 | Transcription "181411" on the key base (`tutorial.json:45`) vs catalog number | `42-tutorial-number-hotspot.png` shows white "181411"; record catalog number 181411 | Match |
| F10 | Transcription "309254" on the coil bracket (`main.json:155`) | `86-textmode-coil-number-finding.png` shows handwritten "309254"; record catalog number 309254 | Match |
| F11 | All six records and their `3d_voyager` media are CC0 | `metadata_usage.access` = CC0; media `usage.access` = CC0 (all six) | Match |

**Result: 11 of 11 match; no mismatches.** `npx vitest run tests/unit/tools-and-facts.test.js` passes 22 of 22 locally with `data/raw/` present. The first reviewer's audit-skip gap (E-section, fixture needed for CI) still stands.

---

## Visual quality and realism (adds to `agent-review-visual.md`, `agent-review-realism-cinematics.md`)

| # | Severity | Where | Issue | Evidence | Fix |
|---|---|---|---|---|---|
| SP1 | **major** | Settings → Quality **High** or **Ultra**, any scene | The post pipeline throws `TypeError: e.initialize is not a function` and falls back to direct rendering. On High and Ultra, **no AO and no SMAA** are drawn, which is less than Medium gets. Cause: `src/core/post.js:10,21,28` imports `N8AOPass`, the three.js-examples pass, and adds it to the **pmndrs** `EffectComposer`. N8AO ships `N8AOPostPass` for pmndrs postprocessing. This also corrects `agent-review-visual.md` (Summary, V9, "High / Ultra: AO grounds the objects"): AO never renders in this build. Medium has no AO by design (`quality.js:28`). | Console warning on every High/Ultra load; `11-high-*` and `11-ultra-*` are byte-identical (md5); `second-pass/forced-high-relay-inspect.png` | `import { N8AOPostPass } from 'n8ao'` and use it in `post.js`. Add a functional test that fails on any `post pipeline unavailable` warning |
| SP2 | **major** | Settings → choose the preset that is already active (for example Medium on a laptop) → Save | `settings.js:114` only calls `quality.set()` when the value *changes*. Choosing the current auto preset is not stored (`localStorage` `object-detective:quality` stays `null`), and `auto` stays true. The warm-up benchmark (`engine.js:93-98`, `quality.js:94-106`) then overrides the learner's choice. In headless runs it dropped to Low (canvas 720×576) within about 16 s. This also means the earlier `10-low-*` and `10-medium-*` shots are byte-identical: both were really Low. | probe output; `10-low-relay-inspect.png` = `10-medium-relay-inspect.png` (md5) | Always call `quality.set(v)` on Save, or set `quality.auto = false` whenever the dialog is saved. Re-take the per-preset screenshots after the fix |
| SP3 | minor | Magnifier lens, any object | The lens is a CSS circle, but the scissor render is a square (`magnifier.js:87-91`), so the lens image shows as a lighter square behind the ring | `21-relay-number-hotspot-magnifier-on.png`, `11-low-relay-number-magnifier.png` | Render the lens to a render target shown in a circular element, or use a stencil mask |
| SP4 | minor | Inspect: choose a "turn it over" hotspot, then pick another object or start Compare | The pose (flipped) and the camera elevation carry over to the next object. `inspection.show()` (`inspection.js:67-85`) does not reset `view`, so the Davenport motor appears upside down. Compare also frames the fictional draft card in the shot. | `second-pass/93-compare-motor-relay-clean.png` | Apply the `front` preset on object change and when Compare starts |

## Heuristic evaluation (adds to `agent-review-heuristics.md`)

| # | Severity | Heuristic | Issue | Evidence | Fix |
|---|---|---|---|---|---|
| SP5 | **major** | 5 Error prevention, 3 User control | Menu → "Restart the whole game" wipes both cases, the pre-check and the transfer at once, with no confirmation and no undo (`app.js:210-216` at HEAD). It sits one item away from "My progress" in the menu list (`shell.js:45-46`). A slip loses a 35-minute session. | probe: no `confirm`/dialog fired; chapter reset to Welcome | Ask for confirmation ("This clears all your answers. Download your record first?"), or keep the last save so it can be undone |
| SP6 | **major** | 1 Visibility, 8 Minimalist design (mobile) | On 390×844 (iPhone 13 emulation), the five chapter buttons wrap into tall boxes. The header plus chapter nav fill about the top 40 % of the screen, and the open View tool pad covers the upper half of the 3D view. The object is pushed below the fold. | `70-mobile-welcome.png`, `71-mobile-case2-inspect.png` | On narrow widths, make the chapter nav a single scrollable row (or a `<select>`) and collapse the tool pad to a toggle by default |

## Accessibility (adds to `agent-review-accessibility.md`)

| # | Severity | Category | Issue | Evidence | Fix |
|---|---|---|---|---|---|
| SP7 | **major** | Perception; WCAG 1.4.3 / 1.4.4 (user setting persistence) | Saved **High contrast** and **Text size** are stored (`object-detective:settings`), but after a reload they are **not applied**. `Settings._apply()` runs only on Save and when the dialog opens (`settings.js:131-140` at HEAD), and `app.js` `_initDialogs` never calls it. A low-vision learner has to reopen Settings on every visit. The uncommitted working tree adds `applyDisplay()`; re-check it once committed. | `92-after-reload-settings-not-applied.png`; probe: `data-contrast`/`data-text-size` undefined after reload | Apply the display settings at start-up (and add a functional test: save, reload, assert `data-contrast="high"`) |
| SP8 | **major** | Perception / cognitive (plan §8 Phase 8: "with the dimensions also stated in text") | In 3D mode the true-size view shows a ruler, an unlabelled grey disc and a bank card that is hard to make out. The size statement ("about 7 quarters … 2.0 bank cards") goes **only** to the hidden live region (`app-tools.js:154`); no visible text names the references or gives the record size. Sighted learners do not know the disc is a US quarter, and many learners outside the US will not know a quarter's size. The open tool pad also covers the quarter. | `41-tutorial-true-size.png`, `second-pass/true-size-key-toolpad-hidden.png` | Show `sizeStatement()` visibly in the True size group. Add a legend ("ruler in cm · US quarter, 24.26 mm · bank card, 85.6 mm") and frame all three references |

axe-core (WCAG 2.0/2.1 A/AA tags) found **no violations** in the states I checked: Welcome, tutorial Inspect with a finding open (3D), Case 2 evidence board, Case 2 label, and text-mode Inspect. Keyboard path for T2 checked: POI button → Enter → `M` → Tab → "Record what I see" → Enter records the finding. Esc skips S1, and focus returns to `#panel`.

## Multimedia principles and cognitive walkthrough (adds to `agent-review-multimedia-principles.md`, `agent-review-cognitive-walkthrough.md`)

| # | Severity | Principle / step | Issue | Fix |
|---|---|---|---|---|
| SP9 | minor | Pre-training vs assessment (Amara, step 1 → tutorial T3) | The correct pre-check answer pre-4 b ("believed to come from the first Baltimore–Washington line, but we cannot say whether it sent the first message", `items.json:40`) is almost the tutorial's T3 expert verdict and exemplar (`tutorial.json:35,110`). The pre-check hands Amara the T3 answer five minutes before she meets it, so T3 no longer shows whether she can read the hedge herself. | Use an unrelated object or claim in pre-4 |

## Expert-style reviews (adds to `agent-review-expert-style.md`)

### Museum educator (Agent review — simulated persona)

| # | Severity | Finding | Fix |
|---|---|---|---|
| SP10 | minor | The fictional draft label says the 1830s were "the first decade of electrical invention" (`main.json:15`). No claim tests this, and the debrief never corrects it, so a learner can leave with a false history framing (electrical experiment and batteries predate the 1830s). It is inside a labelled fictional document, so it is not a fabricated *record* fact, but the case teaches that every claim on a label should be checked. | Make it a seventh claim (expected verdict "can't tell yet from these records"), or remove the phrase |
| SP11 | minor (UNVERIFIED observation) | The battery underside finding is rendered with the object turned over, so any marks are upside down. Rotated 180° and cropped, the faint marks look like a short row of numeral-like characters, spaced like the catalog numbers on the other three objects. I **could not read them**, and the content's "not legible" is the honest call. The record's catalog number is 181178. If the 4096 px texture (once its units are fixed) shows 181178 at the correct orientation, it becomes a fourth "find the catalog number" piece of evidence. That would also strengthen M5: a museum number is not a maker's mark. | `second-pass/battery-underside-marks-rotated-180-crop.jpg`, `…-as-rendered-crop.jpg`, `…-enhanced.png`. Check the hi-res texture before changing any content. Until then, keep "not legible" |
| SP12 | minor | README line 36 says the catalog numbers are "**painted** on the objects themselves (relay 335.588, coil 309254)". The content calls the coil number "handwritten in dark ink" (`main.json:154-155`) and the relay mark "dark paint or ink" (`main.json:120`). | Change it to "painted or written on the objects" |

### Secondary history teacher (Agent review — simulated persona)

| # | Severity | Finding | Fix |
|---|---|---|---|
| SP13 | minor | Provenance of the CC0 proof is inconsistent. `research/object-verification-log.md:9` (and `:47`, `:54`, `:62`) says the chester-relay, page-induction-coil and tangent-galvanometer API screenshots render the **saved search response**, because the live call was rate-limited (HTTP 429). `research/cc0-proof/capture-log.json` records `"apiStatus": 200, "source": "live content endpoint"` for the same three. A teacher who uses the proof to model sourcing will find two sources that disagree. The CC0 status itself is not in doubt (F11). | Re-check which source each screenshot came from, and correct the log or the JSON |

---

## Honesty checks
- Fictional labels are present on all four fictional documents and on the Lantern Museum framing (re-checked in the 3D Brief, the text-mode Archive and the transfer task). Pass.
- No compliance claims in the app. The README and accessibility plan disclaim WCAG validation. The teacher-guide screen-reader claim (E8) is still open at HEAD.
- UNVERIFIED: sources.md #13 (raking light as conservation practice) is not stated as fact in-app. Pass.

## Counts (this file only)
Critical 0 · Major 6 (SP1, SP2, SP5, SP6, SP7, SP8; SP1 also corrects the visual report's AO statement) · Minor 7 (SP3, SP4, SP9, SP10, SP11, SP12, SP13).
