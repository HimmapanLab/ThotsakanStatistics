"""Request logging that never contains data.

One JSON line per request: method, path, status, duration, a request id (also sent back in the
X-Request-ID header, so a student's error message can be matched to its log line) and a short
hash of the signed-in user's email. Never request or response bodies, file names, column names,
values or emails.

An unexpected error is logged with its exception type and where in the code it happened, but not
its message: exception messages can quote cell values (pandas: "could not convert string 'Alice'").
"""

import hashlib
import json
import logging
import os
import re
import sys
import time
import traceback
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("thotsakan")

_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


class JsonFormatter(logging.Formatter):
    FIELDS = ("request_id", "method", "path", "status", "duration_ms", "user", "error", "where")

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        entry.update({key: getattr(record, key) for key in self.FIELDS if hasattr(record, key)})
        return json.dumps(entry, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.handlers[:] = [handler]
    logger.setLevel(level)
    logger.propagate = False


def user_tag(email: str | None) -> str | None:
    """Tells one user's requests apart without naming them."""
    return hashlib.sha256(email.encode()).hexdigest()[:12] if email else None


def _code_location(error: BaseException) -> list[str]:
    """file:line in function, for each frame: where it happened, without any values."""
    return [f"{os.path.basename(frame.filename)}:{frame.lineno} in {frame.name}"
            for frame in traceback.extract_tb(error.__traceback__)]


async def log_requests(request: Request, call_next):
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming if _REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex[:16]
    start = time.perf_counter()
    fields = {"request_id": request_id, "method": request.method, "path": request.url.path}
    try:
        response = await call_next(request)
    except Exception as error:
        logger.error(
            "unexpected error",
            extra={**fields, "status": 500, "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                   "user": user_tag(getattr(request.state, "user", None)),
                   "error": type(error).__name__, "where": _code_location(error)},
        )
        response = JSONResponse(
            status_code=500,
            content={"detail": "Something went wrong on the server. Please try again.", "request_id": request_id},
        )
    else:
        level = logging.DEBUG if request.url.path == "/api/health" else logging.INFO
        logger.log(
            level, "request",
            extra={**fields, "status": response.status_code,
                   "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                   "user": user_tag(getattr(request.state, "user", None))},
        )
    response.headers["X-Request-ID"] = request_id
    return response
