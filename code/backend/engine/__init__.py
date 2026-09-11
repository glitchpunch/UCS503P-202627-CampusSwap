"""CampusSwap matching engine: pure Python, no database or web code."""
from .structures import Cycle, MatchResult, Participant, Round, validate

__all__ = ["Cycle", "MatchResult", "Participant", "Round", "validate"]
