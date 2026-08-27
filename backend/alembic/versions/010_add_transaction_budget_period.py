"""add budget_year/budget_month to transactions

Revision ID: 010
Revises: 009
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("budget_year", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("budget_month", sa.Integer(), nullable=True))

    # Existing transactions had no separate budget month — backfill it from
    # the calendar month of their actual date (the only info we used to have).
    op.execute(
        "UPDATE transactions SET "
        "budget_year = CAST(strftime('%Y', date) AS INTEGER), "
        "budget_month = CAST(strftime('%m', date) AS INTEGER)"
    )

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("budget_year", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("budget_month", existing_type=sa.Integer(), nullable=False)


def downgrade():
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("budget_month")
        batch_op.drop_column("budget_year")
