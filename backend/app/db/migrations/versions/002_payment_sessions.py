"""add payment_sessions table and grams/payment_session_id to donations

Revision ID: 002
Revises: 001
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'payment_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('short_id', sa.String(8), nullable=False, unique=True),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=False),
        sa.Column('amount_ntd', sa.Numeric(10, 2), nullable=False),
        sa.Column('grams', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'paid', 'expired', name='paymentstatus'),
            nullable=False,
            server_default='pending',
        ),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_payment_sessions_short_id', 'payment_sessions', ['short_id'])

    op.add_column('donations', sa.Column('grams', sa.Integer(), nullable=True))
    op.add_column(
        'donations',
        sa.Column('payment_session_id', UUID(as_uuid=True), sa.ForeignKey('payment_sessions.id'), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('donations', 'payment_session_id')
    op.drop_column('donations', 'grams')
    op.drop_index('ix_payment_sessions_short_id', table_name='payment_sessions')
    op.drop_table('payment_sessions')
    op.execute("DROP TYPE IF EXISTS paymentstatus")
