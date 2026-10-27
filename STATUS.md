# Status

Status values: **done**, **done (agent review)** (done, with an agent review still to come), **not possible** (reason given), **owner** (needs the repo owner or orchestrator).

## Final Quality Checklist (plan §14)

| Item | Status | Evidence |
|---|---|---|
| CC0 proof for every object | done | `research/object-verification-log.md`, `research/cc0-proof/` (API licence fields + Voyager page, 6 objects); fetch script refuses non-CC0; unit test re-checks |
| Every real-object fact sourced from its record | done (agent review) | Fact-audit unit test: every fact string and quoted excerpt appears verbatim in the saved API record. Visible numbers transcribed from renders and matched to the catalog numbers. A reviewer spot-check is pending |
| Fictional documents labelled | done | "Fictional document created for this game" on every fictional item (content audit + unit test); dashed card + ✎ badge in-app |
| Both cases solvable; scripted playthrough passes | done | Unit solvability + expert playthrough; Playwright: tutorial (3D), Case 2 (3D and text mode) |
| Text mode supports every decision | done (agent review) | Same `CaseView`/`CaseEngine`; Case 2 solved in text mode by test; `design/text-mode.md` |
| Cinematics ≤ 90 s, skippable, captioned | done | 32 s total (S1 18 s, S2 14 s); Esc/Skip tested; captions + description + reduced-motion stills tested |
| Performance budgets met | not possible (builder) | Headed GPU runs and Lighthouse are the orchestrator's job. Download sizes, triangle counts and file sizes are within budget (evaluation/METHODS.md) |
| Release `v1.0.0` published with the build archive, checksum and `showcase.json`; sub-path test passes | owner | Sub-path test passes; `showcase.json` validates (`node scripts/validate-showcase.mjs 1.0.0`); release workflow ready. The builder was told not to tag |
| README: play link, trailer, realism rationale, evaluation notice | done (trailer: owner) | README has the notice verbatim, the play link (pending deployment), the realism section, and a trailer placeholder |

## Success criteria (plan §2)

| Criterion | Status |
|---|---|
| 2 cases: tutorial (1 object) + main (3–4 objects + archival records) | done (tutorial: Morse-Vail key; main: 4 objects, 4 real records + 2 fictional documents) |
| Tools: orbit/zoom, raking light, magnifier, scale measurement, side-by-side compare | done (plus preset views, turn over, true size) |
| Evidence board with confidence ratings; corrected-label writer | done |
| Every object verified CC0 with its Smithsonian record linked | done (record + Voyager links in the archive, the debrief and the transfer task) |
| Real-object facts match the record; fiction only in the framing, labelled | done |
| Text mode with parity (multi-angle photos, descriptions, verified transcriptions) | done (8 views + 1 close-up per finding; transcriptions checked against catalog numbers) |
| True-size view (hand/coin/ruler) | done (ruler, quarter, bank card; no hand silhouette, see below) |
| Versioned release build meeting the build contract | done (tag: owner) |
| Cinematic budget ≤ 90 s; verification and reviews done; ≥ 5 revisions documented | done / reviews pending / 8 revisions in DECISIONS.md |

## Phases (plan §8)

| Phase | Status | Notes |
|---|---|---|
| 0 Setup | done | Template copied; exact-pinned deps; CI + release workflows; ports 4374 / 4380 |
| 1 Object research + verification | done | 10 shortlisted, 5 + 1 transfer chosen; DIG verified; deviation D-03 (proof method) |
| 2 Case + learning design | done | `design/case-design.md`, rubric, exemplars, transfer, teacher guide |
| 3 Asset pipeline | done | `fetch-smithsonian-models.mjs`, `prepare-models.mjs`, `prepare-textures.sh`, `render-views.mjs`; deviation D-07 (no re-decimation; 4096 px on demand) |
| 4 Environment + rendering | done | Modelled gallery, inspection sweep, raking light, presets, SMAA/N8AO/ACES |
| 5 Tools + systems | done | All tools; case engine; save/resume; local learning record |
| 6 Cinematics | done | S1, S2 in `content/cinematics.json` |
| 7 UI, text mode, a11y | done (agent review) | axe clean in all states; remappable keys; screen-reader testing not done |
| 8 True-size + release build | done (tag: owner) | Poster 1200×630 (webp 11 KB, jpg 30 KB) from the real scene |
| 9 Content, verification, reviews, write-up | done (agent review) | Reviews and trailer pending (orchestrator) |

## Known gaps
- No hand silhouette in the true-size view. A hand's size varies too much to be a reliable reference, so a ruler, a coin and a card are used instead.
- No trailer yet. Recording the trailer is left to the orchestrator.
- The Smithsonian 3d.si.edu website could not be screenshotted (HTTP 403). Proof comes from the API and the Voyager viewer instead.
