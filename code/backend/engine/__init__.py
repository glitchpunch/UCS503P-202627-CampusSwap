"""CampusSwap matching engine: pure Python, no database or web code."""
from .metrics import cycle_length_counts, match_yield
from .pairwise import pairwise_swaps
from .structures import Cycle, MatchResult, Participant, Round, validate
from .ttc import top_trading_cycles

__all__ = [
    "Cycle", "MatchResult", "Participant", "Round", "validate",
    "top_trading_cycles", "pairwise_swaps", "match_yield", "cycle_length_counts",
]
