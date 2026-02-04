#!/usr/bin/env python3
"""
Comprehensive System Check
Verifies all components are working properly
"""

import os
import sys
import subprocess
from pathlib import Path

print("="*80)
print("NEXUS AGENT - COMPREHENSIVE SYSTEM CHECK")
print("="*80)
print()

# Track overall status
all_checks_passed = True
results = []

def check_item(name, passed, details=""):
    """Record check result"""
    global all_checks_passed
    results.append({
        'name': name,
        'passed': passed,
        'details': details
    })
    if not passed:
        all_checks_passed = False
    return passed

# 1. Check Python Environment
print("1. Checking Python Environment...")
print("-"*80)
try:
    import platform
    python_version = platform.python_version()
    print(f"   Python Version: {python_version}")
    check_item("Python Installation", True, python_version)
except Exception as e:
    print(f"   ❌ Error: {e}")
    check_item("Python Installation", False, str(e))

# 2. Check Python Dependencies
print("\n2. Checking Python Dependencies...")
print("-"*80)
required_packages = [
    'fastapi', 'uvicorn', 'pydantic', 'python-dotenv',
    'aiohttp', 'numpy', 'pandas', 'loguru'
]

missing_packages = []
for package in required_packages:
    try:
        __import__(package.replace('-', '_'))
        print(f"   ✅ {package}")
    except ImportError:
        print(f"   ❌ {package} - NOT INSTALLED")
        missing_packages.append(package)

if missing_packages:
    check_item("Python Dependencies", False, f"Missing: {', '.join(missing_packages)}")
else:
    check_item("Python Dependencies", True, f"{len(required_packages)} packages installed")

# 3. Check Environment Variables
print("\n3. Checking Environment Variables...")
print("-"*80)
from dotenv import load_dotenv
load_dotenv()

env_vars = {
    'HUGGING_FACE_TOKEN': os.getenv('HUGGING_FACE_TOKEN'),
    'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
    'AGENT_TIER1_MOCK': os.getenv('AGENT_TIER1_MOCK', 'true'),
    'AGENT_TIER2_MOCK': os.getenv('AGENT_TIER2_MOCK', 'true'),
}

for key, value in env_vars.items():
    if value:
        display_value = f"{value[:10]}...{value[-5:]}" if len(value) > 20 else value
        print(f"   ✅ {key}: {display_value}")
    else:
        print(f"   ⚠️  {key}: Not set")

hf_token = env_vars.get('HUGGING_FACE_TOKEN')
check_item("HuggingFace Token", bool(hf_token and hf_token.strip()), "Configured" if hf_token else "Missing")

# 4. Check Agent Components
print("\n4. Checking Agent Components...")
print("-"*80)
agent_files = [
    'agent/data_ingestion.py',
    'agent/local_llm_screener.py',
    'agent/claude_analyzer.py',
    'agent/orchestration.py',
    'agent/api_server.py',
]

for file_path in agent_files:
    exists = os.path.exists(file_path)
    status = "✅" if exists else "❌"
    print(f"   {status} {file_path}")

all_exist = all(os.path.exists(f) for f in agent_files)
check_item("Agent Components", all_exist, f"{len(agent_files)} files")

# 5. Check TypeScript Monitor
print("\n5. Checking TypeScript Monitor...")
print("-"*80)
monitor_files = [
    'agent/monitors/types.ts',
    'agent/monitors/OnChainMonitor.ts',
    'agent/monitors/TradFiMonitor.ts',
    'agent/monitors/example.ts',
    'agent/monitors/index.ts',
]

for file_path in monitor_files:
    exists = os.path.exists(file_path)
    status = "✅" if exists else "❌"
    print(f"   {status} {file_path}")

all_exist = all(os.path.exists(f) for f in monitor_files)
check_item("TypeScript Monitors", all_exist, f"{len(monitor_files)} files")

# 6. Check Compiled JavaScript
print("\n6. Checking Compiled JavaScript...")
print("-"*80)
dist_path = Path('dist/agent/monitors')
if dist_path.exists():
    js_files = list(dist_path.glob('*.js'))
    d_ts_files = list(dist_path.glob('*.d.ts'))
    print(f"   ✅ JavaScript files: {len(js_files)}")
    print(f"   ✅ Type definitions: {len(d_ts_files)}")
    for js in js_files:
        print(f"      - {js.name}")
    check_item("Compiled JavaScript", len(js_files) > 0, f"{len(js_files)} files")
else:
    print(f"   ❌ dist/agent/monitors not found")
    check_item("Compiled JavaScript", False, "Not compiled")

# 7. Check Node.js & npm
print("\n7. Checking Node.js Environment...")
print("-"*80)
try:
    node_version = subprocess.run(['node', '--version'], capture_output=True, text=True)
    if node_version.returncode == 0:
        print(f"   ✅ Node.js: {node_version.stdout.strip()}")
        check_item("Node.js", True, node_version.stdout.strip())
    else:
        print(f"   ❌ Node.js not found")
        check_item("Node.js", False, "Not installed")
        
    npm_version = subprocess.run(['npm', '--version'], capture_output=True, text=True)
    if npm_version.returncode == 0:
        print(f"   ✅ npm: {npm_version.stdout.strip()}")
    else:
        print(f"   ⚠️  npm not found")
except Exception as e:
    print(f"   ❌ Error checking Node.js: {e}")
    check_item("Node.js", False, str(e))

# 8. Check Next.js Frontend
print("\n8. Checking Next.js Frontend...")
print("-"*80)
frontend_files = [
    'app/page.tsx',
    'app/layout.tsx',
    'app/providers.tsx',
    'app/portfolio/page.tsx',
    'package.json',
    'next.config.ts',
]

for file_path in frontend_files:
    exists = os.path.exists(file_path)
    status = "✅" if exists else "❌"
    print(f"   {status} {file_path}")

all_exist = all(os.path.exists(f) for f in frontend_files)
check_item("Next.js Frontend", all_exist, f"{len(frontend_files)} files")

# 9. Check Test Scripts
print("\n9. Checking Test Scripts...")
print("-"*80)
test_files = [
    'test_agent.py',
    'test_tier1.py',
    'test_api_endpoints.py',
]

for file_path in test_files:
    exists = os.path.exists(file_path)
    status = "✅" if exists else "❌"
    print(f"   {status} {file_path}")

all_exist = all(os.path.exists(f) for f in test_files)
check_item("Test Scripts", all_exist, f"{len(test_files)} files")

# 10. Quick Tier 1 Test
print("\n10. Running Quick Tier 1 Test...")
print("-"*80)
try:
    from agent.data_ingestion import DataIngestion
    from agent.local_llm_screener import LocalLLMScreener
    
    data = DataIngestion()
    signals = data.generate_batch(size=10, rug_pull_ratio=0.2)
    
    screener = LocalLLMScreener(mock_mode=True)
    flagged = screener.screen_batch(signals)
    
    print(f"   ✅ Generated {len(signals)} signals")
    print(f"   ✅ Flagged {len(flagged)} suspicious tokens")
    check_item("Tier 1 Functionality", True, f"{len(flagged)}/{len(signals)} flagged")
except Exception as e:
    print(f"   ❌ Error: {e}")
    check_item("Tier 1 Functionality", False, str(e))

# Summary
print("\n" + "="*80)
print("SYSTEM CHECK SUMMARY")
print("="*80)
print()

for result in results:
    status = "✅ PASSED" if result['passed'] else "❌ FAILED"
    details = f" - {result['details']}" if result['details'] else ""
    print(f"  {result['name']:30} {status}{details}")

print()
print("="*80)

if all_checks_passed:
    print("✅ ALL CHECKS PASSED - System is operational!")
    print()
    print("Ready to:")
    print("  1. Run full agent: python test_agent.py")
    print("  2. Test Tier 1: python test_tier1.py")
    print("  3. Test APIs: python test_api_endpoints.py")
    print("  4. Start Next.js: npm run dev")
else:
    print("⚠️  SOME CHECKS FAILED - Review errors above")
    print()
    print("Common fixes:")
    print("  - Python deps: pip install -r agent/requirements.txt")
    print("  - Node deps: npm install")
    print("  - Compile TS: cd agent/monitors && npx tsc")

print("="*80)

sys.exit(0 if all_checks_passed else 1)
