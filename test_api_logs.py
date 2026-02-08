"""Test if API logs are working"""

import time
import requests
from agent.log_manager import log_signal, log_execution, log_analysis, log_monitor

print("🧪 Testing log system...")

# Add some logs
log_monitor("System started")
log_signal("Test signal detected")
log_analysis("Running AI analysis")
log_execution("Trade executed successfully")

time.sleep(1)

# Check via API (assumes API server is running)
try:
    response = requests.get("http://localhost:8000/logs?limit=10")
    if response.status_code == 200:
        data = response.json()
        logs = data.get('logs', [])
        print(f"\n✅ API returned {len(logs)} logs:")
        for log in logs[:5]:
            print(f"  - [{log['type']}] {log['message']}")
    else:
        print(f"❌ API error: {response.status_code}")
except Exception as e:
    print(f"❌ Failed to connect to API: {e}")
