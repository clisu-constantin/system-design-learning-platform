"""Token check: only a valid Firebase ID token of our project gives an Identity."""

import base64
import datetime
import json
import time

import httpx
import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509 import CertificateBuilder, Name, NameAttribute, random_serial_number
from cryptography.x509.oid import NameOID

from app.auth import GooglePublicKeys, InvalidToken, KeysUnavailable, verify_token
from tests.tokens import PROJECT, make_token, signing_keys


def check(token: str) -> None:
    verify_token(token, PROJECT, signing_keys())


def test_a_valid_token_gives_the_uid_the_email_and_the_sign_in_time() -> None:
    signed_in = time.time() - 120
    identity = verify_token(make_token("abc", "a@b.c", auth_time=signed_in), PROJECT, signing_keys())
    assert identity.uid == "abc"
    assert identity.email == "a@b.c"
    assert identity.auth_time == int(signed_in)


def test_a_token_without_email_is_still_valid() -> None:
    assert verify_token(make_token(email=None), PROJECT, signing_keys()).email is None


@pytest.mark.parametrize("token", ["", "abc", "a.b.c", "Bearer x"])
def test_a_malformed_token_is_rejected(token: str) -> None:
    with pytest.raises(InvalidToken):
        check(token)


def test_a_token_signed_by_another_key_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(wrong_key=True))


def test_a_token_with_an_unknown_key_id_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(kid="not-ours"))


def test_an_expired_token_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(issued=time.time() - 7200, auth_time=time.time() - 7200, expires=time.time() - 3600))


def test_a_token_of_another_project_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(project="someone-else"))


def test_a_token_with_our_audience_but_another_issuer_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(issuer="https://securetoken.google.com/someone-else"))


def test_a_token_issued_in_the_future_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(issued=time.time() + 600))


def test_a_sign_in_time_in_the_future_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(auth_time=time.time() + 600))


def test_a_few_seconds_of_clock_skew_are_allowed() -> None:
    check(make_token(issued=time.time() + 5, auth_time=time.time() + 5))


@pytest.mark.parametrize("claim", ["sub", "auth_time", "iat", "exp"])
def test_a_token_missing_a_required_claim_is_rejected(claim: str) -> None:
    with pytest.raises(InvalidToken):
        check(make_token(drop=(claim,)))


def test_an_empty_subject_is_rejected() -> None:
    with pytest.raises(InvalidToken):
        check(make_token(uid=""))


def test_an_unsigned_token_is_rejected() -> None:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "kid": "test-key"}).encode()).rstrip(b"=")
    claims = base64.urlsafe_b64decode(make_token().split(".")[1] + "==")
    token = f"{header.decode()}.{base64.urlsafe_b64encode(claims).rstrip(b'=').decode()}."
    with pytest.raises(InvalidToken):
        check(token)


# The Google key source: cached by Cache-Control max-age.


def _certificate_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = Name([NameAttribute(NameOID.COMMON_NAME, "test")])
    start = datetime.datetime.fromtimestamp(time.time() - 60, tz=datetime.UTC)
    cert = (
        CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(random_serial_number())
        .not_valid_before(start)
        .not_valid_after(start + datetime.timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    return cert.public_bytes(serialization.Encoding.PEM).decode()


class FakeGoogle:
    """A stand-in for the Google key endpoint that counts its calls."""

    def __init__(self, max_age: int = 600) -> None:
        self.calls = 0
        self.fail = False
        self.max_age = max_age
        self.pem = _certificate_pem()

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        if self.fail:
            return httpx.Response(500)
        return httpx.Response(
            200,
            json={"key-1": self.pem},
            headers={"Cache-Control": f"public, max-age={self.max_age}, must-revalidate, no-transform"},
        )


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def google_keys(fake: FakeGoogle, clock: Clock) -> GooglePublicKeys:
    return GooglePublicKeys(client=httpx.Client(transport=httpx.MockTransport(fake.handler)), clock=clock)


def test_google_keys_are_fetched_once_and_cached_for_max_age() -> None:
    fake, clock = FakeGoogle(max_age=600), Clock()
    keys = google_keys(fake, clock)
    assert keys.get("key-1") is not None
    clock.now += 599
    assert keys.get("key-1") is not None
    assert fake.calls == 1
    clock.now += 2
    keys.get("key-1")
    assert fake.calls == 2


def test_an_unknown_key_id_is_none() -> None:
    assert google_keys(FakeGoogle(), Clock()).get("other") is None


def test_stale_keys_are_used_when_google_cannot_be_reached() -> None:
    fake, clock = FakeGoogle(max_age=60), Clock()
    keys = google_keys(fake, clock)
    keys.get("key-1")
    fake.fail = True
    clock.now += 120
    assert keys.get("key-1") is not None


def test_no_keys_at_all_is_an_error_of_its_own() -> None:
    fake = FakeGoogle()
    fake.fail = True
    with pytest.raises(KeysUnavailable):
        google_keys(fake, Clock()).get("key-1")
