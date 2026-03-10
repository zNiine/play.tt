"""Inspect data.db schema (batters table etc.). Run: python inspect_data_db.py"""
import sqlite3
import os

path = os.path.join(os.path.dirname(__file__), "data.db")
if not os.path.exists(path):
    print("data.db not found at", path)
    print("Dir listing:", os.listdir(os.path.dirname(path)))
    exit(1)

c = sqlite3.connect(path)
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
print("Tables:", tables)

for t in tables:
    info = c.execute(f"PRAGMA table_info({t})").fetchall()
    print(f"\n--- {t} ({len(info)} cols) ---")
    for col in info:
        print(f"  {col[1]} {col[2]}")
    # Sample row count and one row
    n = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  (rows: {n})")
    if n > 0:
        sample = c.execute(f"SELECT * FROM {t} LIMIT 1").fetchone()
        cols = [d[1] for d in c.execute(f"PRAGMA table_info({t})").fetchall()]
        print("  sample:", dict(zip(cols, sample)))
c.close()
