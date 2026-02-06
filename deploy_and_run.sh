#!/bin/bash

# ========================================
# NEXUS Deployment and Launch Script
# ========================================

set -e  # Exit on error

echo "========================================="
echo "🚀 NEXUS Deployment and Launch"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env file with your configuration"
    exit 1
fi

# Load environment
export $(cat .env | grep -v '^#' | xargs)

# ----------------------------------------
# STEP 1: Install Dependencies
# ----------------------------------------
echo -e "${BLUE}📦 Step 1: Installing dependencies...${NC}"

# Node.js dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js packages..."
    npm install
else
    echo "✅ Node.js packages already installed"
fi

# Python dependencies
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing Python packages..."
pip install -q --upgrade pip
pip install -q -r agent/requirements.txt
pip install -q -r x_scrapper/requirements.txt

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ----------------------------------------
# STEP 2: Compile Smart Contracts
# ----------------------------------------
echo -e "${BLUE}🔨 Step 2: Compiling smart contracts...${NC}"
npx hardhat compile

echo -e "${GREEN}✅ Contracts compiled${NC}"
echo ""

# ----------------------------------------
# STEP 3: Deploy Contracts (if not already deployed)
# ----------------------------------------
echo -e "${BLUE}📡 Step 3: Checking contract deployment...${NC}"

if [ -z "$NEXUS_VAULT_ADDRESS" ]; then
    echo -e "${YELLOW}⚠️  Contracts not deployed yet${NC}"
    echo ""
    read -p "Deploy to Arbitrum mainnet? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deploying contracts to Arbitrum..."
        npx hardhat deploy --network arbitrum
        
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Update .env with deployed addresses!${NC}"
        echo "The deployment script output contains the addresses."
        echo "Add them to your .env file:"
        echo "  NEXUS_VAULT_ADDRESS=0x..."
        echo "  SIGNAL_ORACLE_ADDRESS=0x..."
        echo "  POSITION_REGISTRY_ADDRESS=0x..."
        echo ""
        read -p "Press Enter after updating .env file..."
        
        # Reload environment
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo "Skipping deployment. Using testnet/local setup."
    fi
else
    echo -e "${GREEN}✅ Contracts already deployed${NC}"
    echo "   NexusVault: $NEXUS_VAULT_ADDRESS"
    echo "   SignalOracle: $SIGNAL_ORACLE_ADDRESS"
    echo "   PositionRegistry: $POSITION_REGISTRY_ADDRESS"
fi

echo ""

# ----------------------------------------
# STEP 4: Setup Database
# ----------------------------------------
echo -e "${BLUE}🗄️  Step 4: Setting up database...${NC}"

# Create data directory
mkdir -p data logs

# Initialize database if needed
if [ ! -f "$DATABASE_PATH" ]; then
    echo "Creating database..."
    python3 create_sample_db.py
fi

echo -e "${GREEN}✅ Database ready${NC}"
echo ""

# ----------------------------------------
# STEP 5: Start Services
# ----------------------------------------
echo -e "${BLUE}🎬 Step 5: Starting NEXUS services...${NC}"
echo ""

# Create screen/tmux sessions for each service
read -p "Start all services? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if tmux is available
    if command -v tmux &> /dev/null; then
        echo "Starting services in tmux sessions..."
        
        # Create tmux session for Next.js app
        tmux new-session -d -s nexus-web "npm run dev"
        echo "✅ Web app started (tmux session: nexus-web)"
        
        # Create tmux session for strategy loop
        tmux new-session -d -s nexus-agent "source .venv/bin/activate && python3 agent/strategy_loop.py"
        echo "✅ AI agent started (tmux session: nexus-agent)"
        
        # Create tmux session for scraper (optional)
        read -p "Start Twitter scraper? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            tmux new-session -d -s nexus-scraper "source .venv/bin/activate && cd x_scrapper && python3 scrape_crypto_fast.py"
            echo "✅ Scraper started (tmux session: nexus-scraper)"
        fi
        
        echo ""
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo -e "${GREEN}🎉 NEXUS is now running!${NC}"
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo ""
        echo "Services:"
        echo "  • Web App:    http://localhost:3000"
        echo "  • AI Agent:   Running in background"
        echo "  • Database:   $DATABASE_PATH"
        echo ""
        echo "Tmux sessions:"
        echo "  • nexus-web:     tmux attach -t nexus-web"
        echo "  • nexus-agent:   tmux attach -t nexus-agent"
        echo "  • nexus-scraper: tmux attach -t nexus-scraper"
        echo ""
        echo "To view logs:"
        echo "  • Agent logs: tail -f logs/nexus.log"
        echo ""
        echo "To stop all services:"
        echo "  • tmux kill-session -t nexus-web"
        echo "  • tmux kill-session -t nexus-agent"
        echo "  • tmux kill-session -t nexus-scraper"
        echo ""
        
    else
        echo -e "${YELLOW}⚠️  tmux not found. Starting services manually...${NC}"
        echo ""
        echo "Terminal 1 - Web App:"
        echo "  npm run dev"
        echo ""
        echo "Terminal 2 - AI Agent:"
        echo "  source .venv/bin/activate"
        echo "  python3 agent/strategy_loop.py"
        echo ""
        echo "Terminal 3 - Scraper (optional):"
        echo "  source .venv/bin/activate"
        echo "  cd x_scrapper && python3 scrape_crypto_fast.py"
        echo ""
    fi
else
    echo "Services not started. You can start them manually:"
    echo ""
    echo "1. Web App:"
    echo "   npm run dev"
    echo ""
    echo "2. AI Agent:"
    echo "   source .venv/bin/activate"
    echo "   python3 agent/strategy_loop.py"
    echo ""
    echo "3. Scraper (optional):"
    echo "   source .venv/bin/activate"
    echo "   cd x_scrapper && python3 scrape_crypto_fast.py"
    echo ""
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
