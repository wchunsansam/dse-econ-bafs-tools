---
name: econ-notes
description: Edit DSE Economics class notes (econ_notes) to a shared classroom format. Use when changing chapter notes, drills, bilingual copy, illustrations, print/pen/share, exam tips, textbook boxes, or adding a new notes chapter.
---

# Economics class notes

Full spec: `econ_notes/SPEC.md`. Read it before adding a chapter or changing format. Teacher workflow and Markdown dialect: `econ_notes/README.md`.

## Source of truth

- Edit `econ_notes/src/chXX.body.html` or `econ_notes/src/*.md`. Never hand-edit assembled `econ_notes/chXX_*.html`.
- After content edits: `node econ_notes/build.mjs` from the repo root.
- Chrome: `econ_notes/lib/notes.css`, `econ_notes/lib/notes.js`. Metadata: `econ_notes/src/chXX.json`.
- Preview: `python -m http.server 8765` → `http://localhost:8765/econ_notes/…html` (not `file://`).
- Textbook scans (local, do not commit): `_tmp_chXX_chi/zh_pNN.png` and `eng/pNN.png`. PNG page N = printed page N.

## Hard rules

- Bilingual: every visible Chinese block needs an English twin (`.zh` / `.en` with `hidden` on English).
- Chinese notes follow the Chinese textbook; English notes follow the English textbook. They are not translations of each other. When fixing English, use the English book first.
- Quiz / Guided Example / Public Exam: copy that language’s textbook wording. Classroom names stay out of those boxes.
- Classroom-made copy (小練習、生活案例、課堂例子) uses HK Form 4 stories and the name pairs in SPEC.md. Do not paste long textbook cases.
- Official boxes follow **Chinese textbook page order**. Do not regroup by type.
- Numbered exam-tip points `(1) (2)` each get their own heading + body (or a list). Split run-on 「另外／Also」 clauses.
- Logic-chain diagrams must keep every textbook intermediate step (e.g. 借款意欲, 放款／儲蓄意欲). Use `.chain` for split-then-merge flows.
- Freeze `econ_notes/img/`. Do not regenerate unless asked. Default girl hair: shoulder-length, not a ponytail.
- Do not touch `econ_tools/deposit_creation.html`, `_tmp_*`, or seating-planner sync scripts.

## Publish

Only commit and push notes files when the user asks to 發布 / publish. Leave `_tmp_*` and `deposit_creation.html` out.
