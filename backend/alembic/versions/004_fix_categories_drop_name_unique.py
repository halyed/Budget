"""drop leftover UNIQUE(name) from categories

Revision ID: 004
Revises: 003
Create Date: 2026-03-24
"""
from alembic import op
from sqlalchemy import text

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Rebuild the table without the old inline UNIQUE(name) constraint
    conn.execute(text("""
        CREATE TABLE _categories_new (
            id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            planned_amount FLOAT NOT NULL,
            icon VARCHAR(50),
            color VARCHAR(20),
            user_id INTEGER NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_category_name_user UNIQUE (name, user_id),
            CONSTRAINT fk_categories_user_id FOREIGN KEY(user_id) REFERENCES users (id)
        )
    """))
    conn.execute(text("INSERT INTO _categories_new SELECT id, name, type, planned_amount, icon, color, user_id FROM categories"))
    conn.execute(text("DROP TABLE categories"))
    conn.execute(text("ALTER TABLE _categories_new RENAME TO categories"))


def downgrade():
    pass
