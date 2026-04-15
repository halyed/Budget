"""add goal_investments junction table

Revision ID: 005
Revises: 004
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'goal_investments',
        sa.Column('goal_id', sa.Integer(), sa.ForeignKey('savings_goals.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('investment_id', sa.Integer(), sa.ForeignKey('investments.id', ondelete='CASCADE'), primary_key=True),
    )


def downgrade():
    op.drop_table('goal_investments')
