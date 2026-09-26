"""The Firebase ID token check: who is calling.

Firebase signs its ID tokens with Google keys that rotate; the server fetches the public ones and
needs no service account, only the project id (docs/adr/0001-backend-with-rented-auth.md). The
rules are the ones Firebase documents for verifying ID tokens with a third-party JWT library.
"""

import re
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from cryptography.x509 import load_pem_x509_certificate

GOOGLE_KEYS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

#: Seconds of clock difference forgiven between Google and this server.
LEEWAY = 30


class InvalidToken(Exception):
    """The request did not prove who it is: 401."""


class KeysUnavailable(Exception):
    """Google keys could not be fetched and none are cached, so no token can be checked: 503."""


@dataclass(frozen=True, slots=True)
class Identity:
    """Who a valid token belongs to."""

    uid: str
    email: str | None
    #: When the Learner signed in, in seconds - a refreshed token keeps it. Decides a 410 after a delete.
    auth_time: int


class KeySource(Protocol):
    """Where the public key of a token comes from: Google in production, a test key in the tests."""

    def get(self, kid: str) -> RSAPublicKey | None: ...


class StaticKeys:
    """A fixed set of keys, for tests and local tools."""

    def __init__(self, keys: Mapping[str, RSAPublicKey]) -> None:
        self._keys = dict(keys)

    def get(self, kid: str) -> RSAPublicKey | None:
        return self._keys.get(kid)


_MAX_AGE = re.compile(r"max-age=(\d+)")


class GooglePublicKeys:
    """The Google signing keys of Firebase, cached for as long as the Cache-Control max-age says.

    If a refresh fails, the keys already held stay in use and the next try waits a minute, so a
    Google hiccup neither logs everyone out nor sends a request to Google per API call.
    """

    DEFAULT_MAX_AGE = 3600
    RETRY_AFTER = 60

    def __init__(
        self,
        url: str = GOOGLE_KEYS_URL,
        client: httpx.Client | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._url = url
        self._client = client or httpx.Client(timeout=5.0)
        self._clock = clock
        self._keys: dict[str, RSAPublicKey] = {}
        self._expires = float("-inf")
        self._lock = threading.Lock()

    def get(self, kid: str) -> RSAPublicKey | None:
        with self._lock:
            if self._clock() >= self._expires:
                self._refresh()
            return self._keys.get(kid)

    def _refresh(self) -> None:
        try:
            response = self._client.get(self._url)
            response.raise_for_status()
            certificates: dict[str, str] = response.json()
            keys: dict[str, RSAPublicKey] = {}
            for kid, pem in certificates.items():
                key = load_pem_x509_certificate(pem.encode()).public_key()
                if isinstance(key, RSAPublicKey):
                    keys[kid] = key
        except (httpx.HTTPError, ValueError) as error:
            if not self._keys:
                raise KeysUnavailable("Google signing keys are unavailable") from error
            self._expires = self._clock() + self.RETRY_AFTER
            return
        match = _MAX_AGE.search(response.headers.get("cache-control", ""))
        self._keys = keys
        self._expires = self._clock() + (int(match.group(1)) if match else self.DEFAULT_MAX_AGE)


def verify_token(token: str, project_id: str, keys: KeySource) -> Identity:
    """The Identity in a Firebase ID token of `project_id`, or InvalidToken.

    Checked: RS256 signed by a current Google key, audience and issuer of this project (a token
    of another Firebase project is refused), not expired, issued and signed in no later than now,
    and a non-empty subject (the Firebase uid).
    """
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if header.get("alg") != "RS256" or not isinstance(kid, str):
            raise InvalidToken("Token is not signed by Firebase")
        key = keys.get(kid)
        if key is None:
            raise InvalidToken("Token is signed by an unknown key")
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            leeway=LEEWAY,
            options={"require": ["exp", "iat", "aud", "iss", "sub", "auth_time"]},
        )
    except jwt.PyJWTError as error:
        raise InvalidToken(f"Invalid token: {error}") from error

    uid, iat, auth_time, email = claims["sub"], claims["iat"], claims["auth_time"], claims.get("email")
    if not isinstance(uid, str) or not uid or len(uid) > 128:
        raise InvalidToken("Token has no subject")
    latest = time.time() + LEEWAY
    for name, value in (("iat", iat), ("auth_time", auth_time)):
        if not isinstance(value, int | float) or isinstance(value, bool) or value > latest:
            raise InvalidToken(f"Token {name} is in the future")
    return Identity(uid=uid, email=email if isinstance(email, str) else None, auth_time=int(auth_time))
