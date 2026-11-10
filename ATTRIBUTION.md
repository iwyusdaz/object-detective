# Attribution

Every third-party asset in the build. `public/attribution.json` is generated from the table below by `scripts/gen-attribution.mjs` (run on every build), so the two stay in sync.

All 3D scans are real Smithsonian Open Access objects whose records AND 3D media are marked CC0 (checked by `scripts/fetch-smithsonian-models.mjs`, which refuses non-CC0 items; proof in `research/object-verification-log.md` and `research/cc0-proof/`). Retrieved 2026-10-27.
The v3.0.0 assets (rows marked v3, and everything under `public/assets/v3/`) are fetched by `scripts/fetch-v3-assets.mjs`, which checks each licence at the source before downloading and refuses anything outside CC0 1.0, public domain, CC BY 4.0 or own work. Its evidence is in `research/v3-licence-log.json`; the file manifest is `content/assets-v3.json`. Retrieved 2026-10-30.

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
| 3D model: Chandelier 01 | Kirill Sannikov | https://polyhaven.com/a/Chandelier_01 | CC0 1.0 | GLB re-encoded (resized textures); ceiling light prop |
| 3D model: Vintage Grandfather Clock 01 | Yann Kervran, James Ray Cock | https://polyhaven.com/a/vintage_grandfather_clock_01 | CC0 1.0 | GLB re-encoded; pendulum animated in-engine |
| 3D model: Wooden Bookshelf Worn | Ulan Cabanilla | https://polyhaven.com/a/wooden_bookshelf_worn | CC0 1.0 | GLB re-encoded; archive corner shelving |
| 3D model: Drawer Cabinet | Ulan Cabanilla | https://polyhaven.com/a/drawer_cabinet | CC0 1.0 | GLB re-encoded; archive corner cabinet |
| 3D model: Desk Lamp Arm 01 | Yann Kervran, Kuutti Siitonen | https://polyhaven.com/a/desk_lamp_arm_01 | CC0 1.0 | GLB re-encoded; inspection desk lamp (lit) |
| 3D model: Ceramic Vase 01 | James Ray Cock | https://polyhaven.com/a/ceramic_vase_01 | CC0 1.0 | GLB re-encoded; shelf dressing |
| 3D model: Lantern 01 | Rajil Jose Macatangay | https://polyhaven.com/a/Lantern_01 | CC0 1.0 | GLB re-encoded; shelf dressing |
| Font: Libre Baskerville (700) — v3 display face (S0 pair A) | Pablo Impallari, Rodrigo Fuenzalida (The Libre Baskerville Project Authors) | https://github.com/impallari/Libre-Baskerville | SIL Open Font License 1.1 | Latin subset WOFF2 from @fontsource/libre-baskerville 5.x, self-hosted (src/styles/fonts) |
| Font: Source Sans 3 (400, 600) — v3 body and UI face (S0 pair A) | Paul D. Hunt (Adobe) | https://github.com/adobe-fonts/source-sans | SIL Open Font License 1.1 | Latin subset WOFF2 from @fontsource/source-sans-3 5.x, self-hosted (src/styles/fonts) |
| Text-mode photo sets (public/assets/photos) | Rendered by this project from the CC0 scans above | scripts/render-views.mjs | CC0 1.0 (derived from CC0 scans) | Renders of the scans in the game's inspection lighting |
| Draco and Basis decoders | Google (Draco), Binomial (Basis Universal), via three.js 0.186.1 | https://github.com/mrdoob/three.js/tree/r186/examples/jsm/libs | Apache-2.0 | Copied unmodified into dist/decoders at build time |
| Gallery architecture, display cases, inspection table, sweep, reference ruler/coin/card models, favicon | Built for this project (procedural) | This repository | MIT (code) / CC BY 4.0 (content) | Original |
| 3D scan: Abraham Lincoln's Patent Model (NMAH, PL.031940) — v3 neighbouring exhibit | Smithsonian National Museum of American History (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:9172faae-dbbe-424a-a9e7-56f4428a06dd | CC0 1.0 | Unmodified std Draco GLB (2048 px), renamed with a content hash (public/assets/v3/exhibits) |
| 3D scan: Refrigerator patent model made by Thomas Elkins (NMAAHC, 2012.113.2) — v3 neighbouring exhibit | Smithsonian National Museum of African American History and Culture (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:b91a2ad6-f8dd-4903-a084-90f5c5c8b9e8 | CC0 1.0 | Unmodified std Draco GLB (2048 px), renamed with a content hash (public/assets/v3/exhibits) |
| 3D scan: Stereoscope, A. Mattey, Paris (NMAAHC, 2017.111.16, gift of Alan Laird) — v3 neighbouring exhibit | Smithsonian National Museum of African American History and Culture (3D: Smithsonian Digitization Program Office) | https://3d-api.si.edu/voyager/3d_package:0f4ebbe5-7f32-4792-933c-296f328df4c5 | CC0 1.0 | Unmodified std Draco GLB (2048 px), renamed with a content hash (public/assets/v3/exhibits) |
| Object record metadata (3 v3 neighbouring exhibits above) | Smithsonian Institution | https://api.si.edu/openaccess/api/v1.0/ (Open Access API) | CC0 1.0 | Facts paraphrased or quoted in content/objects.json (catalog "objects") |
| Painting image: Susan Walker Morse (The Muse), Samuel F. B. Morse, ca. 1836–37 (Met 45.62.1, Bequest of Herbert L. Pratt, 1945) | The Metropolitan Museum of Art (Open Access) | https://www.metmuseum.org/art/collection/search/11605 | CC0 1.0 | Resized to 1024 and 2048 px (long edge), KTX2 ETC1S with mipmaps (public/assets/v3/paintings) |
| Painting image: Mathew B. Brady, Charles Loring Elliott, 1857 (Met 96.24, Gift of the Friends of Mathew Brady, 1896) | The Metropolitan Museum of Art (Open Access) | https://www.metmuseum.org/art/collection/search/10850 | CC0 1.0 | Resized to 1024 and 2048 px (long edge), KTX2 ETC1S with mipmaps (public/assets/v3/paintings) |
| 3D model: Ottoman 01 (v3 gallery bench) | Caspian Fortune | https://polyhaven.com/a/Ottoman_01 | CC0 1.0 | 1k glTF re-packed as GLB: meshopt + quantization, textures KTX2 (colour 1024 px ETC1S, normal 512 px UASTC) |
| 3D model: Security Camera 01 | Alexander Otterbeck, Yann Kervran | https://polyhaven.com/a/security_camera_01 | CC0 1.0 | 1k glTF re-packed as GLB: meshopt + quantization, textures KTX2 (colour 1024 px ETC1S, normal 512 px UASTC) |
| 3D model: Magnifying Glass 01 | Nazar Borodavka | https://polyhaven.com/a/magnifying_glass_01 | CC0 1.0 | 1k glTF re-packed as GLB: meshopt + quantization, textures KTX2 at 512 px |
| Texture: Wood 051 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Wood051 | CC0 1.0 | Colour and Roughness 1024 px KTX2 ETC1S, NormalGL 512 px KTX2 UASTC (public/assets/v3/textures) |
| Texture: Marble 012 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Marble012 | CC0 1.0 | Colour and Roughness 1024 px KTX2 ETC1S, NormalGL 512 px KTX2 UASTC |
| Texture: Cork 002 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Cork002 | CC0 1.0 | Colour, NormalGL, Roughness at 512 px, KTX2 |
| Texture: Metal 048 A (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Metal048A | CC0 1.0 | Colour, NormalGL, Roughness, Metalness at 512 px, KTX2 |
| Texture: Fabric 085 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Fabric085 | CC0 1.0 | Colour, NormalGL, Roughness at 512 px, KTX2; to be tinted in-engine |
| Texture: Fingerprints 002 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Fingerprints002 | CC0 1.0 | Roughness map only, 1024 px KTX2 (glass smudges) |
| Texture: Paper 004 (1K) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Paper004 | CC0 1.0 | Colour, NormalGL, Roughness at 512 px, KTX2 |
| Textures: exit sign face, night facade across the street | Built for this project (scripts/fetch-v3-assets.mjs; exit-sign lettering set in Source Sans 3, SIL OFL 1.1) | This repository | CC BY 4.0 (content) | Original, generated with ImageMagick; KTX2 (public/assets/v3/own) |
| Posters (`public/poster-3.0.1.webp`, `.jpg`) | This project (original work) | This repository | CC BY 4.0 (content) | Headed-GPU screenshot of the v3 inspection table (overlay hidden), 1200 × 630; the object in it is the Smithsonian CC0 scan credited above. Replaces the v2 posters. |

## Fictional elements

The Lantern Museum, its staff, the volunteer "R. Fenwick", "J.T.", the draft label cards, the 1971 memo and the visitor comment card are fictional, created for this game, and labelled as fictional in the app.

## Not used

No Mixamo assets, no NC/ND assets, no real person's likeness, no third-party runtime requests.
