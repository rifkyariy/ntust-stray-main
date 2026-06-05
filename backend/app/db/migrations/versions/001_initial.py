"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE stationstatus AS ENUM ('online', 'low_food', 'offline')")

    op.create_table(
        'stations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_code', sa.String(20), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('district', sa.String(100), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('status', sa.Enum('online', 'low_food', 'offline', name='stationstatus'), nullable=False, server_default='offline'),
        sa.Column('food_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('battery_pct', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('temp_c', sa.Float(), nullable=False, server_default='0'),
        sa.Column('humidity_pct', sa.Float(), nullable=False, server_default='0'),
        sa.Column('installed_at', sa.DateTime(), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=True),
    )
    op.create_index('ix_stations_station_code', 'stations', ['station_code'])

    op.create_table(
        'donations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=False),
        sa.Column('amount_ntd', sa.Numeric(10, 2), nullable=False),
        sa.Column('donor_name', sa.String(100), nullable=True),
        sa.Column('dispensed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'schedules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=False),
        sa.Column('cron_expr', sa.String(100), nullable=False),
        sa.Column('grams', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
    )

    op.create_table(
        'cats',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('cat_code', sa.String(20), nullable=False, unique=True),
        sa.Column('first_seen', sa.DateTime(), nullable=False),
        sa.Column('station_id', UUID(as_uuid=True), sa.ForeignKey('stations.id'), nullable=True),
    )
    op.create_index('ix_cats_cat_code', 'cats', ['cat_code'])

    op.create_table(
        'admin_users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(200), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_admin_users_email', 'admin_users', ['email'])


def downgrade() -> None:
    op.drop_table('admin_users')
    op.drop_table('cats')
    op.drop_table('schedules')
    op.drop_table('donations')
    op.drop_table('stations')
    op.execute('DROP TYPE stationstatus')
