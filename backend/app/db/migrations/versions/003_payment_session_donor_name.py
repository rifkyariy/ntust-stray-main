"""add donor_name to payment_sessions

Revision ID: 003
Revises: 002
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_sessions",
        sa.Column("donor_name", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payment_sessions", "donor_name")
