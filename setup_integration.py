#!/usr/bin/env python3
"""
Quick setup script for x_scrapper integration
Installs dependencies and verifies installation
"""

import subprocess
import sys
from pathlib import Path

def run_command(cmd, description, cwd=None):
    """Run a shell command and show progress"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            cwd=cwd
        )
        
        if result.returncode == 0:
            print(f"✅ SUCCESS")
            if result.stdout:
                # Show last 5 lines
                lines = result.stdout.strip().split('\n')
                for line in lines[-5:]:
                    print(f"   {line}")
            return True
        else:
            print(f"❌ FAILED (exit code {result.returncode})")
            if result.stderr:
                print(result.stderr[:500])
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def check_file_exists(path, description):
    """Check if a file exists"""
    exists = Path(path).exists()
    status = "✅" if exists else "❌"
    print(f"{status} {description}: {path}")
    return exists

def main():
    print("\n" + "#"*60)
    print("X_SCRAPPER INTEGRATION SETUP")
    print("#"*60 + "\n")
    
    project_root = Path(__file__).parent
    x_scrapper_path = project_root / 'x_scrapper'
    
    # Step 1: Check x_scrapper directory
    print("📁 Checking directories...")
    if not check_file_exists(x_scrapper_path, "x_scrapper directory"):
        print("\n❌ x_scrapper directory not found!")
        print("   Please clone it first:")
        print("   git clone https://github.com/jonathanvineet/x_scrapper.git")
        return False
    
    check_file_exists(x_scrapper_path / 'scrape_crypto_fast.py', "Main scraper")
    check_file_exists(x_scrapper_path / 'requirements.txt', "Requirements file")
    print()
    
    # Step 2: Install x_scrapper dependencies
    requirements_file = x_scrapper_path / 'requirements.txt'
    if requirements_file.exists():
        response = input("Install x_scrapper dependencies? (y/n): ").strip().lower()
        if response == 'y':
            success = run_command(
                f"pip install -r {requirements_file}",
                "Installing x_scrapper dependencies",
                cwd=str(x_scrapper_path)
            )
            if not success:
                print("\n⚠️  Warning: Dependency installation had issues")
    
    # Step 3: Check agent dependencies
    print("\n" + "="*60)
    print("🔧 Checking agent dependencies")
    print("="*60 + "\n")
    
    # Check if key packages are installed
    packages_to_check = [
        'transformers',
        'torch',
        'yfinance',
        'sqlite3',
        'selenium'
    ]
    
    for package in packages_to_check:
        try:
            if package == 'sqlite3':
                import sqlite3
            else:
                __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} (not installed)")
    
    # Step 4: Verify agent files
    print("\n" + "="*60)
    print("📁 Checking agent files")
    print("="*60 + "\n")
    
    check_file_exists(project_root / 'agent' / 'social_monitor.py', "SocialMonitor")
    check_file_exists(project_root / 'agent' / 'orchestration.py', "Orchestration")
    check_file_exists(project_root / 'agent' / 'local_llm_screener.py', "Tier 1 Screener")
    check_file_exists(project_root / 'test_scraper_agent_integration.py', "Integration test")
    check_file_exists(project_root / 'test_full_orchestration.py', "Orchestration test")
    
    # Step 5: Check for database
    print("\n" + "="*60)
    print("💾 Checking database")
    print("="*60 + "\n")
    
    db_path = x_scrapper_path / 'crypto_tweets.db'
    has_db = check_file_exists(db_path, "Tweet database")
    
    if not has_db:
        print("\n⚠️  No database found. Run scraper to create it:")
        print(f"   cd {x_scrapper_path}")
        print("   python scrape_crypto_fast.py")
    else:
        # Check database size
        import sqlite3
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM tweets")
            count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM tweets WHERE is_crypto = 1")
            crypto_count = cursor.fetchone()[0]
            conn.close()
            
            print(f"\n   📊 Database stats:")
            print(f"      Total tweets: {count:,}")
            print(f"      Crypto tweets: {crypto_count:,}")
        except Exception as e:
            print(f"   ⚠️  Could not read database: {e}")
    
    # Step 6: Summary
    print("\n" + "#"*60)
    print("SETUP SUMMARY")
    print("#"*60 + "\n")
    
    print("✅ Setup complete! Next steps:\n")
    
    if not has_db:
        print("1. Run the scraper to collect tweets:")
        print(f"   cd {x_scrapper_path}")
        print("   python scrape_crypto_fast.py\n")
    
    print("2. Test the social monitor:")
    print("   python -m agent.social_monitor\n")
    
    print("3. Run integration test:")
    print("   python test_scraper_agent_integration.py\n")
    
    print("4. Run full orchestration:")
    print("   python test_full_orchestration.py\n")
    
    print("5. Enable production mode:")
    print("   - Set AGENT_TIER1_MOCK=false in .env")
    print("   - Add ANTHROPIC_API_KEY for Tier 2\n")
    
    print("#"*60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted")
    except Exception as e:
        print(f"\n❌ Setup error: {e}")
        import traceback
        traceback.print_exc()
