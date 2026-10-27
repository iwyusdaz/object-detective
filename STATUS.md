# Status

Status values: **done**, **done (agent review)** (done, with an agent review still to come), **not possible** (reason given), **owner** (needs the repo owner or orchestrator).

## Final Quality Checklist (plan §14)

| Item | Status | Evidence |
|---|---|---|
| CC0 proof for every object | done | `research/object-verification-log.md`, `research/cc0-proof/` (API licence fields + Voyager page, 6 objects); fetch script refuses non-CC0; unit test re-checks |
| Every real-object fact sourced from its record | done (agent review) | Fact-audit unit test, run in CI against the committed CC0 fixture `tests/fixtures/si-records.json`: every fact string and quoted excerpt appears verbatim in the record. Visible numbers transcribed from renders and matched to the catalog numbers. The agent spot-check found 0 fabricated facts and 1 minor mismatch (the battery "ruler" comparison, fixed in R-10) |
| Fictional documents labelled | done | "Fictional document created for this game" on every fictional item (content audit + unit test); dashed card + ✎ badge in-app |
| Both cases solvable; scripted playthrough passes | done | Unit solvability + expert playthrough; Playwright: tutorial (3D), Case 2 (3D and text mode) |
| Text mode supports every decision | done (agent review) | Same `CaseView`/`CaseEngine`; Case 2 solved in text mode by test; `design/text-mode.md` |
| Cinematics ≤ 90 s, skippable, captioned | done | 32 s total (S1 18 s, S2 14 s); Esc/Skip tested; captions + description + reduced-motion stills tested |
| Performance budgets met | done (orchestrator, headed Apple M1, 2026-10-27 after the revisions): Medium 60 fps (budget ≥ 55), 37 draw calls, 300k triangles, menu interactive 0.10 s, 3.18 MB before first interaction. High 42 fps / Ultra 32 fps — the AO+MSAA pass costs frame rate on the optional presets; documented in `evaluation/results/perf-2026-10-27.json` |
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
| Cinematic budget ≤ 90 s; verification and reviews done; ≥ 5 revisions documented | done / done (agent review) / 8 builder revisions + 13 review revisions in DECISIONS.md |

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
| 9 Content, verification, reviews, write-up | done (agent review) | 7 agent reviews + an independent second pass in; 13 + 14 revisions made; trailer pending (orchestrator) |

## Agent review and revisions

| Item | Status | Evidence |
|---|---|---|
| Agent reviews (7 reports: visual, heuristics, cognitive walkthrough, multimedia, realism/cinematics, accessibility, expert-style personas) | done (agent review) | `evaluation/reviews/agent-review-*.md` + `screenshots/`. These are reviewer sub-agents, not experts, learners or assistive-technology users |
| Second-pass independent review (fresh reviewer, post-R-01..R-13 evidence spot-checks) | done (agent review) | `evaluation/reviews/agent-review-second-pass.md` + `screenshots/second-pass/`. 0 critical, 6 major, 7 minor; its fact spot-check (F1–F11) matched all 11 visible facts |
| Revisions from the reviews | done | 13 revisions (R-01–R-13) from the first seven reports plus 14 second-pass entries (SP-01–SP-14) in DECISIONS.md "Revision log", each with finding → change → evidence |
| Fact audit runs in CI | done | `tests/fixtures/si-records.json` (6 trimmed CC0 records with licence fields) is committed. `tests/unit/tools-and-facts.test.js` audits it with no skip. The raw `data/raw/si3d.json` is only an optional refresh check |

### Open findings (not fixed in this revision pass)
- **Magnifier lens shows a faint square behind the ring** (second pass SP3, minor): the scissor render is square while the lens is a CSS circle. Proper fix is a render target with a circular composite or a stencil mask; deferred as risky for the remaining revision time.
- **CC0 screenshot provenance is disputed for 3 of 6 objects** (SP13, minor): `capture-log.json` says "live content endpoint" where the verification log says the saved search response was rendered; both files now record the dispute (`sourceDisputed: true`). Re-capturing needs live API access (owner).
- **Camera moves not announced** (accessibility A4; heuristics H6): turn and tilt give no live-region text or view readout. Open for lack of time; POI jumps, flips and raking changes are announced.
- **Nested live regions** (A5), **canvas label static** (A7), **no single-key shortcut off switch** (A9), **`.tool-hint` size** (A10), **Tab distance to the POI list** (A11): minor; open for lack of time.
- **Tool pad covers about 25% of the viewport** (V5): partly addressed — the pad is collapsible everywhere and starts collapsed on phones (SP6); the desktop default remains open. **Ceiling, plinths, S1 first frame, Davenport shadow** (V6–V10, C6, MM2): visual polish, open. V8/C6 need a re-framed S1 path and fresh screenshots. The per-preset screenshots in the reviews predate the SP1/SP2 post-pipeline fixes.
- **No in-scene ring at the mark** (MM3, partly done: the lens now starts on the mark). **Close-up render beside the statements in 3D** (MM4), **evidence board segmenting** (MM6), **records glossary** (MM7): open.
- **Memo caller vs the real donor** (E1), **provenance in M5** (E2), **"Museums often paint…" generalisation** (E3), **record "date" wording** (E5), **EM prefix** (E4: needs a source, otherwise UNVERIFIED): content edits, open. They need care so the fiction/record line stays clear.
- **Lesson timing / two-period option** (E9), **copy debrief summary** (E11), **Case 2 opt-in hints** (H7), **auto-open tool section** (H8), **status line count** (H9), **Brier wording** (H10), **pre-check counter**, **Archive "opened" marker**: open for lack of time.
- **`bloom-light` in preset config** (R2), **S2 empty-label fallback test** (C7): minor, open.
- A real screen-reader pass is still needed (owner or orchestrator).

## Known gaps
- No hand silhouette in the true-size view. A hand's size varies too much to be a reliable reference, so a ruler, a coin and a card are used instead.
- No trailer yet. Recording the trailer is left to the orchestrator.
- The Smithsonian 3d.si.edu website could not be screenshotted (HTTP 403). Proof comes from the API and the Voyager viewer instead.
