"""
Centralized Log Manager for NEXUS Agent
Stores logs in memory and provides API access
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import deque
from dataclasses import dataclass, asdict
import threading

@dataclass
class LogEntry:
    """Represents a single log entry"""
    id: int
    timestamp: str
    type: str  # signal, execution, analysis, routing, monitor
    message: str
    severity: str  # critical, high, warning, success, info
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self):
        return asdict(self)


class LogManager:
    """Thread-safe log manager with in-memory storage"""
    
    def __init__(self, max_logs: int = 1000):
        self.max_logs = max_logs
        self.logs: deque = deque(maxlen=max_logs)
        self.log_counter = 0
        self.lock = threading.Lock()
    
    def add_log(
        self,
        log_type: str,
        message: str,
        severity: str = "info",
        metadata: Optional[Dict[str, Any]] = None
    ) -> LogEntry:
        """Add a new log entry"""
        with self.lock:
            self.log_counter += 1
            
            log_entry = LogEntry(
                id=self.log_counter,
                timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                type=log_type,
                message=message,
                severity=severity,
                metadata=metadata or {}
            )
            
            self.logs.append(log_entry)
            
            # Print to console
            emoji_map = {
                "signal": "📊",
                "execution": "⚡",
                "analysis": "🤖",
                "routing": "🌉",
                "monitor": "👁️"
            }
            emoji = emoji_map.get(log_type, "📝")
            print(f"{emoji} [{log_type.upper()}] {message}")
            
            return log_entry
    
    def get_logs(
        self,
        limit: Optional[int] = None,
        log_type: Optional[str] = None,
        severity: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get logs with optional filtering"""
        with self.lock:
            logs = list(self.logs)
            
            # Filter by type
            if log_type and log_type != "all":
                logs = [log for log in logs if log.type == log_type]
            
            # Filter by severity
            if severity:
                logs = [log for log in logs if log.severity == severity]
            
            # Reverse to get newest first
            logs.reverse()
            
            # Limit results
            if limit:
                logs = logs[:limit]
            
            return [log.to_dict() for log in logs]
    
    def clear_logs(self):
        """Clear all logs"""
        with self.lock:
            self.logs.clear()
            self.log_counter = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get log statistics"""
        with self.lock:
            logs = list(self.logs)
            
            return {
                "total_logs": len(logs),
                "by_type": {
                    "signal": len([l for l in logs if l.type == "signal"]),
                    "execution": len([l for l in logs if l.type == "execution"]),
                    "analysis": len([l for l in logs if l.type == "analysis"]),
                    "routing": len([l for l in logs if l.type == "routing"]),
                    "monitor": len([l for l in logs if l.type == "monitor"])
                },
                "by_severity": {
                    "critical": len([l for l in logs if l.severity == "critical"]),
                    "high": len([l for l in logs if l.severity == "high"]),
                    "warning": len([l for l in logs if l.severity == "warning"]),
                    "success": len([l for l in logs if l.severity == "success"]),
                    "info": len([l for l in logs if l.severity == "info"])
                }
            }


# Global singleton instance
_log_manager = None
_lock = threading.Lock()


def get_log_manager() -> LogManager:
    """Get or create the global log manager instance"""
    global _log_manager
    
    if _log_manager is None:
        with _lock:
            if _log_manager is None:
                _log_manager = LogManager()
    
    return _log_manager


# Convenience functions
def log_signal(message: str, severity: str = "info", **metadata):
    """Log a signal detection event"""
    return get_log_manager().add_log("signal", message, severity, metadata)


def log_execution(message: str, severity: str = "success", **metadata):
    """Log a trade execution event"""
    return get_log_manager().add_log("execution", message, severity, metadata)


def log_analysis(message: str, severity: str = "info", **metadata):
    """Log an AI analysis event"""
    return get_log_manager().add_log("analysis", message, severity, metadata)


def log_routing(message: str, severity: str = "info", **metadata):
    """Log a cross-chain routing event"""
    return get_log_manager().add_log("routing", message, severity, metadata)


def log_monitor(message: str, severity: str = "info", **metadata):
    """Log a monitoring event"""
    return get_log_manager().add_log("monitor", message, severity, metadata)
