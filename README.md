# Flashcards Anywhere

Flashcards Anywhere is a lightweight, self-hosted flashcard app for efficient study and spaced repetition. Featuring a Node.js backend, Electron desktop app, and a fast, modern frontend, it lets you create, review, and organize decks of flashcards from any device. All data is stored locally, giving you full control and privacy. Ideal for language learners, students, and anyone who wants a distraction-free study tool.

Features:

- Create, edit, and delete flashcards and decks
- Spaced repetition scheduling (SRS) for effective memorization
- Clean, responsive web interface
- No sign-up or cloud required—your data stays on your machine

## Prerequisites

- Node.js 18+ and npm installed

## Run (Web/Server)

- From the project root:
    - `npm install` (first time only)
    - `npm run start:server`
- Open `http://127.0.0.1:8000` in your browser.

## Run (Electron Desktop)

- From the project root:
    - `npm install` (first time only)
    - `npm start`

## API (Quick Reference)

- `GET /api/decks` → `{ decks: [{id, name}] }`
- `GET /api/cards?deck=Name` → `{ cards: [...] }`
- `POST /api/decks` body: `{ name }`
- `POST /api/cards`:
    - Flip: `{ type: 'basic', front, back, deck? }`
    - MCQ (single): `{ type: 'mcq', front, choices: string[], multi: false, answer: number /* 0-based */, deck? }`
    - MCQ (multi): `{ type: 'mcq', front, choices: string[], multi: true, answers: number[] /* 0-based */, deck? }`
- `PUT /api/cards/{id}` body: `{ front?, back?, deck?, choices?, answer?, answers?, multi? }` (type is immutable)
- `DELETE /api/cards/{id}`

## Notes

- On first run, a project‑local database is created at `data/flashcards.db` with a `Default` deck and a few sample cards.
- To change port, set `PORT` env var before running (e.g., `PORT=3000`).
- To change DB location, set `DB_PATH` to a writable path; it overrides the default `data/flashcards.db`.

## HTML Rendering

- Card text renders as limited, safe HTML (e.g., Japanese furigana with `<ruby>`/`<rt>`).
- Allowed tags: `b, strong, i, em, u, s, br, p, ul, ol, li, code, pre, ruby, rt, rb, rp, span, h1, h2, h3, h4, h5, h6, font`.
- Allowed attributes:
    - `<font>`: `color` (named color or hex), `size` (1–7), `face` (simple font list).
- Other attributes are stripped; scripts, images, links and event handlers are not allowed.

## Card Types

- Cards are strictly one type: `basic` (Flip) or `mcq` (Multiple Choice).
- Type is immutable after creation. To switch type, create a new card.
- Basic cards cannot set `choices`/`answer(s)`/`multi`.
- MCQ cards cannot set `back` text.
- MCQ supports single- or multi-answer via `multi` flag. Response includes `multi`, `answer` (for single), and `answers` (array).
