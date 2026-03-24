"""fix categories unique constraint

Revision ID: 003
Revises: 002
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    # Force a full table rebuild to drop the old inline UNIQUE(name) constraint
    # and ensure only the composite UNIQUE(name, user_id) exists.
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        batch_op.create_unique_constraint("uq_category_name_user", ["name", "user_id"])


def downgrade():
    with op.batch_alter_table("categories", recreate="always") as batch_op:
        batch_op.drop_constraint("uq_category_name_user", type_="unique")
        batch_op.create_unique_constraint("uq_categories_name", ["name"])
