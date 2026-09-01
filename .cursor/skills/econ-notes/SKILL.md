---
name: econ-notes
description: Design and edit DSE Economics class notes (econ_notes) and chapter labs using a shared classroom format. Use when adding a notes chapter, changing layout or bilingual copy, writing drills or exam tips, planning widgets/labs, or when the user mentions 課堂筆記, 規格, Note_Spec, fill-in, 點揭, 畫筆, or textbook boxes.
---

# Economics class notes

This is a **classroom demonstration system**, not a textbook reprint. The next chapter must reuse the same logic, chrome, and copy rules. Do not invent a new layout.

**Canonical pack (read these, not the assembled HTML):**

| Read | When |
|---|---|
| [econ_notes/Note_Spec/README.md](econ_notes/Note_Spec/README.md) | First. Map of the pack. |
| [econ_notes/Note_Spec/PRINCIPLES.md](econ_notes/Note_Spec/PRINCIPLES.md) | New chapter, format change, or “how should this feel”. |
| [econ_notes/Note_Spec/CONTENT.md](econ_notes/Note_Spec/CONTENT.md) | Any wording, bilingual, boxes, names, exam tips. |
| [econ_notes/Note_Spec/LAYOUT.md](econ_notes/Note_Spec/LAYOUT.md) | Structure, CSS classes, modes, print, pen. |
| [econ_notes/Note_Spec/TOOLS.md](econ_notes/Note_Spec/TOOLS.md) | Chapter labs / in-note tool links. |
| [econ_notes/Note_Spec/WORKFLOW.md](econ_notes/Note_Spec/WORKFLOW.md) | Files, build, preview, homepage, publish. |
| [econ_notes/Note_Spec/CHECKLIST.md](econ_notes/Note_Spec/CHECKLIST.md) | Before calling a chapter done. |

Existing chapter HTML is an **implementation**. Copy **patterns**, never chapter-specific stories, definitions, or box text.

## Hard rules (do not violate)

- Edit `econ_notes/src/` only. Never hand-edit assembled `econ_notes/chXX_*.html`.
- After content edits: `node econ_notes/build.mjs` from the repo root.
- Every visible Chinese block has an English twin (`.zh` / `.en`, English starts `hidden`).
- Chinese notes follow the Chinese textbook; English notes follow the English textbook. They are **not** translations of each other.
- Quiz / Guided Example / Public Exam: copy that language’s textbook wording. Classroom names stay out.
- Classroom copy (小練習、生活案例、課堂例子) uses HK Form 4 life and the name table in CONTENT.md. Do not paste long textbook cases.
- Official boxes follow **Chinese textbook page order**. Do not regroup by type.
- Numbered exam-tip points each get their own heading + body. Split run-on 「另外／Also」 clauses.
- Logic chains keep every textbook intermediate step. Use `.chain` for split-then-merge.
- Freeze `econ_notes/img/` unless the teacher asks for a new drawing.
- Do not touch `econ_tools/deposit_creation.html`, `_tmp_*`, or seating-planner sync scripts.
- Do not rebuild PWA / service worker / offline pack inside a chapter.
- Commit and push notes **only** when the user says 發布 / publish.

## Preview

`python -m http.server 8765` → `http://localhost:8765/econ_notes/…html` (never `file://`).
