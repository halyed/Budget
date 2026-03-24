"""
Seed the database with default categories for a given user.
Only seeds if the user has no existing data (safe to call on every startup).
Usage: python -m app.db.seed  (seeds the admin user)
"""
from app.core.database import SessionLocal
from app.models.category import Category
from app.models.user import User


CATEGORIES = [
    # Fixed
    {"name": "Rent",           "type": "fixed",    "planned_amount": 0, "icon": "home",          "color": "#6366f1"},
    {"name": "Transport",      "type": "fixed",    "planned_amount": 0, "icon": "bus",           "color": "#6366f1"},
    {"name": "Internet",       "type": "fixed",    "planned_amount": 0, "icon": "wifi",          "color": "#6366f1"},
    {"name": "Electricity",    "type": "fixed",    "planned_amount": 0, "icon": "zap",           "color": "#6366f1"},
    {"name": "Sport",          "type": "fixed",    "planned_amount": 0, "icon": "activity",      "color": "#6366f1"},
    {"name": "Phone",          "type": "fixed",    "planned_amount": 0, "icon": "phone",         "color": "#6366f1"},
    # Variable
    {"name": "Groceries",      "type": "variable", "planned_amount": 0, "icon": "shopping-cart", "color": "#f59e0b"},
    {"name": "Personal Care",  "type": "variable", "planned_amount": 0, "icon": "user",          "color": "#f59e0b"},
    {"name": "Gifts / Misc",   "type": "variable", "planned_amount": 0, "icon": "gift",          "color": "#f59e0b"},
    {"name": "Eating Out",     "type": "variable", "planned_amount": 0, "icon": "utensils",      "color": "#f59e0b"},
    # Learning
    {"name": "Online Tools",   "type": "learning", "planned_amount": 0, "icon": "code",          "color": "#10b981"},
    {"name": "Books & Courses","type": "learning", "planned_amount": 0, "icon": "book",          "color": "#10b981"},
    {"name": "Networking",     "type": "learning", "planned_amount": 0, "icon": "users",         "color": "#10b981"},
    # Family
    {"name": "Family",         "type": "family",   "planned_amount": 0, "icon": "heart",         "color": "#ec4899"},
]


def seed(user_id: int | None = None):
    db = SessionLocal()
    try:
        # Resolve user: use provided id or fall back to first user (admin)
        if user_id is None:
            user = db.query(User).first()
            if not user:
                print("No users found — skipping seed.")
                return
            user_id = user.id

        # Only seed if this user has no categories yet
        if db.query(Category).filter(Category.user_id == user_id).count() == 0:
            db.add_all([Category(**c, user_id=user_id) for c in CATEGORIES])
            db.commit()
            print(f"Seeded {len(CATEGORIES)} categories for user {user_id}.")
        else:
            print(f"User {user_id} already has data — skipping seed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
