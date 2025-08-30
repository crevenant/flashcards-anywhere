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
            cav = payload['choices_as_cards']
            if isinstance(cav, bool):
                fields.append('choices_as_cards = ?')
                values.append(1 if cav else 0)
            else:
                self._set_json_headers(HTTPStatus.BAD_REQUEST)
                self.wfile.write(json.dumps({"error": "'choices_as_cards' must be a boolean"}).encode('utf-8'))
                return
