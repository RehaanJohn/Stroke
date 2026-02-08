#!/usr/bin/env python3
"""
Test if logging system works
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / 'agent'))

from agent.log_manager import log_signal, log_execution, log_analysis, log_monitor, get_log_manager

print("Testing log system...")

# Add test logs
log_monitor("System started", severity="info")
log_signal("Test signal detected for BTC", severity="high")
log_analysis("AI analysis in progress...", severity="info")
log_execution("Trade executed successfully", severity="success")
log_signal("Critical market movement detected!", severity="critical")

# Get all logs
manager = get_log_manager()
all_logs = manager.get_logs()

print(f"\n✅ Total logs stored: {len(all_logs)}")
print(f"📊 Stats: {manager.get_stats()}")

print("\n📝 Recent logs:")
for log in all_logs[:5]:
    print(f"  - [{log['type']}] {log['message']}")

print("\n✅ Logging system working!")
