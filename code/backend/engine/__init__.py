"""CampusSwap matching engine: pure Python, no database or web code."""
from .structures import Cycle, MatchResult, Participant, Round, validate
from .ttc import top_trading_cycles

__all__ = ["Cycle", "MatchResult", "Participant", "Round", "validate", "top_trading_cycles"]
