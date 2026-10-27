# Object verification log

Every object in the game is a **real Smithsonian Open Access 3D scan**, not a replica. This log records, for each one, the record URL, the CC0 proof, the facts used, and visible inscriptions/marks with how they were transcribed. Retrieved and verified 2026-10-27.

## How CC0 was verified

1. **Open Access API record** (`api.si.edu/openaccess/api/v1.0`). Each record carries `descriptiveNonRepeating.metadata_usage.access` and, for each media item, `usage.access`. `scripts/fetch-smithsonian-models.mjs` **refuses** to download unless both the record and its `3d_voyager` media item say `"CC0"`.
2. **Screenshots** (`research/cc0-proof/`):
   - `<slug>-api.jpg`: the API record, pretty-printed, with every `"access": "CC0"` highlighted. Three were captured live from the content endpoint. For chester-relay, page-induction-coil and tangent-galvanometer, DEMO_KEY was rate-limited (HTTP 429), so the screenshot renders the same API's search response saved earlier that day (`data/raw/si3d.json`). The image says so, and `capture-log.json` records `"source"` per object.
     - **Provenance dispute (agent review SP13, 2026-10-27):** for those same three objects `capture-log.json` records `"apiStatus": 200, "source": "live content endpoint"`, which contradicts the 429 account above. The two logs disagree and the original capture could not be re-verified, so those three entries are now marked `"sourceDisputed": true` in `capture-log.json`. This does not affect the CC0 finding: `data/raw/si3d.json` (saved 2026-10-27) shows `access: "CC0"` for all six records and their 3D media, and the unit-test fact audit re-checks it.
   - `<slug>-voyager.jpg`: the Smithsonian Voyager 3D viewer page for the 3D package (`3d-api.si.edu/voyager/3d_package:…`), showing the object title and Smithsonian branding. For some objects the viewer was still loading at capture time (bounding box only); the package ID in the URL is the proof link.
3. **Unit test fact audit** (`tests/unit/tools-and-facts.test.js`): re-checks CC0 on the saved record and 3D media for every object. It also checks that every fact string used in `content/objects.json` and every quoted excerpt in the case archives appears verbatim in the API record.

**Recon note:** `3d.si.edu`, `collections.si.edu` and `www.si.edu` return HTTP 403 ("request verification") to curl *and* to headless Chromium with a realistic User-Agent from this machine. The API and `3d-api.si.edu` respond normally. Downloads from `3d-api.si.edu` need a full browser User-Agent string; bare clients are rejected by the CDN.

**Scale check:** the GLBs are authored in metres. For five of the six objects, the scan's longest bounding-box side is within 2–4 % of the record's largest measurement (unit-tested). The tangent galvanometer's scan does not match its record (about 14.5 cm vs 21.59 cm), so the game never measures it and never shows it in the true-size view. It appears only as photos in the transfer task (see DECISIONS.md D-11).

## Objects

### 1. Morse-Vail Telegraph Key (tutorial case)
- Record: NMAH `nmah_1096762`, ID Number EM.181411 · https://n2t.net/ark:/65665/ng49ca746a9-46b1-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:ed99f44d-3c60-4111-b666-e2908e1b64ef
- CC0: record `CC0`, 3D media `CC0` (API, live). Proof: `cc0-proof/morse-vail-key-api.jpg`, `-voyager.jpg`
- Facts used (verbatim from record): Date made 1844; makers Vail, Alfred / Morse, Samuel Finley Breese; materials wood, brass; measurements "overall: 3 in x 2 in x 6 3/4 in; 7.62 cm x 5.08 cm x 17.145 cm"; credit line "from Western Union Telegraph Co."; description "Alfred Vail made this key, believed to be from the first Baltimore-Washington telegraph line, as an improvement on Samuel Morse's original transmitter…"
- Visible mark (from the scan): white painted numerals **181411** on one short end of the base. These are transcribed by the builder from renders. They match the record's catalog number 181411. The record has no inscription field, and the game never says who painted them. The expert path says the number "matches the catalog number".
- Scan longest side 16.9 cm vs record 17.145 cm.

### 2. Davenport electric motor, US patent #132 (main case)
- Record: NMAH `nmah_703302`, EM.252644 · https://n2t.net/ark:/65665/ng49ca746ab-d1df-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:a18922b9-a00f-4c9e-988a-f526382b15cc
- CC0: record `CC0`, 3D media `CC0` (API, live). Proof: `cc0-proof/davenport-motor-*.jpg`
- Facts used: date made ca 1837; maker Davenport, Thomas; object type Patent Model; patent number 132; measurements "overall: 15 in x 10 in x 15 in; 38.1 cm x 25.4 cm x 38.1 cm"; descriptions quoted verbatim, including "No extant markings", "four rough electro-magnets, painted red", "a replacement for his original patent model. The original was destroyed in the 1836 fire at the US Patent Office", "may have incorporated improvements…".
- Visible marks: none legible. The underside has a small square metal plate with no visible lettering, consistent with "No extant markings".
- Scan longest side 37.8 cm vs record 38.1 cm.

### 3. Henry trough battery (main case)
- Record: NMAH `nmah_703292`, EM.181178 · https://n2t.net/ark:/65665/ng49ca746a5-1ff7-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:1f7d20f0-6b3f-4780-b754-91c2f9f91602
- CC0: record `CC0`, 3D media `CC0` (API, live). Proof: `cc0-proof/henry-trough-battery-*.jpg`
- Facts used: date made 1832; object name Battery; **no maker listed**; credit line "from Mary A. Henry"; measurements "overall: 1 7/8 in x 8 in x 2 5/8 in; 4.7625 cm x 20.32 cm x 6.6675 cm"; "Currently not on view". The record has no description and no materials.
- Visible marks: faint pale characters near the middle of the underside, **not legible** in the scan. They are not transcribed, and the game says so.
- The claim "built by Joseph Henry himself" comes only from the **fictional** 1971 memo. The record does not name a maker, so the expert verdict is "can't tell yet". The game does not claim Henry did or did not build it.
- Scan longest side 19.9 cm vs record 20.32 cm.

### 4. Chester telegraph relay (main case)
- Record: NMAH `nmah_712417`, EM.335588 · https://n2t.net/ark:/65665/ng49ca746a5-3a3a-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:d44e9327-834b-47b7-aad6-6c416c9e1cbb
- CC0: record `CC0`, 3D media `CC0` (API search response saved 2026-10-27; live call rate-limited). Proof: `cc0-proof/chester-relay-*.jpg`
- Facts used: date made ca 1860; maker Chester, Charles T.; catalog number 335588; **serial number 589**; materials brass, marble, fabric, copper; measurements "overall: 3 1/2 in x 8 3/8 in x 5 3/8 in; 8.89 cm x 21.2725 cm x 13.6525 cm"; descriptions quoted verbatim.
- Visible mark: dark numerals **335.588** on one long edge of the marble base, transcribed from renders. They match catalog number 335588. The serial number 589 is a separate record field.

### 5. Page induction coil patent model, US #76654 (main case)
- Record: NMAH `nmah_703318`, EM.309254 · https://n2t.net/ark:/65665/ng49ca746b1-fe41-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:40cf5b52-0b21-4063-95fc-aa07998eb4dd
- CC0: record `CC0`, 3D media `CC0` (saved search response). Proof: `cc0-proof/page-induction-coil-*.jpg`
- Facts used: date made ca 1868; maker Charles G. Page; object type Patent Model; patent number 76654; catalog number 309254; measurements "overall: 7 in x 8 3/4 in x 4 3/4 in; 17.78 cm x 22.225 cm x 12.065 cm".
- Visible mark: **309254** handwritten in dark ink on one of the pale brackets holding the coil, transcribed from renders. It matches catalog number 309254.
- Scan longest side 23.1 cm vs record 22.225 cm (+4 %).

### 6. Western Electric tangent galvanometer (transfer task, photos only)
- Record: NMAH `nmah_703325`, EM.332099 · https://n2t.net/ark:/65665/ng49ca746a5-1ec6-704b-e053-15f76fa0b4fa
- 3D package: https://3d-api.si.edu/voyager/3d_package:b8360103-172b-4ab2-a6ac-ab7ee9786876
- CC0: record `CC0`, 3D media `CC0` (saved search response). Proof: `cc0-proof/tangent-galvanometer-*.jpg`
- Facts used: date made ca 1870; maker Western Electric; materials rubber, glass, brass, copper, steel (part); credit line "from Western Union Corporation"; measurements "overall: 8 1/2 in x 7 1/2 in x 8 in; 21.59 cm x 19.05 cm x 20.32 cm".
- Scale **not verified** (scan about 14.5 cm vs record 21.59 cm). Not measured in-game.

## Shortlist considered (from the API's history_culture category, 3D + CC0, 69 results)

Henry trough battery, Western Electric tangent galvanometer, Chester telegraph relay, Davenport electric motor, Page induction coil, Morse-Vail telegraph key, Abraham Lincoln's patent model, NMAAHC stereoscope, Thomas Commeraw stoneware jug, Bully beef can opener. The theme chosen was early electrical instruments, 1832 to ca 1870 (all NMAH "Work and Industry: Electricity"). Reasons: one coherent theme, catalog numbers visible on several scans (real evidence for a "what is this number?" claim), clear and dated records, and a documented uncertainty (the Davenport replacement model) that suits a "check the label" investigation.
