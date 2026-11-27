from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
import uuid
import pandas as pd
import io
import os
from pathlib import Path

from config import Settings, get_settings
from sessions.store import set_session

MB = 1024 * 1024

router = APIRouter()

# The Data tab (frontend/src/utils/parseFile.ts) lists a column as numeric when at least 80 % of its
# filled cells are numbers, and ignores the rest. The server reads the column the same way, so an
# analysis does not fail on a stray "?" or "n/a".
NUMERIC_SHARE = 0.8


def _read_numbers_as_numbers(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.select_dtypes(include=["object"]).columns:  # text only; a True/False column stays
        filled = df[col].notna().sum()
        numbers = pd.to_numeric(df[col], errors="coerce")
        if filled and numbers.notna().sum() / filled >= NUMERIC_SHARE:
            df[col] = numbers
    return df


async def _read_capped(file: UploadFile, limit: int) -> bytes:
    """The upload's bytes, refused as soon as they pass ``limit`` (never more than limit + 1 MB in memory)."""
    chunks, size = [], 0
    while chunk := await file.read(MB):
        size += len(chunk)
        if size > limit:
            raise HTTPException(status_code=413, detail=f"The file is larger than {limit // MB} MB.")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload")
async def upload_dataset(request: Request, file: UploadFile = File(...), settings: Settings = Depends(get_settings)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    limit = settings.max_upload_mb * MB
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > limit + MB:  # + 1 MB for the multipart wrapping
        raise HTTPException(status_code=413, detail=f"The file is larger than {settings.max_upload_mb} MB.")
    content = await _read_capped(file, limit)

    try:
        # pandas holds the GIL for most of a parse; in the threadpool it at least leaves the event
        # loop free to accept and answer other requests.
        df = await run_in_threadpool(lambda: _read_numbers_as_numbers(pd.read_csv(io.BytesIO(content))))

        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Store df
        set_session(session_id, df, max_total_bytes=settings.session_memory_mb * MB)

        # Dev only: keep a copy of the raw upload on disk (see docker-compose.dev.yml).
        dump_dir = os.getenv("UPLOAD_DUMP_DIR")
        if dump_dir:
            Path(dump_dir).mkdir(parents=True, exist_ok=True)
            (Path(dump_dir) / f"{session_id}.csv").write_bytes(content)
        
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(exclude=['number']).columns.tolist()
        
        return {
            "session_id": session_id,
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
