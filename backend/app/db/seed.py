"""
Run once to seed the database with categories, investments, and goals from Notion.
Usage: python -m app.db.seed
"""
from app.core.database import SessionLocal
from app.models.category import Category
from app.models.investment import Investment
from app.models.goal import SavingsGoal
from datetime import date


CATEGORIES = [
    # Fixed
    {"name": "Rent",         "type": "fixed",    "planned_amount": 750,  "icon": "home",          "color": "#6366f1"},
    {"name": "Transport",    "type": "fixed",    "planned_amount": 90,   "icon": "bus",           "color": "#6366f1"},
    {"name": "Internet",     "type": "fixed",    "planned_amount": 30,   "icon": "wifi",          "color": "#6366f1"},
    {"name": "Electricity",  "type": "fixed",    "planned_amount": 50,   "icon": "zap",           "color": "#6366f1"},
    {"name": "Sport",        "type": "fixed",    "planned_amount": 30,   "icon": "activity",      "color": "#6366f1"},
    {"name": "Phone",        "type": "fixed",    "planned_amount": 10,   "icon": "phone",         "color": "#6366f1"},
    # Variable
    {"name": "Groceries",        "type": "variable", "planned_amount": 200, "icon": "shopping-cart", "color": "#f59e0b"},
    {"name": "Personal Care",    "type": "variable", "planned_amount": 100, "icon": "user",          "color": "#f59e0b"},
    {"name": "Gifts / Misc",     "type": "variable", "planned_amount": 100, "icon": "gift",          "color": "#f59e0b"},
    {"name": "Eating Out",       "type": "variable", "planned_amount": 50,  "icon": "utensils",      "color": "#f59e0b"},
    # Learning
    {"name": "Claude Code",      "type": "learning", "planned_amount": 20,  "icon": "code",          "color": "#10b981"},
    {"name": "DEV / PLM Books",  "type": "learning", "planned_amount": 50,  "icon": "book",          "color": "#10b981"},
    {"name": "Networking",       "type": "learning", "planned_amount": 30,  "icon": "users",         "color": "#10b981"},
    # Family
    {"name": "Family Abroad",    "type": "family",   "planned_amount": 150, "icon": "heart",         "color": "#ec4899"},
]

INVESTMENTS = [
    {"name": "Stocks / ETFs",  "type": "stocks", "value": 15000.0},
    {"name": "Emergency Cash", "type": "cash",   "value": 3000.0},
    {"name": "Crypto",         "type": "crypto", "value": 390.0},
]

GOALS = [
    {
        "name": "€100k Portfolio by 35",
        "description": "Reach €100k total portfolio value by age 35 via monthly €600 ETF contributions.",
        "target_amount": 100000.0,
        "current_amount": 18390.0,
        "target_date": date(2031, 1, 1),
    }
]


def seed():
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            db.add_all([Category(**c) for c in CATEGORIES])
            print(f"Seeded {len(CATEGORIES)} categories.")

        if db.query(Investment).count() == 0:
            db.add_all([Investment(**i) for i in INVESTMENTS])
            print(f"Seeded {len(INVESTMENTS)} investments.")

        if db.query(SavingsGoal).count() == 0:
            db.add_all([SavingsGoal(**g) for g in GOALS])
            print(f"Seeded {len(GOALS)} goals.")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
