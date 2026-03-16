"""add multi-user support

Revision ID: 001
Revises:
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect as sa_inspect

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 0. Clean up any leftover temp tables from a previous failed run ───────
    for tmp in (
        "_alembic_tmp_users",
        "_alembic_tmp_transactions",
        "_alembic_tmp_categories",
        "_alembic_tmp_investments",
        "_alembic_tmp_savings_goals",
    ):
        conn.execute(text(f"DROP TABLE IF EXISTS {tmp}"))

    # ── 1. Extend users table ────────────────────────────────────────────────
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("email", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"))
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))

    # Backfill email from username for existing users
    conn.execute(text("UPDATE users SET email = username || '@localhost' WHERE email IS NULL"))

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("email", nullable=False)
        batch_op.create_unique_constraint("uq_users_email", ["email"])

    # ── 2. Add user_id (nullable) to all data tables ─────────────────────────
    for table in ("transactions", "categories", "investments", "savings_goals"):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))

    # Backfill user_id with the first (admin) user's id
    result = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
    if result:
        admin_id = result[0]
        for table in ("transactions", "categories", "investments", "savings_goals"):
            conn.execute(
                text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
                {"uid": admin_id},
            )

    # ── 3. Make user_id NOT NULL, add FK + index ──────────────────────────────
    for table in ("transactions", "investments", "savings_goals"):
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column("user_id", nullable=False)
            batch_op.create_index(f"ix_{table}_user_id", ["user_id"])
            batch_op.create_foreign_key(f"fk_{table}_user_id", "users", ["user_id"], ["id"])

    # ── 4. Fix categories: drop unique(name), add unique(name, user_id) ──────
    inspector = sa_inspect(conn)
    unique_constraints = inspector.get_unique_constraints("categories")
    name_constraint = next(
        (c["name"] for c in unique_constraints if c.get("column_names", c.get("columns", [])) == ["name"]),
        None,
    )
    with op.batch_alter_table("categories") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_index("ix_categories_user_id", ["user_id"])
        batch_op.create_foreign_key("fk_categories_user_id", "users", ["user_id"], ["id"])
        if name_constraint:
            batch_op.drop_constraint(name_constraint, type_="unique")
        batch_op.create_unique_constraint("uq_category_name_user", ["name", "user_id"])

    # ── 5. Create refresh_tokens table ────────────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("refresh_tokens")

    for table in ("transactions", "categories", "investments", "savings_goals"):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_user_id", type_="foreignkey")
            batch_op.drop_index(f"ix_{table}_user_id")
            batch_op.drop_column("user_id")

    # Restore unique(name) on categories, drop composite constraint
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_category_name_user", type_="unique")
        batch_op.create_unique_constraint("uq_categories_name", ["name"])

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_email", type_="unique")
        batch_op.drop_column("created_at")
        batch_op.drop_column("is_active")
        batch_op.drop_column("email")
