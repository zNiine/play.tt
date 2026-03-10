from abc import ABC, abstractmethod
from datetime import date
from typing import List, Dict, Optional


class StatsProvider(ABC):
    @abstractmethod
    def get_games(self, game_date: date) -> List[Dict]:
        """Return all games for the given date."""

    @abstractmethod
    def get_game_status(self, game_id: str) -> str:
        """Return current game status string."""

    @abstractmethod
    def get_player_game_stats(self, game_id: str) -> List[Dict]:
        """Return list of player stat dicts for a game."""

    @abstractmethod
    def get_rosters(self, game_date: date) -> List[Dict]:
        """Return roster data for the given date."""

    @abstractmethod
    def get_confirmed_lineups(self, game_id: str) -> Optional[Dict]:
        """Return confirmed lineup dict or None if not yet confirmed."""
