# Sources

Every factual claim in the app or docs, the source opened, and its status. Access date for all: **2026-10-27**.

| # | Claim / use | Source (URL) | Status |
|---|---|---|---|
| 1 | Object facts (dates, makers, numbers, measurements, descriptions) for six NMAH objects | Smithsonian Open Access API, `https://api.si.edu/openaccess/api/v1.0/content/<id>` and category search; per-object URLs in `object-verification-log.md` | Verified (API responses saved in `data/raw/`, gitignored; fact audit unit test) |
| 2 | Each object and its 3D media are CC0 | Same API records (`metadata_usage.access`, `usage.access`) | Verified; screenshots in `cc0-proof/` |
| 3 | 3D scans downloadable as GLB | `https://3d-api.si.edu/content/document/3d_package:<id>/resources/…` | Verified (downloaded; glTF magic bytes checked) |
| 4 | Smithsonian 3D Open Access highlights / FAQ (plan references) | https://3d.si.edu/collections/openaccesshighlights, https://www.si.edu/openaccess/faq | **Could not open** (HTTP 403 to automated clients). Not cited for any claim; CC0 status taken from the API instead |
| 5 | Digital Inquiry Group (DIG) builds on "two decades as the Stanford History Education Group"; *Reading Like a Historian* lessons "teach students to think critically about the past and build arguments from evidence" | https://www.inquirygroup.org/ | Verified (page text read) |
| 6 | *Reading Like a Historian* curriculum "engages students in historical inquiry… a central historical question and… primary documents"; DIG publishes classroom posters for Sourcing, Contextualization, Corroboration and Close Reading, and a Historical Thinking Chart | https://www.inquirygroup.org/history-lessons ; https://www.inquirygroup.org/history-lessons/historical-thinking-chart | Verified for the names of the four skills and the chart's existence. The chart's full text sits behind a free login and was **not read**, so the game does not quote it |
| 7 | Realistic details can help or overwhelm learning depending on task relevance (realism rationale) | https://pmc.ncbi.nlm.nih.gov/articles/PMC11269326/ ("Are realistic details important for learning with visualizations or can depth cues provide…") | Verified (title + abstract read: "Previous studies suggest that realism can overwhelm learners, but a growing body of research demonstrates that realistic details can enhance learning") |
| 8 | Poly Haven assets are CC0 | https://polyhaven.com/license | Verified |
| 9 | ambientCG assets are CC0 1.0 | https://docs.ambientcg.com/license/ | Verified |
| 10 | US quarter: diameter 0.955 in (24.26 mm), thickness 0.069 in (1.75 mm) | Wikipedia "Quarter (United States coin)" (wikitext via API), citing coinfacts.com and the US Mint; https://en.wikipedia.org/wiki/Quarter_(United_States_coin) | Verified (secondary). The US Mint specification page returned 403 |
| 11 | Bank card (ISO/IEC 7810 ID-1): 85.60 × 53.98 mm | https://en.wikipedia.org/wiki/ISO/IEC_7810 | Verified (secondary) |
| 12 | Vercel limits: CLI static file uploads 100 MB (Hobby) / 1 GB (Pro); 15,000 source files per CLI deployment | https://vercel.com/docs/limits | Verified (page text). See DECISIONS.md D-12 |
| 13 | Raking light is a conservation/examination practice that reveals surface relief | General conservation practice named in the plan | **UNVERIFIED** in this repo: no source opened. The app describes what the tool does (low-angle light shows relief and faint marks), not a citation |
| 14 | Mayer multimedia principles; seductive details / decorative animation findings | Standards file `00-immersive-standards.md` section 2 | Not re-opened by this builder; used only as design rationale in `design/`, attributed to the standards file |

Nothing in the app states a fact about a real object that is not in its Smithsonian record. Everything else is either the builder's description of what is **visible in the scan** (labelled as such) or **fictional** (labelled "Fictional document created for this game").
