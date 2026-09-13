import hashlib
import secrets
from collections import deque
from threading import Lock
from time import monotonic

from ..policy import DomainError


class PasswordHasher:
    def hash(self, password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=3, maxmem=64 * 1024 * 1024)
        return salt.hex() + ":" + digest.hex()

    def verify(self, password: str, encoded: str) -> bool:
        salt, expected = encoded.split(":", 1)
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=32768, r=8, p=3, maxmem=64 * 1024 * 1024)
        return secrets.compare_digest(actual.hex(), expected)


class LoginRateLimiter:
    """Bounded per-process throttle for the local deployment; no forwarded-IP trust."""
    def __init__(self):
        self.attempts = {}
        self.lock = Lock()

    def check(self, address: str):
        now = monotonic()
        with self.lock:
            self.attempts = {key: value for key, value in self.attempts.items() if value and value[-1] > now - 60}
            if address not in self.attempts and len(self.attempts) >= 10000:
                raise DomainError(429, "Too many sign-in attempts; try again later")
            entries = self.attempts.setdefault(address, deque())
            while entries and entries[0] <= now - 60:
                entries.popleft()
            if len(entries) >= 10:
                raise DomainError(429, "Too many sign-in attempts; try again in a minute")
            entries.append(now)
