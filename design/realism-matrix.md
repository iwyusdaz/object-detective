# Realism matrix

| Scene element | Realism level | Learning cue? | Rationale | Evidence |
|---|---|---|---|---|
| Object scans (geometry + textures) | High: real CC0 Smithsonian photogrammetry, true scale (metres), 2048 px textures; 4096 px loaded on demand for the magnifier | **Yes** | The marks (catalog numbers 181411, 335.588, 309254), wear, construction and materials *are* the evidence | Realistic details help when they are task-relevant: PMC11269326 (research/sources.md #7) |
| Raking light | High: a single physically based directional light with real shadows, controlled by azimuth, elevation and intensity | **Yes** | Low-angle light shows relief and faint marks that flat light hides (for example the trough battery's faint underside characters) | Design rationale. The conservation-practice claim is marked UNVERIFIED in sources.md #13 |
| Magnifier | High: a second render through a narrow-FOV camera, same scene and lighting | **Yes** | Reads small marks without moving the main view | — |
| Inspection backdrop (grey sweep) | Medium, neutral | No | Neutral ground, like a museum photo studio, so the object is the only detail. Signalling by isolation | Mayer coherence/signalling (standards §3.3) |
| True-size references (ruler, quarter, bank card) | Medium: correct real dimensions, simple materials | **Yes** (scale) | Gives a felt sense of size. Dimensions are also stated in text from the record | Sizes verified (sources.md #10, #11) |
| Gallery architecture, display cases | Medium: CC0 ambientCG wood/plaster/fabric PBR, Poly Haven CC0 HDRI | No | Context and motivation only. Dimmed during inspection (`gallery.setMode('inspect')`), nearly dark under raking light | Standards §3.1 |
| Gallery as a Gaussian splat | Not used | — | No license-clean capture available; modelled instead (plan §6.1 allows this) | DECISIONS.md D-08 |
| Characters (curator, visitors) | None | No | The curator speaks only through text. No animated figures | Plan §9 |
| Dust motes, lens flare, bloom, DOF | None | No | Seductive/decorative details are cut during tasks. Post-processing is limited to SMAA, AO (High+) and ACES tone mapping | Standards §2 (seductive details, decorative animation) |
| Label in the case (S2) | Medium: the learner's own text on a canvas texture | Yes (consequence) | Shows the product of the investigation in its public setting | — |

Text mode replaces the 3D view with renders of the same scans under the same lighting (`scripts/render-views.mjs`), including raking-light views and close-ups of each finding.
