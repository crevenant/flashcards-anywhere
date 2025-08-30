Flashcards (SQLite)
===================

Minimal web app to view and add flashcards backed by SQLite. No external dependencies are required; it uses Python's standard library HTTP server and the built-in `sqlite3` module.

Prerequisites
-------------
- Python 3.9+ installed and available on PATH (`python` or `py`)

Run
---
- From the project root:

  - Windows PowerShell: `python .\server.py`
  - Or: `py .\server.py`
  - Unix-like: `python3 server.py`

- Open `http://127.0.0.1:8000` in your browser.

API (Quick Reference)
---------------------
- `GET /api/decks` → `{ decks: [{id, name}] }`
- `GET /api/cards?deck=Name` → `{ cards: [...] }`
- `POST /api/decks` body: `{ name }`
- `POST /api/cards`:
  - Flip: `{ type: 'basic', front, back, deck? }`
  - MCQ (single): `{ type: 'mcq', front, choices: string[], multi: false, answer: number /* 0-based */, deck? }`
  - MCQ (multi): `{ type: 'mcq', front, choices: string[], multi: true, answers: number[] /* 0-based */, deck? }`
- `PUT /api/cards/{id}` body: `{ front?, back?, deck?, choices?, answer?, answers?, multi? }` (type is immutable)
- `DELETE /api/cards/{id}`

Notes
-----
- On first run, a `flashcards.db` is created with a `Default` deck and a few sample cards.
- To change port, set `PORT` env var before running (e.g., `PORT=3000`).
- To change DB location, set `DB_PATH` to a writable path. By default the server uses a temp folder in restricted environments.

HTML Rendering (Optional)
------------------------
- Toggle "Allow HTML" in the header to render card text as limited, safe HTML (e.g., Japanese furigana with `<ruby>`/`<rt>`).
- Allowed tags: `b, strong, i, em, u, s, br, p, ul, ol, li, code, pre, ruby, rt, rb, rp, span`.
- All attributes are stripped; scripts, images, links and event handlers are not allowed.

Card Types
----------
- Cards are strictly one type: `basic` (Flip) or `mcq` (Multiple Choice).
- Type is immutable after creation. To switch type, create a new card.
- Basic cards cannot set `choices`/`answer(s)`/`multi`.
- MCQ cards cannot set `back` text.
- MCQ supports single- or multi-answer via `multi` flag. Response includes `multi`, `answer` (for single), and `answers` (array).
