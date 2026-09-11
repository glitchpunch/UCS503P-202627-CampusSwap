"""Shapes of JSON bodies the browser sends. FastAPI checks them automatically."""
from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=200)
    role: Literal["student", "admin"]


class RequestIn(BaseModel):
    room_ids: list[int]


class MatchRunIn(BaseModel):
    algorithm: Literal["ttc", "pairwise"] = "ttc"
    dry_run: bool = False
