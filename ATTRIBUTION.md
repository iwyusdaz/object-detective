# Attribution

Every third-party asset in the build. `public/attribution.json` is generated from the table below by `scripts/gen-attribution.mjs` (run on every build), so the two stay in sync.

All 3D scans are real Smithsonian Open Access objects whose records AND 3D media are marked CC0 (checked by `scripts/fetch-smithsonian-models.mjs`, which refuses non-CC0 items; proof in `research/object-verification-log.md` and `research/cc0-proof/`). Retrieved 2026-10-27.

## Assets

| Asset | Author | Source | License | Changes |
|---|---|---|---|---|
| 3D scan: Morse-Vail Telegraph Key (NMAH, EM.181411) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:ed99f44d-3c60-4111-b666-e2908e1b64ef | CC0 1.0 | Unmodified std Draco GLB (2048 px) and 150k-4096 GLB, renamed with a content hash |
| 3D scan: Davenport electric motor, US patent #132 (NMAH, EM.252644) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:a18922b9-a00f-4c9e-988a-f526382b15cc | CC0 1.0 | Unmodified std Draco GLB (2048 px), renamed with a content hash |
| 3D scan: Henry trough battery (NMAH, EM.181178) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:1f7d20f0-6b3f-4780-b754-91c2f9f91602 | CC0 1.0 | Unmodified std Draco GLB (2048 px) and 150k-4096 GLB, renamed with a content hash |
| 3D scan: Chester telegraph relay (NMAH, EM.335588) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:d44e9327-834b-47b7-aad6-6c416c9e1cbb | CC0 1.0 | Unmodified std Draco GLB (2048 px) and 150k-4096 GLB, renamed with a content hash |
| 3D scan: Page induction coil patent model, US #76654 (NMAH, EM.309254) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:40cf5b52-0b21-4063-95fc-aa07998eb4dd | CC0 1.0 | Unmodified std Draco GLB (2048 px) and 150k-4096 GLB, renamed with a content hash |
| 3D scan: Western Electric tangent galvanometer (NMAH, EM.332099) | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:b8360103-172b-4ab2-a6ac-ab7ee9786876 | CC0 1.0 | Unmodified std Draco GLB (2048 px), renamed with a content hash; used for photos in the transfer task |
| Object record metadata (6 records above) | Smithsonian Institution | https://api.si.edu/openaccess/api/v1.0/ (Open Access API) | CC0 1.0 | Excerpts quoted verbatim in content/objects.json and case archives |
| HDRI: Brown Photostudio 02 (1k) | Sergej Majboroda | https://polyhaven.com/a/brown_photostudio_02 | CC0 1.0 | None (renamed with a content hash) |
| Texture: Wood Floor 043 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=WoodFloor043 | CC0 1.0 | Colour, NormalGL, Roughness maps resized to 1024 px, re-encoded JPEG |
| Texture: Plaster 001 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Plaster001 | CC0 1.0 | Colour, NormalGL, Roughness maps resized to 512 px, re-encoded JPEG; tinted in-engine |
| Texture: Fabric 026 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Fabric026 | CC0 1.0 | Colour, NormalGL, Roughness maps resized to 512 px, re-encoded JPEG; tinted in-engine |
| Text-mode photo sets (public/assets/photos) | Rendered by this project from the CC0 scans above | scripts/render-views.mjs | CC0 1.0 (derived from CC0 scans) | Renders of the scans in the game's inspection lighting |
| Draco and Basis decoders | Google (Draco), Binomial (Basis Universal), via three.js 0.186.1 | https://github.com/mrdoob/three.js/tree/r186/examples/jsm/libs | Apache-2.0 | Copied unmodified into dist/decoders at build time |
| Gallery architecture, display cases, inspection table, sweep, reference ruler/coin/card models, favicon | Built for this project (procedural) | This repository | MIT (code) / CC BY 4.0 (content) | Original |

## Fictional elements

The Lantern Museum, its staff, the volunteer "R. Fenwick", "J.T.", the draft label cards, the 1971 memo and the visitor comment card are fictional, created for this game, and labelled as fictional in the app.

## Not used

No Mixamo assets, no NC/ND assets, no real person's likeness, no third-party runtime requests.
