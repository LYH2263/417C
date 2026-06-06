import time
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

try:
    from app.logger import (
        set_request_context,
        clear_request_context,
        get_logger,
        mask_headers,
        mask_sensitive_data,
        get_current_request_id,
    )
except ImportError:
    try:
        from .logger import (
            set_request_context,
            clear_request_context,
            get_logger,
            mask_headers,
            mask_sensitive_data,
            get_current_request_id,
        )
    except ImportError:
        from logger import (
            set_request_context,
            clear_request_context,
            get_logger,
            mask_headers,
            mask_sensitive_data,
            get_current_request_id,
        )

logger = get_logger("middleware")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID")
        user_id = request.headers.get("X-User-ID")
        set_request_context(request_id=request_id, user_id=user_id)

        try:
            response = await call_next(request)
            current_rid = get_current_request_id()
            if current_rid:
                response.headers["X-Request-ID"] = current_rid
            return response
        finally:
            clear_request_context()


class PerformanceLoggingMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        request = Request(scope, receive)
        method = request.method
        path = request.url.path
        query_string = request.url.query
        client_host = request.client.host if request.client else None

        request_body_size = 0
        if method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                request_body_size = int(content_length)

        response_status = 500
        response_body_size = 0

        async def send_wrapper(message):
            nonlocal response_status, response_body_size
            if message["type"] == "http.response.start":
                response_status = message["status"]
            elif message["type"] == "http.response.body":
                response_body_size += len(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"Request failed: {method} {path}",
                extra={
                    "extra_data": {
                        "method": method,
                        "path": path,
                        "query": query_string,
                        "status_code": 500,
                        "duration_ms": elapsed_ms,
                        "request_body_size": request_body_size,
                        "client_host": client_host,
                        "error": str(exc),
                    }
                },
                exc_info=True,
            )
            raise

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        log_level = "info"
        if response_status >= 500:
            log_level = "error"
        elif response_status >= 400:
            log_level = "warning"

        log_msg = f"{method} {path} -> {response_status} ({elapsed_ms}ms)"
        extra = {
            "extra_data": {
                "method": method,
                "path": path,
                "query_string": query_string[:200] if query_string else None,
                "status_code": response_status,
                "duration_ms": elapsed_ms,
                "request_body_size": request_body_size,
                "response_body_size": response_body_size,
                "client_host": client_host,
                "headers": mask_headers(dict(request.headers)),
            }
        }

        getattr(logger, log_level)(log_msg, extra=extra)


class RequestIdResponseMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                rid = get_current_request_id()
                if rid:
                    message["headers"] = list(message.get("headers", [])) + [
                        (b"x-request-id", rid.encode())
                    ]
            await send(message)

        await self.app(scope, receive, send_wrapper)
