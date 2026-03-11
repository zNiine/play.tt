"""add higher_lower_scenarios table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-10 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "higher_lower_scenarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("player_a_id", sa.String(length=50), nullable=False),
        sa.Column("season_a", sa.String(length=50), nullable=True),
        sa.Column("player_b_id", sa.String(length=50), nullable=False),
        sa.Column("season_b", sa.String(length=50), nullable=True),
        sa.Column("stat_key", sa.String(length=20), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "player_a_id", "season_a", "player_b_id", "season_b", "stat_key",
            name="uq_hl_scenario"
        ),
    )


def downgrade():
    op.drop_table("higher_lower_scenarios")
