import json
import os
import re
import sqlite3
import tempfile
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from functools import partial

# Prefer an explicit DB_PATH env var; otherwise use a temp dir to
# avoid write restrictions in some sandboxes on the workspace folder.
DB_PATH = os.environ.get('DB_PATH') or os.path.join(tempfile.gettempdir(), 'flashcards.db')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            PRAGMA foreign_keys = ON;
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS decks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deck_id INTEGER,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE SET NULL
            );
            """
        )
        # Schema upgrades: add columns for multiple-choice support if missing
        cur.execute("PRAGMA table_info(cards)")
        cols = {r[1] for r in cur.fetchall()}  # name at index 1
        if 'type' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN type TEXT NOT NULL DEFAULT 'basic'")
        if 'choices' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN choices TEXT")
        if 'answer' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN answer INTEGER")
        if 'multi' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN multi INTEGER NOT NULL DEFAULT 0")
        if 'answers' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN answers TEXT")
        if 'choices_as_cards' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN choices_as_cards INTEGER NOT NULL DEFAULT 0")
        # SRS scheduling columns
        cur.execute("PRAGMA table_info(cards)")
        cols = {r[1] for r in cur.fetchall()}
        if 'srs_due' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_due TEXT")
        if 'srs_ivl' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_ivl INTEGER DEFAULT 0")
        if 'srs_ease' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_ease INTEGER DEFAULT 250")
        if 'srs_lapses' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_lapses INTEGER DEFAULT 0")
        if 'srs_type' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_type TEXT DEFAULT 'new'")
        if 'srs_step' not in cols:
            cur.execute("ALTER TABLE cards ADD COLUMN srs_step INTEGER DEFAULT 0")
        # Reviews table for per-answer statistics
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                ts TEXT DEFAULT (datetime('now')),
                result TEXT NOT NULL, -- 'correct' | 'wrong' | 'timeout' | 'reveal'
                duration_ms INTEGER,
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
            );
            """
        )

        # Seed with a default deck and a few cards if empty
        cur.execute("SELECT COUNT(*) FROM decks;")
        deck_count = cur.fetchone()[0]
        if deck_count == 0:
            cur.execute("INSERT INTO decks (name) VALUES (?)", ("Default",))

        cur.execute("SELECT COUNT(*) FROM cards;")
        card_count = cur.fetchone()[0]
        if card_count == 0:
            cur.execute("SELECT id FROM decks WHERE name = ?", ("Default",))
            default_deck_id = cur.fetchone()[0]
            sample = [
                (default_deck_id, "What is the capital of France?", "Paris"),
                (default_deck_id, "2 + 2 = ?", "4"),
                (default_deck_id, "HTTP status for Not Found?", "404"),
            ]
            cur.executemany(
                "INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)", sample
            )
            # Seed an MCQ example as well
            cur.execute(
                "INSERT INTO cards (deck_id, front, back, type, choices, answer, multi, answers) VALUES (?, ?, '', 'mcq', ?, ?, 0, ?)",
                (
                    default_deck_id,
                    "Which language runs in the browser?",
                    json.dumps(["Python", "Java", "JavaScript", "C++"]),
                    2,  # zero-based index (JavaScript)
                    json.dumps([2]),
                ),
            )

        conn.commit()
    finally:
        conn.close()


def row_to_card(row):
    return {
        "id": row[0],
        "deck_id": row[1],
        "front": row[2],
        "back": row[3],
        "created_at": row[4],
        "updated_at": row[5],
        "type": row[6] if len(row) > 6 else 'basic',
        "choices": (json.loads(row[7]) if len(row) > 7 and row[7] else None),
        "answer": (row[8] if len(row) > 8 else None),
        "multi": (bool(row[9]) if len(row) > 9 else False),
        "answers": (json.loads(row[10]) if len(row) > 10 and row[10] else None),
        "choices_as_cards": (bool(row[11]) if len(row) > 11 else False),
    }


class ApiAndStaticHandler(SimpleHTTPRequestHandler):
    def _set_json_headers(self, status=HTTPStatus.OK):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        # Same-origin by default; CORS header here is harmless if you later split frontend/back
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _read_json(self):
        length = int(self.headers.get('Content-Length', 0) or 0)
        if length == 0:
            return {}
        data = self.rfile.read(length)
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        # Basic CORS preflight support
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/'):
            return self.handle_api_get()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            return self.handle_api_post()
        return self._method_not_allowed()

    def do_PUT(self):
        if self.path.startswith('/api/'):
            return self.handle_api_put()
        return self._method_not_allowed()

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            return self.handle_api_delete()
        return self._method_not_allowed()

    def _method_not_allowed(self):
        self._set_json_headers(HTTPStatus.METHOD_NOT_ALLOWED)
        self.wfile.write(json.dumps({"error": "Method not allowed"}).encode('utf-8'))

    # ---- API handlers ----
    def handle_api_get(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/stats':
            qs = parse_qs(parsed.query or '')
            deck = qs.get('deck', [None])[0]
            conn = get_connection()
            try:
                cur = conn.cursor()
                if deck:
                    cur.execute("SELECT id FROM decks WHERE name = ?", (deck,))
                    row = cur.fetchone()
                    deck_id = row[0] if row else None
                else:
                    deck_id = None
                # totals
                if deck_id is None:
                    cur.execute("SELECT COUNT(*) FROM cards")
                    total_cards = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(DISTINCT card_id) FROM reviews")
                    reviewed_cards = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*), SUM(result='correct'), SUM(result='wrong'), SUM(result='timeout'), AVG(duration_ms), MAX(ts) FROM reviews")
                else:
                    cur.execute("SELECT COUNT(*) FROM cards WHERE deck_id = ?", (deck_id,))
                    total_cards = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(DISTINCT r.card_id) FROM reviews r JOIN cards c ON c.id=r.card_id WHERE c.deck_id = ?", (deck_id,))
                    reviewed_cards = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*), SUM(result='correct'), SUM(result='wrong'), SUM(result='timeout'), AVG(duration_ms), MAX(ts) FROM reviews r JOIN cards c ON c.id=r.card_id WHERE c.deck_id = ?", (deck_id,))
                rev = cur.fetchone() or (0,0,0,0,None,None)
                total_reviews = int(rev[0] or 0)
                correct = int(rev[1] or 0)
                wrong = int(rev[2] or 0)
                timeout = int(rev[3] or 0)
                avg_ms = int(rev[4]) if rev[4] is not None else None
                last = rev[5]
                # per-card top list
                if deck_id is None:
                    cur.execute("SELECT r.card_id, c.front, COUNT(*) as cnt, SUM(result='correct'), SUM(result='wrong'), SUM(result='timeout'), MAX(ts) FROM reviews r JOIN cards c ON c.id=r.card_id GROUP BY 1 ORDER BY cnt DESC LIMIT 100")
                else:
                    cur.execute("SELECT r.card_id, c.front, COUNT(*) as cnt, SUM(result='correct'), SUM(result='wrong'), SUM(result='timeout'), MAX(ts) FROM reviews r JOIN cards c ON c.id=r.card_id WHERE c.deck_id = ? GROUP BY 1 ORDER BY cnt DESC LIMIT 100", (deck_id,))
                rows = cur.fetchall() or []
                per = []
                for r in rows:
                    per.append({
                        "card_id": r[0],
                        "front": r[1],
                        "total": int(r[2] or 0),
                        "correct": int(r[3] or 0),
                        "wrong": int(r[4] or 0),
                        "timeout": int(r[5] or 0),
                        "last_ts": r[6],
                    })
                self._set_json_headers()
                self.wfile.write(json.dumps({
                    "deck": deck,
                    "total_cards": total_cards,
                    "reviewed_cards": reviewed_cards,
                    "total_reviews": total_reviews,
                    "correct": correct,
                    "wrong": wrong,
                    "timeout": timeout,
                    "avg_duration_ms": avg_ms,
                    "last_ts": last,
                    "per_card": per,
                }).encode('utf-8'))
            finally:
                conn.close()
            return
        # Per-card aggregated stats
        mstats = re.match(r"^/api/cards/(\d+)/stats$", parsed.path or "")
        if mstats:
            card_id = int(mstats.group(1))
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*), SUM(result='correct'), SUM(result='wrong'), SUM(result='timeout'), AVG(duration_ms), MAX(ts) FROM reviews WHERE card_id = ?", (card_id,))
                row = cur.fetchone() or (0,0,0,0,None,None)
                total = int(row[0] or 0)
                correct = int(row[1] or 0)
                wrong = int(row[2] or 0)
                timeout = int(row[3] or 0)
                avg_ms = int(row[4]) if row[4] is not None else None
                last = row[5]
                self._set_json_headers()
                self.wfile.write(json.dumps({
                    "card_id": card_id,
                    "total": total,
                    "correct": correct,
                    "wrong": wrong,
                    "timeout": timeout,
                    "avg_duration_ms": avg_ms,
                    "last_ts": last,
                }).encode('utf-8'))
            finally:
                conn.close()
            return
        if parsed.path == '/api/cards':
            qs = parse_qs(parsed.query or '')
            deck = qs.get('deck', [None])[0]
            conn = get_connection()
            try:
                cur = conn.cursor()
                base_select = (
                    "SELECT id, deck_id, front, back, created_at, updated_at, type, choices, answer, multi, answers, choices_as_cards FROM cards"
                )
                if deck:
                    cur.execute(
                        base_select + " WHERE deck_id IN (SELECT id FROM decks WHERE name = ?) ORDER BY id",
                        (deck,),
                    )
                else:
                    cur.execute(base_select + " ORDER BY id")
                cards = [row_to_card(r) for r in cur.fetchall()]
                self._set_json_headers()
                self.wfile.write(json.dumps({"cards": cards}).encode('utf-8'))
            finally:
                conn.close()
            return

        if parsed.path == '/api/decks':
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT id, name FROM decks ORDER BY name")
                decks = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
                self._set_json_headers()
                self.wfile.write(json.dumps({"decks": decks}).encode('utf-8'))
            finally:
                conn.close()
            return

        self._set_json_headers(HTTPStatus.NOT_FOUND)
        self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))

    def handle_api_post(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/srs/review':
            payload = self._read_json()
            try:
                card_id = int(payload.get('card_id'))
            except Exception:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'card_id' is required and must be an integer"}).encode('utf-8'))
                return
            grade = str(payload.get('grade') or '').lower()  # again|hard|good|easy
            if grade not in ('again','hard','good','easy'):
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'grade' must be one of again, hard, good, easy"}).encode('utf-8'))
                return
            now = sqlite3.connect(':memory:').execute("select datetime('now')").fetchone()[0]
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT srs_type, srs_step, srs_ivl, srs_ease, srs_lapses FROM cards WHERE id=?", (card_id,))
                row = cur.fetchone()
                if row is None:
                    self._set_json_headers(HTTPStatus.NOT_FOUND)
                    self.wfile.write(json.dumps({"error": "Card not found"}).encode('utf-8'))
                    return
                srs_type = row[0] or 'new'
                srs_step = int(row[1] or 0)
                srs_ivl = int(row[2] or 0)
                srs_ease = int(row[3] or 250)
                srs_lapses = int(row[4] or 0)

                # Learning steps (minutes)
                steps = [1, 10]

                def minutes_from_now(mins):
                    return sqlite3.connect(':memory:').execute("select datetime('now', ?)", (f"+{int(mins)} minutes",)).fetchone()[0]

                def days_from_now(days):
                    return sqlite3.connect(':memory:').execute("select date('now', ?) || ' 00:00:00'", (f"+{int(days)} days",)).fetchone()[0]

                new_type = srs_type
                new_step = srs_step
                new_ivl = srs_ivl
                new_ease = srs_ease
                new_due = now
                new_lapses = srs_lapses

                if srs_type in ('new','learn'):
                    new_type = 'learn'
                    if grade == 'again':
                        new_step = 0
                        new_due = minutes_from_now(steps[0])
                    elif grade == 'hard':
                        new_due = minutes_from_now(steps[max(0, min(new_step, len(steps)-1))])
                    elif grade == 'good':
                        new_step += 1
                        if new_step >= len(steps):
                            # graduate
                            new_type = 'review'
                            new_ivl = 1
                            new_due = days_from_now(new_ivl)
                        else:
                            new_due = minutes_from_now(steps[new_step])
                    elif grade == 'easy':
                        new_type = 'review'
                        new_ivl = 3
                        new_due = days_from_now(new_ivl)
                else:  # review
                    if grade == 'again':
                        new_lapses += 1
                        new_ease = max(130, new_ease - 200)
                        new_ivl = 1
                        new_due = days_from_now(new_ivl)
                    elif grade == 'hard':
                        new_ease = max(130, new_ease - 150)
                        new_ivl = max(1, int(round(new_ivl * 1.2)))
                        new_due = days_from_now(new_ivl)
                    elif grade == 'good':
                        new_ivl = max(1, int(round(new_ivl * (new_ease/100))))
                        new_due = days_from_now(new_ivl)
                    elif grade == 'easy':
                        new_ease = min(350, new_ease + 150)
                        new_ivl = max(1, int(round(new_ivl * (new_ease/100) * 1.3)))
                        new_due = days_from_now(new_ivl)

                cur.execute(
                    "UPDATE cards SET srs_type=?, srs_step=?, srs_ivl=?, srs_ease=?, srs_lapses=?, srs_due=? , updated_at = datetime('now') WHERE id=?",
                    (new_type, new_step, new_ivl, new_ease, new_lapses, new_due, card_id)
                )
                conn.commit()
                self._set_json_headers(HTTPStatus.OK)
                self.wfile.write(json.dumps({
                    "ok": True,
                    "card_id": card_id,
                    "srs_type": new_type,
                    "srs_step": new_step,
                    "srs_ivl": new_ivl,
                    "srs_ease": new_ease,
                    "srs_lapses": new_lapses,
                    "srs_due": new_due,
                }).encode('utf-8'))
            finally:
                conn.close()
            return
        if parsed.path == '/api/reviews':
            payload = self._read_json()
            try:
                card_id = int(payload.get('card_id'))
            except Exception:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'card_id' is required and must be an integer"}).encode('utf-8'))
                return
            result = str(payload.get('result') or '').strip().lower()
            if result not in ('correct','wrong','timeout','reveal'):
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'result' must be one of: correct, wrong, timeout, reveal"}).encode('utf-8'))
                return
            dur = payload.get('duration_ms')
            if dur is not None:
                try:
                    dur = int(dur)
                except Exception:
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "'duration_ms' must be an integer"}).encode('utf-8'))
                    return
            conn = get_connection()
            try:
                cur = conn.cursor()
                # Ensure card exists
                cur.execute("SELECT 1 FROM cards WHERE id = ?", (card_id,))
                if cur.fetchone() is None:
                    self._set_json_headers(HTTPStatus.NOT_FOUND)
                    self.wfile.write(json.dumps({"error": "Card not found"}).encode('utf-8'))
                    return
                cur.execute("INSERT INTO reviews (card_id, result, duration_ms) VALUES (?, ?, ?)", (card_id, result, dur))
                conn.commit()
                self._set_json_headers(HTTPStatus.CREATED)
                self.wfile.write(json.dumps({"ok": True, "id": cur.lastrowid}).encode('utf-8'))
            finally:
                conn.close()
            return
        if parsed.path == '/api/cards':
            payload = self._read_json()
            front = (payload.get('front') or '').strip()
            back = (payload.get('back') or '').strip()
            card_type = (payload.get('type') or 'basic').strip().lower()
            deck_name = (payload.get('deck') or '').strip() or 'Default'
            choices_json = None
            answer_idx = None
            answers_json = None
            multi_flag = 0
            choices_as_cards = 1 if bool(payload.get('choices_as_cards')) else 0
            if card_type == 'mcq':
                choices = payload.get('choices')
                if not isinstance(choices, list) or len(choices) < 2 or not all(isinstance(c, str) and c.strip() for c in choices):
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "For type 'mcq', 'choices' must be a list of 2+ non-empty strings"}).encode('utf-8'))
                    return
                choices_json = json.dumps([c.strip() for c in choices])
                # multi or single
                multi_flag = 1 if bool(payload.get('multi')) else 0
                if multi_flag:
                    answers = payload.get('answers')
                    if not isinstance(answers, list) or not all(isinstance(a, int) for a in answers):
                        self._set_json_headers(HTTPStatus.BAD_REQUEST)
                        self.wfile.write(json.dumps({"error": "For MCQ multi, 'answers' must be an array of indexes"}).encode('utf-8'))
                        return
                    answers = sorted({a for a in answers if 0 <= a < len(choices)})
                    if len(answers) == 0:
                        self._set_json_headers(HTTPStatus.BAD_REQUEST)
                        self.wfile.write(json.dumps({"error": "Provide at least one valid answer index"}).encode('utf-8'))
                        return
                    answers_json = json.dumps(answers)
                else:
                    answer = payload.get('answer')
                    if not isinstance(answer, int) or answer < 0 or answer >= len(choices):
                        self._set_json_headers(HTTPStatus.BAD_REQUEST)
                        self.wfile.write(json.dumps({"error": "For MCQ single, 'answer' must be a valid choice index"}).encode('utf-8'))
                        return
                    answer_idx = answer
                    answers_json = json.dumps([answer])
                if not front:
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "'front' (question) is required"}).encode('utf-8'))
                    return
            else:
                # basic
                if not front or not back:
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "'front' and 'back' are required for basic cards"}).encode('utf-8'))
                    return
            conn = get_connection()
            try:
                cur = conn.cursor()
                # Ensure deck exists
                cur.execute("SELECT id FROM decks WHERE name = ?", (deck_name,))
                row = cur.fetchone()
                if row is None:
                    cur.execute("INSERT INTO decks (name) VALUES (?)", (deck_name,))
                    deck_id = cur.lastrowid
                else:
                    deck_id = row[0]
                if card_type == 'mcq':
                    cur.execute(
                        "INSERT INTO cards (deck_id, front, back, type, choices, answer, multi, answers, choices_as_cards) VALUES (?, ?, '', 'mcq', ?, ?, ?, ?, ?)",
                        (deck_id, front, choices_json, answer_idx, multi_flag, answers_json, choices_as_cards),
                    )
                else:
                    cur.execute(
                        "INSERT INTO cards (deck_id, front, back, type) VALUES (?, ?, ?, 'basic')",
                        (deck_id, front, back),
                    )
                card_id = cur.lastrowid
                conn.commit()
                cur.execute(
                    "SELECT id, deck_id, front, back, created_at, updated_at, type, choices, answer, multi, answers, choices_as_cards FROM cards WHERE id = ?",
                    (card_id,),
                )
                card = row_to_card(cur.fetchone())
                self._set_json_headers(HTTPStatus.CREATED)
                self.wfile.write(json.dumps(card).encode('utf-8'))
            finally:
                conn.close()
            return

        if parsed.path == '/api/decks':
            payload = self._read_json()
            name = (payload.get('name') or '').strip()
            if not name:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'name' is required"}).encode('utf-8'))
                return
            conn = get_connection()
            try:
                cur = conn.cursor()
                try:
                    cur.execute("INSERT INTO decks (name) VALUES (?)", (name,))
                    conn.commit()
                except sqlite3.IntegrityError:
                    self._set_json_headers(HTTPStatus.CONFLICT)
                    self.wfile.write(json.dumps({"error": "Deck already exists"}).encode('utf-8'))
                    return
                self._set_json_headers(HTTPStatus.CREATED)
                self.wfile.write(json.dumps({"id": cur.lastrowid, "name": name}).encode('utf-8'))
            finally:
                conn.close()
            return

        self._set_json_headers(HTTPStatus.NOT_FOUND)
        self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))

    def handle_api_put(self):
        m = re.match(r"^/api/cards/(\d+)$", self.path)
        if not m:
            # Deck rename
            md = re.match(r"^/api/decks/(\d+)$", self.path)
            if md:
                deck_id = int(md.group(1))
                payload = self._read_json()
                name = (payload.get('name') or '').strip()
                if not name:
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "'name' is required"}).encode('utf-8'))
                    return
                conn = get_connection()
                try:
                    cur = conn.cursor()
                    try:
                        cur.execute("UPDATE decks SET name = ? WHERE id = ?", (name, deck_id))
                    except sqlite3.IntegrityError:
                        self._set_json_headers(HTTPStatus.CONFLICT)
                        self.wfile.write(json.dumps({"error": "Deck already exists"}).encode('utf-8'))
                        return
                    if cur.rowcount == 0:
                        self._set_json_headers(HTTPStatus.NOT_FOUND)
                        self.wfile.write(json.dumps({"error": "Deck not found"}).encode('utf-8'))
                        return
                    conn.commit()
                    self._set_json_headers(HTTPStatus.OK)
                    self.wfile.write(json.dumps({"id": deck_id, "name": name}).encode('utf-8'))
                finally:
                    conn.close()
                return
            self._set_json_headers(HTTPStatus.NOT_FOUND)
            self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))
            return
        card_id = int(m.group(1))
        payload = self._read_json()
        # Enforce immutable type and exclusive fields by existing type
        conn_check = get_connection()
        try:
            cur = conn_check.cursor()
            cur.execute("SELECT type, choices, multi FROM cards WHERE id = ?", (card_id,))
            row = cur.fetchone()
            if row is None:
                self._set_json_headers(HTTPStatus.NOT_FOUND)
                self.wfile.write(json.dumps({"error": "Card not found"}).encode('utf-8'))
                return
            existing_type = (row[0] or 'basic')
            current_choices = json.loads(row[1]) if row[1] else []
            current_multi = bool(row[2]) if len(row) > 2 else False
        finally:
            conn_check.close()

        # Disallow changing the type
        if 'type' in payload and isinstance(payload['type'], str):
            self._set_json_headers(HTTPStatus.BAD_REQUEST)
            self.wfile.write(json.dumps({"error": "'type' is immutable; create a new card to change type"}).encode('utf-8'))
            return

        # Validate exclusive fields by type
        if existing_type == 'basic':
            if (
                ('choices' in payload and payload['choices'] is not None)
                or ('answer' in payload and payload['answer'] is not None)
                or ('answers' in payload and payload['answers'] is not None)
                or ('multi' in payload)
            ):
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "Basic cards cannot have 'choices', 'answer(s)', or 'multi'"}).encode('utf-8'))
                return
        elif existing_type == 'mcq':
            if 'back' in payload and isinstance(payload['back'], str) and payload['back'].strip():
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "MCQ cards do not support 'back' text"}).encode('utf-8'))
                return

        fields = []
        values = []
        if 'front' in payload and isinstance(payload['front'], str):
            fields.append('front = ?')
            values.append(payload['front'].strip())
        if 'back' in payload and isinstance(payload['back'], str):
            fields.append('back = ?')
            values.append(payload['back'].strip())
        # For mcq we may allow clearing back to empty string if client sends it, handled above.
        if 'choices' in payload:
            ch = payload['choices']
            if ch is None:
                fields.append('choices = NULL')
            elif isinstance(ch, list) and all(isinstance(x, str) and x.strip() for x in ch) and len(ch) >= 2:
                fields.append('choices = ?')
                values.append(json.dumps([x.strip() for x in ch]))
                current_choices = [x.strip() for x in ch]
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'choices' must be null or a list of 2+ non-empty strings"}).encode('utf-8'))
                return
        if 'answer' in payload:
            ans = payload['answer']
            if ans is None or isinstance(ans, int):
                fields.append('answer = ?')
                values.append(ans)
                if isinstance(ans, int):
                    fields.append('answers = ?')
                    values.append(json.dumps([ans]))
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'answer' must be an integer index or null"}).encode('utf-8'))
                return
        if 'answers' in payload and 'answer' in payload:
            self._set_json_headers(HTTPStatus.BAD_REQUEST)
            self.wfile.write(json.dumps({"error": "Provide either 'answer' or 'answers', not both"}).encode('utf-8'))
            return
        if 'answers' in payload:
            ans_list = payload['answers']
            if ans_list is None:
                fields.append('answers = NULL')
            elif isinstance(ans_list, list) and all(isinstance(a, int) for a in ans_list):
                norm = sorted({a for a in ans_list if 0 <= a < len(current_choices)})
                if len(norm) == 0:
                    self._set_json_headers(HTTPStatus.BAD_REQUEST)
                    self.wfile.write(json.dumps({"error": "'answers' must contain at least one valid index"}).encode('utf-8'))
                    return
                fields.append('answers = ?')
                values.append(json.dumps(norm))
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'answers' must be null or an array of integers"}).encode('utf-8'))
                return
        if 'multi' in payload:
            mval = payload['multi']
            if isinstance(mval, bool):
                fields.append('multi = ?')
                values.append(1 if mval else 0)
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'multi' must be a boolean"}).encode('utf-8'))
                return
        # toggle choices_as_cards (boolean)
        if 'choices_as_cards' in payload:
            cav = payload['choices_as_cards']
            if isinstance(cav, bool):
                fields.append('choices_as_cards = ?')
                values.append(1 if cav else 0)
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'choices_as_cards' must be a boolean"}).encode('utf-8'))
                return
        if 'deck' in payload and isinstance(payload['deck'], str):
            deck_name = payload['deck'].strip()
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT id FROM decks WHERE name = ?", (deck_name,))
                row = cur.fetchone()
                if row is None:
                    cur.execute("INSERT INTO decks (name) VALUES (?)", (deck_name,))
                    deck_id = cur.lastrowid
                else:
                    deck_id = row[0]
            finally:
                conn.close()
            fields.append('deck_id = ?')
            values.append(deck_id)
        if not fields:
            self._set_json_headers(HTTPStatus.BAD_REQUEST)
            self.wfile.write(json.dumps({"error": "No valid fields to update"}).encode('utf-8'))
            return
        values.append(card_id)
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE cards SET {', '.join(fields)}, updated_at = datetime('now') WHERE id = ?",
                tuple(values),
            )
            if cur.rowcount == 0:
                self._set_json_headers(HTTPStatus.NOT_FOUND)
                self.wfile.write(json.dumps({"error": "Card not found"}).encode('utf-8'))
                return
            conn.commit()
            cur.execute(
                "SELECT id, deck_id, front, back, created_at, updated_at, type, choices, answer, multi, answers, choices_as_cards FROM cards WHERE id = ?",
                (card_id,),
            )
            card = row_to_card(cur.fetchone())
            self._set_json_headers(HTTPStatus.OK)
            self.wfile.write(json.dumps(card).encode('utf-8'))
        finally:
            conn.close()

    def handle_api_delete(self):
        m = re.match(r"^/api/cards/(\d+)$", self.path)
        if m:
            card_id = int(m.group(1))
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("DELETE FROM cards WHERE id = ?", (card_id,))
                if cur.rowcount == 0:
                    self._set_json_headers(HTTPStatus.NOT_FOUND)
                    self.wfile.write(json.dumps({"error": "Card not found"}).encode('utf-8'))
                    return
                conn.commit()
                self._set_json_headers(HTTPStatus.NO_CONTENT)
            finally:
                conn.close()
            return
        md = re.match(r"^/api/decks/(\d+)$", self.path)
        if md:
            deck_id = int(md.group(1))
            conn = get_connection()
            try:
                cur = conn.cursor()
                cur.execute("DELETE FROM decks WHERE id = ?", (deck_id,))
                if cur.rowcount == 0:
                    self._set_json_headers(HTTPStatus.NOT_FOUND)
                    self.wfile.write(json.dumps({"error": "Deck not found"}).encode('utf-8'))
                    return
                conn.commit()
                self._set_json_headers(HTTPStatus.NO_CONTENT)
            finally:
                conn.close()
            return
        self._set_json_headers(HTTPStatus.NOT_FOUND)
        self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))


def run():
    init_db()
    port = int(os.environ.get('PORT', '8000'))
    handler_cls = partial(ApiAndStaticHandler, directory=PUBLIC_DIR)
    server = ThreadingHTTPServer(('127.0.0.1', port), handler_cls)
    print(f"Flashcards server running at http://127.0.0.1:{port}")
    print(f"DB path: {DB_PATH}")
    print("API: GET/POST /api/cards, GET/POST /api/decks, PUT/DELETE /api/cards/{id}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == '__main__':
    run()
