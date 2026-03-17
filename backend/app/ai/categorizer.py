import json
from pathlib import Path

_rules: dict[str, list[str]] | None = None


def _load_rules() -> dict[str, list[str]]:
    global _rules
    if _rules is None:
        path = Path(__file__).parent / "rules.json"
        with open(path, encoding="utf-8") as f:
            _rules = json.load(f)
    return _rules


def suggest_category(description: str, user_categories: list[str]) -> str | None:
    """
    Match description against rules.json keywords.
    Returns the best matching category name from the user's own category list,
    or None if no match found.
    """
    if not description:
        return None

    desc_lower = description.lower()
    rules = _load_rules()

    # Normalize user categories for case-insensitive comparison
    user_cats_lower = {c.lower(): c for c in user_categories}

    for rule_category, keywords in rules.items():
        for keyword in keywords:
            if keyword in desc_lower:
                # Try to find the matching category in the user's list
                # First: exact match on the rule category name
                if rule_category in user_cats_lower:
                    return user_cats_lower[rule_category]
                # Second: user category that contains the rule category name
                for cat_lower, cat_original in user_cats_lower.items():
                    if rule_category in cat_lower or cat_lower in rule_category:
                        return cat_original
    return None
