"""Actor identity and authorization, independent of transport."""
from dataclasses import dataclass
from typing import Literal

@dataclass(frozen=True)
class Actor:
    name: str
    role: Literal["reader", "admin"]


class DomainError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message



class DirectoryPolicy:
    def authorize(self, actor: Actor, write=False):
        if actor.role not in ("reader", "admin") or (write and actor.role != "admin"):
            raise DomainError(403, "This action requires an administrator")
