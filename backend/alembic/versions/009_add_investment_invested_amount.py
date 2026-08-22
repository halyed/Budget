"""add invested_amount to investments

Revision ID: 009
Revises: 008
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("investments") as batch_op:
        batch_op.add_column(sa.Column("invested_amount", sa.Numeric(12, 2), nullable=False, server_default="0"))

    # Existing rows have no recorded cost basis — backfill to the current value
    # so growth starts at 0 instead of showing a fabricated gain, until the
    # user edits each investment with its real invested amount.
    op.execute("UPDATE investments SET invested_amount = value")


def downgrade():
    with op.batch_alter_table("investments") as batch_op:
        batch_op.drop_column("invested_amount")
