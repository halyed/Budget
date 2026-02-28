"""
Inject a monthly expenses template into the Budget API.

Usage:
    python inject_month.py                              # uses templates/monthly_expenses.json
    python inject_month.py templates/monthly_expenses.json
    python inject_month.py templates/monthly_expenses.json http://localhost:8000
"""
import sys
import json
import urllib.request
import urllib.error

# Windows console UTF-8 fix
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

TEMPLATE_FILE = sys.argv[1] if len(sys.argv) > 1 else "templates/monthly_expenses.json"
API_BASE = (sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000").rstrip("/")
URL = f"{API_BASE}/api/v1/transactions/bulk"

with open(TEMPLATE_FILE, encoding="utf-8") as f:
    template = json.load(f)

# Remove _comment key if present
template.pop("_comment", None)

payload = json.dumps(template).encode("utf-8")
req = urllib.request.Request(URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"✓ Created : {result['created']} transactions")
        print(f"  Skipped : {result['skipped']} (duplicates or errors)")
        if result["errors"]:
            print("  Errors:")
            for e in result["errors"]:
                print(f"    - {e}")
        print(f"\nMonth injected: {template['month']}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()}")
