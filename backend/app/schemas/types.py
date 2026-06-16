from decimal import Decimal
from typing import Annotated
from pydantic import PlainSerializer

# Validates/holds values as Decimal (exact arithmetic), but serializes to a
# JSON number instead of Pydantic v2's default string-for-Decimal behavior —
# which silently turned every amount into a string (e.g. "19.99"), breaking
# frontend arithmetic like array.reduce((s, x) => s + x.value, 0).
DecimalAsFloat = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
