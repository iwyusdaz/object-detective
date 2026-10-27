# Case design

Content: `content/cases/tutorial.json`, `content/cases/main.json`. Solvability is checked by `CaseEngine.solvability()` (unit test) and by scripted UI playthroughs of both cases (functional tests).

## Case 1 (tutorial): "The key with a number"
Object: the Morse-Vail telegraph key. Fictional volunteer card with 3 claims:

| Claim | Expert verdict | Key evidence | Skill |
|---|---|---|---|
| T1 Brass and wood | Confirmed | Record materials, plus the scan (wood grain, metal parts) | Corroborate scan + record |
| T2 Painted 181411 is a factory date/serial | Refuted | Finding f-number (magnifier) + record catalog number 181411 | Observation vs inference; corroboration |
| T3 This key sent the first message in 1844 | **Can't tell yet** | Record: "*believed to be* from the first Baltimore-Washington line" | Close reading of hedges |

Tutorial support: tool hints, "How a historian sources this" shown openly, not scored.

## Case 2: "The Sparks case label"
Objects: Davenport motor (ca 1837), Henry trough battery (1832), Chester relay (ca 1860), Page induction coil (ca 1868). Fictional unsigned draft label with 6 claims:

| Claim | Expert verdict | Key evidence | Red herring / trap |
|---|---|---|---|
| M1 All made in the 1830s | Refuted | Relay record (ca 1860), coil record (ca 1868) | Two objects *are* 1830s, so partial support tempts "confirmed" |
| M2 Motor is the very 1837 patent model | Refuted | Davenport record: replacement; original destroyed in the 1836 fire | The record title says "US patent #132" |
| M3 Two are patent models | Confirmed | Motor and coil records: object type "Patent Model" | Nuance: the motor is a replacement patent model |
| M4 Number on the relay base is its serial number | Refuted | Finding f-relay-number (335.588) + record: catalog number 335588, serial number 589 | **The relay does have a serial number (589)**; it is just not the visible one |
| M5 Joseph Henry built the battery | **Can't tell yet** | Battery record: no maker listed; credit line "from Mary A. Henry"; fictional 1971 memo (family story, second-hand, about 140 years later) | Shared surname; illegible underside characters (f-bat-stamp) tempt "his signature" |
| M6 Largest object is the motor | Confirmed | Measurement on the scan (about 38 cm) + record | Requires the measuring tool |

Distractor findings with no key role (f-dav-magnets, f-dav-base, f-bat-plates, f-relay-base, f-relay-length, f-coil-number, f-coil-length) still give observation/inference practice, and several act as corroborating context. For example, f-coil-number shows the coil's catalog number pattern, which mirrors M4.

### Scoring (Case 2 only)
- Verdict accuracy: n of 6 match the expert.
- Evidence linked: a claim counts when at least one *key* item is pinned with the expert relation and no key item is pinned the opposite way.
- Calibration: Brier score over confidence levels (Guessing 0.4, Somewhat 0.6, Fairly 0.8, Certain 0.95), plus mean confidence vs accuracy, and a list of claims answered "very sure but wrong".
- Label: self-check on the 4-criterion rubric. Not auto-graded.

## Expert reasoning path
Each claim's `expert` text is shown in the debrief beside the learner's verdict, together with the curator's exemplar label and links to the real Smithsonian records and 3D viewer.

## Transfer
Western Electric tangent galvanometer (photos + record excerpt, no hints): 3 observation/inference statements, 3 claims on a fictional visitor card (confirmed / refuted / refuted), and a one-sentence label.
