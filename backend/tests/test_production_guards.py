"""Startup warns when the sign-in cookie is not HTTPS-only."""

import logging

import pytest

from config import Settings, validate_settings


def settings(**overrides) -> Settings:
    base = dict(auth_disabled=False, google_client_id="client-id", allowed_domain="cmkl.ac.th",
                secret_key="x" * 32, session_hours=12, cookie_secure=True, demo_mode=False,
                max_upload_mb=100, session_memory_mb=0)
    return Settings(**{**base, **overrides})


@pytest.fixture
def warnings():
    records: list[logging.LogRecord] = []
    handler = logging.Handler(level=logging.WARNING)
    handler.emit = records.append
    logger = logging.getLogger("thotsakan")
    logger.addHandler(handler)  # on the logger itself: logging_setup turns propagation off
    yield records
    logger.removeHandler(handler)


def test_an_insecure_cookie_with_sign_in_is_warned_about(warnings):
    validate_settings(settings(cookie_secure=False))
    assert any("AUTH_COOKIE_SECURE" in r.getMessage() for r in warnings)


def test_a_secure_cookie_is_quiet(warnings):
    validate_settings(settings())
    assert warnings == []


@pytest.mark.parametrize("mode", [{"auth_disabled": True}, {"demo_mode": True}])
def test_no_warning_without_sign_in(warnings, mode):
    validate_settings(settings(cookie_secure=False, google_client_id="", secret_key="", **mode))
    assert warnings == []
