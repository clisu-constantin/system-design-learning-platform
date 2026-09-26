"""Firebase-shaped ID tokens signed with a test RSA key, so no test calls Google."""

import time
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey

from app.auth import StaticKeys

PROJECT = "sdi-test"
KID = "test-key"

_KEY: RSAPrivateKey = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY: RSAPrivateKey = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def public_key() -> RSAPublicKey:
    return _KEY.public_key()


def signing_keys() -> StaticKeys:
    return StaticKeys({KID: public_key()})


def make_token(
    uid: str = "uid-1",
    email: str | None = "learner@example.com",
    *,
    project: str = PROJECT,
    issuer: str | None = None,
    issued: float | None = None,
    auth_time: float | None = None,
    expires: float | None = None,
    kid: str = KID,
    wrong_key: bool = False,
    drop: tuple[str, ...] = (),
) -> str:
    """A token as Firebase would issue it; every argument breaks one thing on purpose."""
    now = time.time()
    claims: dict[str, Any] = {
        "iss": issuer if issuer is not None else f"https://securetoken.google.com/{project}",
        "aud": project,
        "sub": uid,
        "user_id": uid,
        "iat": int(issued if issued is not None else now - 10),
        "auth_time": int(auth_time if auth_time is not None else now - 60),
        "exp": int(expires if expires is not None else now + 3600),
    }
    if email is not None:
        claims["email"] = email
    for claim in drop:
        claims.pop(claim, None)
    key = _OTHER_KEY if wrong_key else _KEY
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})
