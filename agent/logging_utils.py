"""
Centralized logging system for NEXUS Agent
Stores logs in memory for API access
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import deque
import threading

# Thread-safe in-memory log storage
_log_storage = deque(maxlen=1000)  # Keep last 1000 logs
_log_lock = threading.Lock()
_log_counter = 0


def log_event(
    type: str,
    message: str,
    severity: str = "info",
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log an event and store it for API access
    
    Args:
        type: Event type (signal, execution, analysis, routing, monitor, error)
        message: Human-readable message
        severity: critical, high, warning, success, info
        metadata: Optional additional data
    """
    global _log_counter
    
    with _log_lock:
        _log_counter += 1
        log_entry = {
            "id": _log_counter,
            "timestamp": datetime.now().isoformat(),
            "type": type,
            "message": message,
            "severity": severity,
            "metadata": metadata or {}
        }
        _log_storage.append(log_entry)
        
        # Also log to console
        level = {
            "critical": logging.CRITICAL,
            "high": logging.ERROR,
            "warning": logging.WARNING,
            "success": logging.INFO,
            "info": logging.INFO
        }.get(severity, logging.INFO)
        
        logger = logging.getLogger("nexus.agent")
        logger.log(level, f"[{type.upper()}] {message}")


def get_logs(limit: int = 100, type_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve logs from memory
    
    Args:
        limit: Maximum number of logs to return
        type_filter: Optional filter by type (signal, execution, analysis, etc.)
    
    Returns:
        List of log entries (newest first)
    """
    with _log_lock:
        logs = list(_log_storage)
    
    # Filter by type if specified
    if type_filter:
        logs = [log for log in logs if log["type"] == type_filter]
    
    # Return newest first, limited
    return logs[-limit:][::-1]


def get_log_stats() -> Dict[str, Any]:
    """Get statistics about stored logs"""
    with _log_lock:
        logs = list(_log_storage)
    
    if not logs:
        return {
            "total": 0,
            "by_type": {},
            "by_severity": {},
            "oldest": None,
            "newest": None
        }
    
    by_type = {}
    by_severity = {}
    
    for log in logs:
        # Count by type
        log_type = log["type"]
        by_type[log_type] = by_type.get(log_type, 0) + 1
        
        # Count by severity
        severity = log["severity"]
        by_severity[severity] = by_severity.get(severity, 0) + 1
    
    return {
        "total": len(logs),
        "by_type": by_type,
        "by_severity": by_severity,
        "oldest": logs[0]["timestamp"] if logs else None,
        "newest": logs[-1]["timestamp"] if logs else None
    }


def clear_logs() -> None:
    """Clear all logs from memory"""
    global _log_counter
    with _log_lock:
        _log_storage.clear()
        _log_counter = 0


# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
