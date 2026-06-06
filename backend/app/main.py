from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

try:
    from app.parser import extract_text
    from app.detector import detect_ai_content
    from app.rewriter import rewrite_text
    from app.logger import setup_logging, get_logger, set_request_context, clear_request_context, get_current_request_id
    from app.middleware import RequestContextMiddleware, PerformanceLoggingMiddleware, RequestIdResponseMiddleware
    from app.client_log_manager import get_client_log_manager
except ImportError:
    try:
        from .parser import extract_text
        from .detector import detect_ai_content
        from .rewriter import rewrite_text
        from .logger import setup_logging, get_logger, set_request_context, clear_request_context, get_current_request_id
        from .middleware import RequestContextMiddleware, PerformanceLoggingMiddleware, RequestIdResponseMiddleware
        from .client_log_manager import get_client_log_manager
    except ImportError:
        from parser import extract_text
        from detector import detect_ai_content
        from rewriter import rewrite_text
        from logger import setup_logging, get_logger, set_request_context, clear_request_context, get_current_request_id
        from middleware import RequestContextMiddleware, PerformanceLoggingMiddleware, RequestIdResponseMiddleware
        from client_log_manager import get_client_log_manager

setup_logging()
logger = get_logger("main")

app = FastAPI(title="Academic AIGC Helper API")

app.add_middleware(RequestContextMiddleware)
app.add_middleware(PerformanceLoggingMiddleware)
app.add_middleware(RequestIdResponseMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


class TextPayload(BaseModel):
    text: str


class RewritePayload(BaseModel):
    text: str
    level: str = "medium"


class ClientLogEntry(BaseModel):
    level: str = "info"
    message: str
    timestamp: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    url: Optional[str] = None
    stack: Optional[str] = None
    component_stack: Optional[str] = None
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None
    user_path: Optional[List[str]] = None
    extra: Optional[Dict[str, Any]] = None


class ClientLogBatch(BaseModel):
    logs: List[ClientLogEntry]


class ErrorFeedback(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    error_message: str
    error_stack: Optional[str] = None
    user_description: str
    user_path: Optional[List[str]] = None
    app_state: Optional[Dict[str, Any]] = None


@app.post("/api/rewrite")
async def rewrite(payload: RewritePayload):
    logger.info(f"Rewrite request started, level={payload.level}, text_length={len(payload.text)}")
    if not payload.text:
        logger.warning("Rewrite request with empty text")
        raise HTTPException(status_code=400, detail="No text provided")

    current_text = payload.text
    max_retries = 3
    detection_after = None

    for i in range(max_retries):
        logger.debug(f"Rewrite iteration {i + 1}/{max_retries}")
        current_text = rewrite_text(current_text, payload.level)
        detection_after = detect_ai_content(current_text)

        if detection_after["overall_ai_score"] < 10:
            logger.info(f"Rewrite converged after {i + 1} iterations, ai_score={detection_after['overall_ai_score']}")
            break

    logger.info(
        "Rewrite completed",
        extra={
            "extra_data": {
                "iterations": i + 1,
                "final_ai_score": detection_after["overall_ai_score"] if detection_after else None,
                "original_length": len(payload.text),
                "rewritten_length": len(current_text),
            }
        },
    )

    return {
        "original_text": payload.text,
        "rewritten_text": current_text,
        "detection_after": detection_after,
        "iterations": i + 1,
    }


@app.get("/")
async def root():
    return {"message": "Welcome to the Academic AIGC Helper API"}


@app.post("/api/detect-text")
async def detect_text(payload: TextPayload):
    logger.info(f"Detect text request, length={len(payload.text)}")
    if not payload.text:
        logger.warning("Detect request with empty text")
        raise HTTPException(status_code=400, detail="No text provided")
    result = detect_ai_content(payload.text)
    logger.info(
        "Detection completed",
        extra={"extra_data": {"ai_score": result.get("overall_ai_score"), "chunks": len(result.get("details", []))}},
    )
    return result


@app.post("/api/detect-file")
async def detect_file(file: UploadFile = File(...)):
    logger.info(f"Detect file request, filename={file.filename}, size={file.size}")
    content = await file.read()
    try:
        text = extract_text(content, file.filename)
    except Exception as e:
        logger.error(f"File extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

    result = detect_ai_content(text)
    logger.info(
        "File detection completed",
        extra={
            "extra_data": {
                "filename": file.filename,
                "text_length": len(text),
                "ai_score": result.get("overall_ai_score"),
            }
        },
    )
    return {
        "filename": file.filename,
        "text": text,
        **result,
    }


@app.post("/api/client-logs")
async def receive_client_logs(batch: ClientLogBatch):
    manager = get_client_log_manager()
    count = 0
    for entry in batch.logs:
        manager.add_log(entry.model_dump(exclude_none=True))
        count += 1
    logger.debug(f"Received {count} client logs")
    return {"received": count, "status": "ok"}


@app.post("/api/error-feedback")
async def receive_error_feedback(feedback: ErrorFeedback):
    manager = get_client_log_manager()
    log_entry = feedback.model_dump(exclude_none=True)
    log_entry["level"] = "error"
    log_entry["message"] = f"User feedback: {feedback.error_message}"
    log_entry["type"] = "error_feedback"
    manager.add_log(log_entry)
    logger.info(
        "Error feedback received",
        extra={"extra_data": {"session_id": feedback.session_id, "has_user_description": bool(feedback.user_description)}},
    )
    return {"status": "ok", "message": "Feedback received, thank you"}


@app.get("/api/client-logs/{session_id}")
async def get_session_logs(session_id: str, limit: int = 100):
    manager = get_client_log_manager()
    logs = manager.get_session_logs(session_id, limit=limit)
    summary = manager.get_session_summary(session_id)
    return {"session_id": session_id, "summary": summary, "logs": logs}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    rid = get_current_request_id()
    logger.error(
        f"Unhandled exception: {exc}",
        extra={
            "extra_data": {
                "path": request.url.path,
                "method": request.method,
                "request_id": rid,
            }
        },
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": rid,
        },
    )


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting server on 0.0.0.0:8417")
    uvicorn.run(app, host="0.0.0.0", port=8417)
