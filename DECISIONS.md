# Decisions

Each decision with the alternatives considered and the reason. Deviations from the plan are marked **(deviation)**.

| ID | Decision | Alternatives | Rationale |
|---|---|---|---|
| D-01 | **Real CC0 Smithsonian scans**; fiction only in the framing (Lantern Museum, its staff and documents), labelled in-app | Fully fictional artifacts; constructed replicas | The task brief allowed replicas if downloads failed. They did not fail: `3d-api.si.edu` serves the GLBs (with a browser User-Agent), and the Open Access API exposes CC0 status for the record and the 3D media. Real evidence is the point of the plan |
| D-02 | Theme: early electrical instruments, 1832 to ca 1870 (NMAH "Work and Industry: Electricity") | Lincoln patent model; NMAAHC everyday objects | Coherent set with clear, dated records; visible catalog numbers on three scans; a documented uncertainty (Davenport replacement model) that fits "check the label" |
| D-03 | CC0 proof = API licence fields + screenshots of the API record and the Voyager page **(deviation)** | Screenshot of the 3d.si.edu "CC0" badge (plan Phase 1) | 3d.si.edu, collections.si.edu and si.edu return HTTP 403 to automated browsers from this machine. The API is the Smithsonian's own machine-readable licence statement. The fetch script refuses non-CC0 items |
| D-04 | Claims built around **visible catalog numbers** (181411, 335.588, 309254) that match the records | Inscriptions from records | None of the chosen records has an inscription field. The numbers are real, visible in the scans, and verifiable against the records. The game never says who painted them, only that they match the catalog number |
| D-05 | Contextualization treated lightly | A full contextualization task | Keeps the slice to objectives 1–4 from the plan in about 35 minutes |
| D-06 | Raking-light tool | Static lighting | Plan §9. It reveals relief and faint marks (battery underside). The shadows are a learning cue, so they stay on every preset |
| D-07 | Use the Smithsonian "std Draco" GLBs (2048 px, 100–150 k triangles, 1.3–2.1 MB) as shipped; 4096 px "150k-4096" GLBs (7–10 MB) loaded **on demand** by the magnifier **(deviation)** | Re-decimate with gltf-transform + KTX2 per preset (plan Phase 3) | The packages already meet every budget (per-file, first-interaction, triangles). Re-processing adds risk with no budget benefit. The magnifier swaps in the full 4096 px package because UV layouts between packages are not guaranteed to match |
| D-08 | Modelled gallery (ambientCG CC0 PBR + Poly Haven CC0 HDRI), no Gaussian splat | Spark splat | No license-clean capture exists; plan §6.1 allows modelling |
| D-09 | Observation-vs-inference classification on every finding | Free note-taking | Plan §9. It targets the most common novice error |
| D-10 | Verdicts include "can't tell yet", plus 4-level confidence and a Brier calibration score | Right/wrong only | Plan §9 and §5.3 (calibration) |
| D-11 | Tangent galvanometer used **only** as transfer-task photos; measurement and true size disabled for it | Use it in Case 2 | Its scan's bounding box (about 14.5 cm) does not match the record (21.59 cm). Measuring it would present a wrong number as evidence. Unit-tested (`scaleVerified`) |
| D-12 | Vercel limits checked 2026-10-27 (https://vercel.com/docs/limits): CLI static uploads 100 MB Hobby / 1 GB Pro; 15,000 source files per CLI deployment. This build: ~57 MB, ~100 files, largest file 9.6 MB | — | Under the 150 MB per-project budget and the Hobby CLI upload limit. The showcase builds on Vercel from release archives, so the assembled site total is the orchestrator's concern |
| D-13 | Side panel ("case file") holds every decision; the 3D view adds the tools. Text mode = panel full width with photos | A separate text-mode implementation | One decision path guarantees parity (the same `CaseView` and `CaseEngine`) |
| D-14 | No on-screen characters; the curator speaks through text | Animated curator | Plan §9 |
| D-15 | True-size view with ruler, US quarter and ID-1 card, plus record dimensions in text | Text only | Plan §9; sizes verified |
| D-16 | No audio at all | Ambient sound | Nothing in the task needs sound. It removes a caption/volume burden (volume settings remain from the template) |
| D-17 | Hash-free single page with chapters held in state; save in `object-detective:save` | Hash routes | No deep links needed. Resume restores the chapter and step |
| D-18 | Text-mode photos rendered from the scans by the game's own renderer (`render-views.mjs`), JPEG, content-hashed | Smithsonian photos (CC0 images exist for some records) | Same lighting as the 3D mode, same views for every object, raking-light views, close-ups that match each finding |
| D-19 | ToneMappingEffect added to the composer chain | Rely on the renderer's tone mapping | postprocessing renders to a half-float target, where three.js skips output tone mapping. Without it the image is washed out |
| D-20 | Poster: real Morse-Vail scan in the game renderer under a low raking light (`render-poster.mjs`) | Gallery wide shot | The raking light on a real artifact is the project's core idea |

## Revisions (builder self-review during the build)
Agent reviews are pending (`evaluation/reviews/`). These revisions came from the builder's own checks and test failures:

1. **Coil "paper band" corrected to "bracket".** A close-up render showed the number 309254 written on a metal bracket, not a paper band. Changed in the finding, statements and description.
2. **Galvanometer scale mismatch** found by the true-scale unit test. The object was removed from measurement and true size, and the mismatch is documented (D-11).
3. **Confidence-before-verdict bug.** Choosing a confidence before a verdict was lost. Added `setConfidence()` and a unit test.
4. **axe: label-content-name mismatch** on the "Turn over" button. The visible text is now the accessible name.
5. **axe: high-contrast badge contrast.** Added high-contrast values for badge and feedback colours.
6. **Tone mapping missing under post-processing** (D-19), seen in the first renders.
7. **Poster reframed and relit** after the first render left the object small and underlit.
8. **Morse key "spring" wording changed** to "thin curved metal strip". The scan does not show that it is a spring (that would be an inference).
