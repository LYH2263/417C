import os
import json
import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from app.logger import get_logger, mask_sensitive_data
except ImportError:
    try:
        from .logger import get_logger, mask_sensitive_data
    except ImportError:
        from logger import get_logger, mask_sensitive_data

logger = get_logger("client_logs")

MAX_LOGS_PER_SESSION = 500
SESSION_TTL_SECONDS = 3600 * 24
FLUSH_INTERVAL = 30


class ClientLogManager:
    def __init__(self, log_dir: str = None):
        if log_dir is None:
            log_dir = os.getenv("LOG_DIR", os.path.join(os.path.dirname(__file__), "..", "logs"))
        self.log_dir = log_dir
        self.client_log_dir = os.path.join(log_dir, "client")
        os.makedirs(self.client_log_dir, exist_ok=True)

        self._sessions: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"logs": deque(maxlen=MAX_LOGS_PER_SESSION), "last_active": time.time()}
        )
        self._lock = threading.Lock()
        self._last_flush = time.time()

    def _touch_session(self, session_id: str) -> None:
        self._sessions[session_id]["last_active"] = time.time()

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [sid for sid, data in self._sessions.items() if now - data["last_active"] > SESSION_TTL_SECONDS]
        for sid in expired:
            self._flush_session(sid)
            del self._sessions[sid]

    def _session_file_path(self, session_id: str) -> str:
        safe_sid = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return os.path.join(self.client_log_dir, f"{date_str}_{safe_sid}.jsonl")

    def _flush_session(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if not session or not session["logs"]:
            return

        filepath = self._session_file_path(session_id)
        try:
            with open(filepath, "a", encoding="utf-8") as f:
                for log_entry in list(session["logs"]):
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            session["logs"].clear()
        except Exception as e:
            logger.error(f"Failed to flush client logs for session {session_id}: {e}", exc_info=True)

    def flush_all(self) -> None:
        with self._lock:
            for session_id in list(self._sessions.keys()):
                self._flush_session(session_id)
            self._last_flush = time.time()

    def add_log(self, log_entry: Dict[str, Any]) -> None:
        with self._lock:
            session_id = log_entry.get("session_id") or "unknown"
            self._touch_session(session_id)

            processed = mask_sensitive_data(log_entry)
            processed["received_at"] = datetime.now(timezone.utc).isoformat()

            self._sessions[session_id]["logs"].append(processed)

            level = processed.get("level", "info").lower()
            log_method = getattr(logger, level, logger.info)
            log_method(
                f"[Client] [{session_id[:8]}] {processed.get('message', '')}",
                extra={"extra_data": {"client_log": processed}},
            )

            now = time.time()
            if now - self._last_flush > FLUSH_INTERVAL:
                self._cleanup_expired()
                self.flush_all()
                self._last_flush = now

    def add_logs_batch(self, logs: List[Dict[str, Any]]) -> None:
        for log in logs:
            self.add_log(log)

    def get_session_logs(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return []
            logs = list(session["logs"])
            return logs[-limit:]

    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return {}
            logs = list(session["logs"])
            level_counts = defaultdict(int)
            for log in logs:
                level_counts[log.get("level", "info").lower()] += 1
            return {
                "session_id": session_id,
                "log_count": len(logs),
                "last_active": session["last_active"],
                "level_counts": dict(level_counts),
            }


_client_log_manager: Optional[ClientLogManager] = None
_manager_lock = threading.Lock()


def get_client_log_manager() -> ClientLogManager:
    global _client_log_manager
    if _client_log_manager is None:
        with _manager_lock:
            if _client_log_manager is None:
                _client_log_manager = ClientLogManager()
    return _client_log_manager
