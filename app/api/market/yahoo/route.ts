import { NextResponse } from 'next/server';

const TICKERS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AAPL', 'TSLA', 'NVDA', 'META', 'GOOGL'];

async function fetchYahooData(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
  const params = new URLSearchParams({
    interval: '1d',
    range: '1d'
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
      const result = data.chart.result[0];
      const meta = result.meta || {};
      const quotes = result.indicators?.quote?.[0] || {};
      
      const currentPrice = meta.regularMarketPrice || 0;
      const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      
      // Get latest volume
      const volumes = quotes.volume || [];
      const latestVolume = volumes[volumes.length - 1] || 0;

      return {
        ticker,
        symbol: ticker,
        price: parseFloat(currentPrice.toFixed(2)),
        previousClose: parseFloat(previousClose.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        volume: latestVolume,
        currency: meta.currency || 'USD',
        timestamp: new Date().toISOString()
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    // Fetch all tickers in parallel
    const promises = TICKERS.map(ticker => fetchYahooData(ticker));
    const results = await Promise.all(promises);
    
    // Filter out nulls and add IDs
    const signals = results
      .filter(result => result !== null)
      .map((result, index) => ({
        id: index + 1,
        ...result
      }));

    return NextResponse.json({ signals }, { status: 200 });
  } catch (error) {
    console.error('Error fetching Yahoo Finance data:', error);
    return NextResponse.json({ signals: [] }, { status: 200 });
  }
}
