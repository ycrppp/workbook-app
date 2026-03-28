import psycopg2
import json
import os
import sys
from datetime import datetime, date

def serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Cannot serialize {type(obj)}")

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    print("ERROR: DATABASE_URL not set", file=sys.stderr)
    sys.exit(1)

conn = psycopg2.connect(database_url, sslmode='require')
cur = conn.cursor()
cur.execute('SELECT telegram_id, first_name, last_name, username, projects, created_at, updated_at FROM users')
cols = [d[0] for d in cur.description]
rows = [dict(zip(cols, r)) for r in cur.fetchall()]
conn.close()

print(json.dumps(rows, default=serialize, ensure_ascii=False, indent=2))
print(f"Backed up {len(rows)} users", file=sys.stderr)
