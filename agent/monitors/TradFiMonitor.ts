/**
 * TradFi Monitor
 * Monitors traditional finance signals that correlate to crypto assets
 * - Yahoo Finance earnings data
 * - SEC Form 4 insider trading filings
 * - Maps stock tickers to correlated crypto tokens
 */

import axios, { AxiosInstance } from 'axios';
import { BaseMonitor } from './OnChainMonitor';
import { Signal, SignalType, MonitorConfig } from './types';

interface EarningsData {
  ticker: string;
  quarter: string;
  reportDate: string;
  epsActual: number;
  epsEstimate: number;
  revenueActual: number;
  revenueEstimate: number;
}

interface InsiderTransaction {
  ticker: string;
  filingDate: string;
  insider: string;
  title: string;
  transactionType: 'BUY' | 'SELL';
  shares: number;
  pricePerShare: number;
  totalValue: number;
}

interface StockCryptoMapping {
  ticker: string;
  cryptoTokens: Array<{
    symbol: string;
    chain: string;
    address: string;
    correlationStrength: number; // 0-100
  }>;
}

export class TradFiMonitor extends BaseMonitor {
  private httpClient: AxiosInstance;
  private secClient: AxiosInstance;
  
  // Stock ticker to crypto token mappings
  private readonly TICKER_MAPPINGS: StockCryptoMapping[] = [
    {
      ticker: 'NVDA',
      cryptoTokens: [
        { symbol: 'RENDER', chain: 'ethereum', address: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', correlationStrength: 85 },
        { symbol: 'FET', chain: 'ethereum', address: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85', correlationStrength: 80 },
        { symbol: 'TAO', chain: 'ethereum', address: '0x77E06c9eCCf2E797fd462A92B6D7642EF85b0A44', correlationStrength: 75 },
        { symbol: 'OCEAN', chain: 'ethereum', address: '0x967da4048cD07aB37855c090aAF366e4ce1b9F48', correlationStrength: 70 },
      ]
    },
    {
      ticker: 'COIN',
      cryptoTokens: [
        { symbol: 'BTC', chain: 'ethereum', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', correlationStrength: 95 }, // WBTC
        { symbol: 'ETH', chain: 'ethereum', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', correlationStrength: 90 }, // WETH
      ]
    },
    {
      ticker: 'MSTR',
      cryptoTokens: [
        { symbol: 'BTC', chain: 'ethereum', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', correlationStrength: 98 }, // WBTC
      ]
    },
    {
      ticker: 'TSLA',
      cryptoTokens: [
        { symbol: 'DOGE', chain: 'ethereum', address: '0x4206931337dc273a630d328dA6441786BfaD668f', correlationStrength: 65 },
      ]
    },
    {
      ticker: 'META',
      cryptoTokens: [
        { symbol: 'MASK', chain: 'ethereum', address: '0x69af81e73A73B40adF4f3d4223Cd9b1ECE623074', correlationStrength: 60 },
      ]
    },
  ];

  // Track insider transactions for pattern detection
  private recentTransactions: Map<string, InsiderTransaction[]> = new Map();

  constructor(config: MonitorConfig) {
    super(config);
    
    // Standard HTTP client for Yahoo Finance
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    // SEC-specific client with required User-Agent
    this.secClient = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'NEXUS Shorting Agent contact@nexus.io', // SEC requires contact info
        'Accept': 'application/json',
      }
    });
  }

  async scan(): Promise<Signal[]> {
    if (!this.isEnabled()) return [];

    const signals: Signal[] = [];

    try {
      // Scan all tracked tickers
      for (const mapping of this.TICKER_MAPPINGS) {
        // Check earnings data
        const earningsSignals = await this.checkEarnings(mapping);
        signals.push(...earningsSignals);

        // Check SEC Form 4 insider trading
        const insiderSignals = await this.checkInsiderTrading(mapping);
        signals.push(...insiderSignals);
      }
    } catch (error) {
      console.error('[TradFiMonitor] Scan error:', error);
      // Continue gracefully - don't throw
    }

    return signals;
  }

  /**
   * Check earnings data from Yahoo Finance
   */
  private async checkEarnings(mapping: StockCryptoMapping): Promise<Signal[]> {
    const signals: Signal[] = [];
    const cacheKey = `earnings_${mapping.ticker}`;

    try {
      // Check cache first
      let earningsData = this.getCached<EarningsData>(cacheKey);

      if (!earningsData) {
        // Fetch from Yahoo Finance
        earningsData = await this.fetchEarningsData(mapping.ticker);
        if (earningsData) {
          this.setCached(cacheKey, earningsData);
        }
      }

      if (!earningsData) return signals;

      // Calculate misses
      const epsMissPercent = ((earningsData.epsEstimate - earningsData.epsActual) / earningsData.epsEstimate) * 100;
      const revenueMissPercent = ((earningsData.revenueEstimate - earningsData.revenueActual) / earningsData.revenueEstimate) * 100;

      // Check for EPS miss > 10%
      if (epsMissPercent > 10) {
        for (const token of mapping.cryptoTokens) {
          signals.push({
            type: SignalType.EARNINGS_MISS,
            token: token.address,
            chain: token.chain,
            score: Math.min(epsMissPercent * token.correlationStrength / 100, 100),
            metadata: {
              ticker: mapping.ticker,
              cryptoSymbol: token.symbol,
              epsMissPercent: epsMissPercent.toFixed(2),
              epsActual: earningsData.epsActual,
              epsEstimate: earningsData.epsEstimate,
              quarter: earningsData.quarter,
              reportDate: earningsData.reportDate,
              correlationStrength: token.correlationStrength,
            },
            timestamp: Date.now(),
            source: 'TradFiMonitor',
          });
        }
      }

      // Check for Revenue miss > 5%
      if (revenueMissPercent > 5) {
        for (const token of mapping.cryptoTokens) {
          signals.push({
            type: SignalType.REVENUE_MISS,
            token: token.address,
            chain: token.chain,
            score: Math.min(revenueMissPercent * 1.5 * token.correlationStrength / 100, 100),
            metadata: {
              ticker: mapping.ticker,
              cryptoSymbol: token.symbol,
              revenueMissPercent: revenueMissPercent.toFixed(2),
              revenueActual: earningsData.revenueActual,
              revenueEstimate: earningsData.revenueEstimate,
              quarter: earningsData.quarter,
              reportDate: earningsData.reportDate,
              correlationStrength: token.correlationStrength,
            },
            timestamp: Date.now(),
            source: 'TradFiMonitor',
          });
        }
      }

    } catch (error) {
      console.error(`[TradFiMonitor] Error checking earnings for ${mapping.ticker}:`, error);
      // Continue to next ticker
    }

    return signals;
  }

  /**
   * Check SEC Form 4 insider trading filings
   */
  private async checkInsiderTrading(mapping: StockCryptoMapping): Promise<Signal[]> {
    const signals: Signal[] = [];
    const cacheKey = `insider_${mapping.ticker}`;

    try {
      // Check cache first
      let transactions = this.getCached<InsiderTransaction[]>(cacheKey);

      if (!transactions) {
        // Fetch from SEC EDGAR
        transactions = await this.fetchInsiderTradings(mapping.ticker);
        if (transactions) {
          this.setCached(cacheKey, transactions);
        }
      }

      if (!transactions || transactions.length === 0) return signals;

      // Store for pattern detection
      this.recentTransactions.set(mapping.ticker, transactions);

      // Check for large single insider sells
      const largeInsiderSells = this.detectLargeInsiderSells(transactions);
      
      // Check for multiple insiders selling within 7 days
      const coordinatedSells = this.detectCoordinatedSells(transactions);

      if (largeInsiderSells.length > 0 || coordinatedSells) {
        for (const token of mapping.cryptoTokens) {
          let score = 0;
          const metadata: any = {
            ticker: mapping.ticker,
            cryptoSymbol: token.symbol,
            correlationStrength: token.correlationStrength,
            insiderTransactions: [],
          };

          // Score large sells
          if (largeInsiderSells.length > 0) {
            score += largeInsiderSells.length * 20;
            metadata.largeInsiderSells = largeInsiderSells.map(t => ({
              insider: t.insider,
              title: t.title,
              totalValue: t.totalValue,
              filingDate: t.filingDate,
            }));
          }

          // Score coordinated sells
          if (coordinatedSells) {
            score += 30;
            metadata.coordinatedSelling = true;
            metadata.sellersCount = transactions.filter(t => t.transactionType === 'SELL').length;
          }

          // Apply correlation strength
          score = Math.min(score * token.correlationStrength / 100, 100);

          if (score > 0) {
            signals.push({
              type: SignalType.INSIDER_SELLING_SEC,
              token: token.address,
              chain: token.chain,
              score,
              metadata,
              timestamp: Date.now(),
              source: 'TradFiMonitor',
            });
          }
        }
      }

    } catch (error) {
      console.error(`[TradFiMonitor] Error checking insider trading for ${mapping.ticker}:`, error);
      // Continue to next ticker
    }

    return signals;
  }

  /**
   * Fetch earnings data from Yahoo Finance API
   */
  private async fetchEarningsData(ticker: string): Promise<EarningsData | null> {
    try {
      // Yahoo Finance API endpoint (using yfinance or similar)
      // Note: You may need to use a paid API or scrape Yahoo Finance
      const response = await this.httpClient.get(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}`,
        {
          params: {
            modules: 'earnings,earningsHistory',
          }
        }
      );

      if (!response.data?.quoteSummary?.result?.[0]?.earnings) {
        return null;
      }

      const earnings = response.data.quoteSummary.result[0].earnings;
      const earningsHistory = response.data.quoteSummary.result[0].earningsHistory;

      // Get most recent quarter
      const latestEarnings = earningsHistory?.history?.[0];
      if (!latestEarnings) return null;

      return {
        ticker,
        quarter: latestEarnings.quarter,
        reportDate: latestEarnings.date || new Date().toISOString(),
        epsActual: latestEarnings.epsActual?.raw || 0,
        epsEstimate: latestEarnings.epsEstimate?.raw || 0,
        revenueActual: earnings.financialsChart?.yearly?.[0]?.revenue?.raw || 0,
        revenueEstimate: earnings.financialsChart?.yearly?.[0]?.revenue?.raw || 0, // Estimate not always available
      };

    } catch (error) {
      console.error(`[TradFiMonitor] Error fetching earnings for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Fetch insider trading data from SEC EDGAR
   */
  private async fetchInsiderTradings(ticker: string): Promise<InsiderTransaction[]> {
    try {
      // First, get CIK (Central Index Key) for the ticker
      const cik = await this.getCIK(ticker);
      if (!cik) return [];

      // Fetch recent Form 4 filings (insider transactions)
      const response = await this.secClient.get(
        `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`
      );

      if (!response.data?.filings?.recent) return [];

      const filings = response.data.filings.recent;
      const transactions: InsiderTransaction[] = [];

      // Filter Form 4 filings from last 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < filings.form.length; i++) {
        if (filings.form[i] !== '4') continue;

        const filingDate = new Date(filings.filingDate[i]).getTime();
        if (filingDate < thirtyDaysAgo) continue;

        // Parse Form 4 for transaction details
        // Note: This is simplified - actual Form 4 parsing is complex
        const accessionNumber = filings.accessionNumber[i];
        const transactionData = await this.parseForm4(cik, accessionNumber);
        
        if (transactionData && transactionData.insider && transactionData.title && transactionData.transactionType) {
          transactions.push({
            ticker,
            filingDate: filings.filingDate[i],
            insider: transactionData.insider,
            title: transactionData.title,
            transactionType: transactionData.transactionType,
            shares: transactionData.shares || 0,
            pricePerShare: transactionData.pricePerShare || 0,
            totalValue: (transactionData.shares || 0) * (transactionData.pricePerShare || 0),
          });
        }
      }

      return transactions;

    } catch (error) {
      console.error(`[TradFiMonitor] Error fetching insider trading for ${ticker}:`, error);
      return [];
    }
  }

  /**
   * Get CIK (Central Index Key) for a stock ticker
   */
  private async getCIK(ticker: string): Promise<string | null> {
    const cacheKey = `cik_${ticker}`;
    let cik = this.getCached<string>(cacheKey);

    if (cik) return cik;

    try {
      // SEC provides a ticker to CIK mapping
      const response = await this.secClient.get(
        'https://www.sec.gov/files/company_tickers.json'
      );

      const companies = Object.values(response.data) as any[];
      const company = companies.find(c => c.ticker === ticker);

      if (company) {
        cik = company.cik_str.toString();
        this.setCached(cacheKey, cik);
        return cik;
      }

      return null;

    } catch (error) {
      console.error(`[TradFiMonitor] Error fetching CIK for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Parse Form 4 filing for transaction details
   * Simplified version - real implementation needs XML parsing
   */
  private async parseForm4(cik: string, accessionNumber: string): Promise<Partial<InsiderTransaction> | null> {
    try {
      // Form 4 filings are in XML format
      const cleanAccession = accessionNumber.replace(/-/g, '');
      const url = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${cik}&accession_number=${accessionNumber}&xbrl_type=v`;

      // This is a simplified mock - real implementation needs XML parsing
      // For production, use a library like 'fast-xml-parser'
      
      // Mock data for demonstration
      return {
        insider: 'John Doe',
        title: 'CEO',
        transactionType: Math.random() > 0.5 ? 'SELL' : 'BUY',
        shares: Math.floor(Math.random() * 100000),
        pricePerShare: Math.random() * 200,
        totalValue: 0, // Will be calculated below
      };

    } catch (error) {
      console.error('[TradFiMonitor] Error parsing Form 4:', error);
      return null;
    }
  }

  /**
   * Detect large insider sells (CEO/CFO > $5M)
   */
  private detectLargeInsiderSells(transactions: InsiderTransaction[]): InsiderTransaction[] {
    return transactions.filter(t => {
      const isCLevel = t.title.match(/CEO|CFO|Chief/i);
      const isLargeSell = t.transactionType === 'SELL' && t.totalValue > 5_000_000;
      return isCLevel && isLargeSell;
    });
  }

  /**
   * Detect coordinated selling (multiple insiders within 7 days)
   */
  private detectCoordinatedSells(transactions: InsiderTransaction[]): boolean {
    const sells = transactions.filter(t => t.transactionType === 'SELL');
    if (sells.length < 2) return false;

    // Check if multiple sells within 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSells = sells.filter(s => new Date(s.filingDate).getTime() > sevenDaysAgo);

    return recentSells.length >= 2;
  }

  /**
   * Get all tracked tickers
   */
  getTrackedTickers(): string[] {
    return this.TICKER_MAPPINGS.map(m => m.ticker);
  }

  /**
   * Get crypto tokens for a specific ticker
   */
  getCryptoTokensForTicker(ticker: string): StockCryptoMapping | undefined {
    return this.TICKER_MAPPINGS.find(m => m.ticker === ticker);
  }

  /**
   * Add custom ticker mapping
   */
  addTickerMapping(mapping: StockCryptoMapping): void {
    const existing = this.TICKER_MAPPINGS.findIndex(m => m.ticker === mapping.ticker);
    if (existing >= 0) {
      this.TICKER_MAPPINGS[existing] = mapping;
    } else {
      this.TICKER_MAPPINGS.push(mapping);
    }
  }
}
