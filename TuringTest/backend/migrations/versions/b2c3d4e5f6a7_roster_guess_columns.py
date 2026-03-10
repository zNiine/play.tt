"""roster and guess columns

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("players", sa.Column("roster_bats_throws", sa.String(length=10), nullable=True))
    op.add_column("players", sa.Column("roster_height", sa.String(length=20), nullable=True))
    op.add_column("players", sa.Column("roster_weight", sa.String(length=20), nullable=True))
    op.add_column("players", sa.Column("roster_jersey", sa.String(length=10), nullable=True))
    op.add_column("teams", sa.Column("division", sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column("teams", "division")
    op.drop_column("players", "roster_jersey")
    op.drop_column("players", "roster_weight")
    op.drop_column("players", "roster_height")
    op.drop_column("players", "roster_bats_throws")
