import json
import logging
import logging.handlers
import os
import sys
import uuid
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from contextvars import ContextVar

request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
request_start_time_var: ContextVar[Optional[float]] = ContextVar("request_start_time", default=None)

SENSITIVE_FIELDS = {
    "api_key", "apikey", "apiKey", "API_KEY",
    "authorization", "Authorization", "AUTHORIZATION",
    "token", "Token", "TOKEN",
    "password", "Password", "PASSWORD",
    "secret", "Secret", "SECRET",
    "groq_api_key", "GROQ_API_KEY",
}

SENSITIVE_HEADERS = {"authorization", "x-api-key", "x-auth-token"}


def mask_sensitive_value(key: str, value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if len(value) <= 4:
        return "****"
    return f"{value[:4]}****"


def mask_sensitive_data(data: Any) -> Any:
    if isinstance(data, dict):
        return {
            k: (mask_sensitive_value(k, v) if k.lower() in {f.lower() for f in SENSITIVE_FIELDS} else mask_sensitive_data(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    return data


def mask_headers(headers: Dict[str, str]) -> Dict[str, str]:
    result = {}
    for k, v in headers.items():
        if k.lower() in SENSITIVE_HEADERS:
            result[k] = mask_sensitive_value(k, v)
        else:
            result[k] = v
    return result


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }

        request_id = request_id_var.get()
        if request_id:
            log_entry["request_id"] = request_id

        user_id = user_id_var.get()
        if user_id:
            log_entry["user_id"] = user_id

        start_time = request_start_time_var.get()
        if start_time is not None:
            log_entry["execution_time_ms"] = round((time.time() - start_time) * 1000, 2)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        if hasattr(record, "extra_data") and record.extra_data:
            log_entry["extra"] = mask_sensitive_data(record.extra_data)

        return json.dumps(log_entry, ensure_ascii=False)


class ColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG: "\033[36m",
        logging.INFO: "\033[32m",
        logging.WARNING: "\033[33m",
        logging.ERROR: "\033[31m",
        logging.CRITICAL: "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, "")
        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        level = record.levelname.ljust(8)
        location = f"{record.module}:{record.funcName}:{record.lineno}"

        request_id = request_id_var.get()
        rid_str = f" [{request_id[:8]}]" if request_id else ""

        parts = [
            f"\033[90m{timestamp}\033[0m",
            f"{color}{level}{self.RESET}",
            f"\033[90m{location}{self.RESET}{rid_str}",
            f"{color}{record.getMessage()}{self.RESET}",
        ]

        if record.exc_info:
            parts.append(f"\n{self.formatException(record.exc_info)}")

        return " | ".join(parts)


def setup_logging(log_level: str = None, log_dir: str = None) -> logging.Logger:
    if log_level is None:
        log_level = os.getenv("LOG_LEVEL", "INFO")
    if log_dir is None:
        log_dir = os.getenv("LOG_DIR", os.path.join(os.path.dirname(__file__), "..", "logs"))

    os.makedirs(log_dir, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.handlers.clear()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColorFormatter())
    console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.addHandler(console_handler)

    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=os.path.join(log_dir, "app.log"),
        when="midnight",
        interval=1,
        backupCount=7,
        encoding="utf-8",
        utc=True,
    )
    file_handler.setFormatter(JsonFormatter())
    file_handler.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)

    error_handler = logging.handlers.TimedRotatingFileHandler(
        filename=os.path.join(log_dir, "error.log"),
        when="midnight",
        interval=1,
        backupCount=7,
        encoding="utf-8",
        utc=True,
    )
    error_handler.setFormatter(JsonFormatter())
    error_handler.setLevel(logging.WARNING)
    root_logger.addHandler(error_handler)

    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.WARNING)

    logger = logging.getLogger("paperwise")
    logger.info("Logging system initialized", extra={"extra_data": {"log_level": log_level, "log_dir": log_dir}})
    return logger


def get_logger(name: str = None) -> logging.Logger:
    if name:
        return logging.getLogger(f"paperwise.{name}")
    return logging.getLogger("paperwise")


def generate_request_id() -> str:
    return uuid.uuid4().hex


def set_request_context(request_id: str = None, user_id: str = None) -> None:
    if request_id is None:
        request_id = generate_request_id()
    request_id_var.set(request_id)
    if user_id is not None:
        user_id_var.set(user_id)
    request_start_time_var.set(time.time())


def clear_request_context() -> None:
    request_id_var.set(None)
    user_id_var.set(None)
    request_start_time_var.set(None)


def get_current_request_id() -> Optional[str]:
    return request_id_var.get()
