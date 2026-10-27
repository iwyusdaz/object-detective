# Agent review: expert-style reviews (simulated personas)

**Agent review — simulated persona.** These are not real experts. A reviewer sub-agent wrote them in the roles named in plan §10 ("museum educator" and "secondary history teacher"). The fact audit below was done by the agent against the saved Smithsonian Open Access API response `data/raw/si3d.json` (gitignored, present locally).

## Fact audit spot-check (plan §10)

I extracted the `freetext` fields of the six records from `data/raw/si3d.json` and compared them with the content files.

| # | In-app fact | Content location | Saved record (`si3d.json`) | Result |
|---|---|---|---|---|
| 1 | Relay: catalog 335588, serial 589, ca 1860, maker Chester, Charles T., 8 3/8 in longest | `content/cases/main.json` rec-relay excerpts; f-relay-number | `catalog number=335588`, `serial number=589`, `date made=ca 1860`, `maker=Chester, Charles T.`, `overall: 3 1/2 in x 8 3/8 in x 5 3/8 in` | **Match** |
| 2 | Davenport: EM.252644, patent 132, ca 1837, Patent Model, "replacement for his original patent model … destroyed in the 1836 fire" | rec-davenport; claims M2, M3 | All present verbatim in `Description (Brief)` | **Match** |
| 3 | Battery: 1832, no maker, credit "from Mary A. Henry", 8 in longest | rec-battery; claim M5 | No `name` field (no maker); `Credit Line=from Mary A. Henry`; `date made=1832` | **Match** |
| 4 | Coil: ca 1868, Charles G. Page, patent 76654, catalog 309254, Patent Model | rec-page; f-coil-number | All match | **Match** |
| 5 | Key: EM.181411, 1844, makers Vail and Morse, wood and brass, "believed to be from the first Baltimore-Washington telegraph line" | `content/cases/tutorial.json` rec-morse | All match verbatim | **Match** |
| 6 | Galvanometer: ca 1870, Western Electric, from Western Union Corporation | `content/items.json` transfer | All match | **Match** |
| 7 | M6 ranking: motor 15 in > coil 8 3/4 > relay 8 3/8 > battery 8 | main.json M6 expert | Matches the four records' largest dimensions | **Match** |
| 8 | Battery "about as long as a school ruler" | `content/text-mode/descriptions.json:26` | Record: 20.32 cm (8 in). A standard school ruler is 30 cm / 12 in | **Mismatch (minor)**: change to "about the length of a pencil" or "about 20 cm" |
| 9 | Relay credit line "from Janet Lewis" | `content/objects.json` | `Credit Line=from Janet Lewis` | Match (it is not shown in the rec-relay excerpts, which is fine) |

No fabricated record facts were found. The CC0 `access` field is `CC0` on all six records. **Audit gap:** the automated fact audit calls `ctx.skip()` when `data/raw/si3d.json` is missing (`tests/unit/tools-and-facts.test.js:74`). `data/raw/` is gitignored (`.gitignore`), so on a fresh clone and in CI the audit is silently skipped, while `STATUS.md` reports it as done. **Major.** Fix: commit a trimmed fixture of the six records (CC0 metadata) under `tests/fixtures/` and audit against that.

### Fictional labelling check
- Volunteer card, draft case label, 1971 memo and visitor card: all titles say "(fictional document created for this game)" (`tutorial.json:12`, `main.json:12,87,96`, `items.json:51`). Dashed card plus "Fictional document created for this game" badge in-app (`case-view.js:60`, `case-board.js:9`). **Pass.**
- The header says "the Lantern Museum (fictional)", and so do the Welcome copy and the S1 caption. **Pass.**
- UNVERIFIED: the only claim marked UNVERIFIED (raking light as conservation practice, `research/sources.md:19`) is not stated as fact in-app (`tool-pad.js:62` describes what the tool does). **Pass.**
- No compliance claims found. The README and accessibility plan say WCAG validation is not done. One exception: see E8.

---

## Persona 1: Museum educator (Agent review — simulated persona)
*Brief: runs online pre/post-visit activities; cares about real collection objects, honest licensing and how a museum actually works.*

| # | Severity | Finding | Fix |
|---|---|---|---|
| E1 | **major** | The fictional 1971 memo (`main.json:90`) records "a caller" whose "family always told the story" that Joseph Henry built the battery. The **real** credit line is "from Mary A. Henry". Learners will naturally read the caller as the real donor's family, so the game puts an invented oral tradition beside a real family. It is labelled fictional, but the line between fiction and the record blurs at exactly the point the case is testing. | Make the caller explicitly unconnected ("a caller who said her grandfather knew the Henry family (fictional)"), or add to the memo's sourcing note: "The caller is fictional and is not the real donor" |
| E2 | major | M5 teaches "a shared name is a clue, not proof", which is good, but it skips **provenance**, the museum concept the credit line actually carries. "From Mary A. Henry" says who gave the object, which bears on the claim more than the title does. The expert text treats the credit line only as a surname match. | Add one sentence to M5 `expert`: "The credit line tells us who gave it to the museum (its provenance). A donor with the Henry name makes the family link likely, but it still does not tell us who built it." Add a provenance item to the sourcing questions |
| E3 | major | The expert text for T2 asserts "Museums often paint a catalog number on an object" (`tutorial.json:29`). This is true of museum practice, but it is an unsourced generalisation in a game about sourcing, and the verification log says the game "never says who painted them" (`research/object-verification-log.md:24`). This is a small inconsistency. | Rephrase: "The painted number matches the museum's catalog number, so it is most likely a museum number. Nothing in the record calls it a factory or serial number." |
| E4 | minor | Catalog-number formats differ (335.588 painted, 335588 in the record, EM.335588 as the ID). The game explains the match, but it never says why a dot appears or what "EM" means. A short "How museums number things" aside would turn a trick into collections literacy. | Add a disclosure in the Archive: "EM = the Electricity collection prefix at NMAH" **only if** a source is found; otherwise just say the formats differ and mark it UNVERIFIED |
| E5 | minor | Each record's sourcing "date" is "Retrieved 2026-10-27 from the Smithsonian Open Access API" (`main.json` rec-*). This conflates *when the record was written* with *when we downloaded it*, which is the sourcing distinction learners are being taught. | Use "Date written: not stated (catalog records are updated over time). Retrieved 2026-10-27." |
| E6 | minor | The tutorial exemplar says "The Smithsonian believes this key came from the first Baltimore–Washington line" (`tutorial.json:110`). That is faithful, and a strong model of hedged label writing. Keep it. | — |
| E7 | minor | The "Open the real Smithsonian record" links use n2t ARKs, which are good persistent IDs. On collections.si.edu, the target sometimes returns 403 to non-browser clients (per the verification log). | None needed; maybe note "opens collections.si.edu" |

## Persona 2: Secondary history teacher (Agent review — simulated persona)
*Brief: Mr. Haddad, 40-minute period, mixed devices, needs a lesson plan and the historical-thinking link.*

| # | Severity | Finding | Fix |
|---|---|---|---|
| E8 | major | `design/teacher-guide.md:3` says "Text mode works on low-end devices and **with screen readers**". The README and accessibility plan say screen-reader testing has not been done. This is an untested claim in the document teachers will rely on. | Change to "Text mode is designed for screen readers (not yet tested with one)" |
| E9 | major | Timing. The guide gives 5 minutes (3–8 min) for the pre-check **and** all of Case 1: 4 findings, 8 classifications, 1 record, 3 claims with pins, verdicts and confidence, and a label. Case 2 gets 20 minutes for 10 findings, 20 classifications, 6 documents, 2 sourcing questions, 6 claims and a label. In a 40-minute period most grade 8–10 students will not reach the transfer task or the debrief. | Re-time the plan with a 2-period option, or let Case 2 be split across two lessons (save/resume already exists); mark the label step "can be homework" |
| E10 | minor | The guide says "The five objects are real" (`teacher-guide.md:5`). There are six: 5 case objects plus the transfer galvanometer. | Say "six" |
| E11 | minor | The learning record is per-browser JSON (Menu → My progress). For a class set there is no way to collect or summarise results. Teachers will ask students for screenshots of the debrief. | Add a "Copy my debrief summary" button that produces plain text a student can paste into an LMS |
| E12 | minor | The discussion questions (`teacher-guide.md`) are strong and tied to the trickiest claims (M4, M5). The answer key matches the content files exactly. | — |
| E13 | minor | The magnifier bug (visual review V1) would derail a live class on the first magnifier hotspot, in Case 1, minute 5. Teachers have no workaround in the guide. | Fix V1; until then, add "If the object disappears, switch to Text mode" to the guide |
