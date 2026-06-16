"""convert amount columns from float to numeric(12,2)

Revision ID: 006
Revises: 005
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None

NUMERIC = sa.Numeric(12, 2)
FLOAT = sa.Float()


def upgrade():
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("amount", type_=NUMERIC, existing_nullable=False)

    with op.batch_alter_table("categories") as batch_op:
        batch_op.alter_column("planned_amount", type_=NUMERIC, existing_nullable=False)

    with op.batch_alter_table("savings_goals") as batch_op:
        batch_op.alter_column("target_amount", type_=NUMERIC, existing_nullable=False)
        batch_op.alter_column("current_amount", type_=NUMERIC, existing_nullable=False)

    with op.batch_alter_table("investments") as batch_op:
        batch_op.alter_column("value", type_=NUMERIC, existing_nullable=False)


def downgrade():
    with op.batch_alter_table("investments") as batch_op:
        batch_op.alter_column("value", type_=FLOAT, existing_nullable=False)

    with op.batch_alter_table("savings_goals") as batch_op:
        batch_op.alter_column("current_amount", type_=FLOAT, existing_nullable=False)
        batch_op.alter_column("target_amount", type_=FLOAT, existing_nullable=False)

    with op.batch_alter_table("categories") as batch_op:
        batch_op.alter_column("planned_amount", type_=FLOAT, existing_nullable=False)

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("amount", type_=FLOAT, existing_nullable=False)
