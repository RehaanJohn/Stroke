import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Open database connection
async function openDb() {
  const dbPath = path.join(process.cwd(), 'x_scrapper', 'crypto_tweets.db');
  console.log('Database path:', dbPath);
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const db = await openDb();
    
    // Get diverse crypto-related tweets - one per account, sorted by most recent
    const tweets = await db.all(
      `SELECT t1.* FROM tweets t1
       INNER JOIN (
         SELECT username, MAX(id) as max_id
         FROM tweets
         WHERE is_crypto = 1
         GROUP BY username
       ) t2 ON t1.username = t2.username AND t1.id = t2.max_id
       ORDER BY t1.scraped_at DESC
       LIMIT ?`,
      [limit]
    );
    
    await db.close();
    
    return NextResponse.json({
      success: true,
      count: tweets.length,
      tweets: tweets.map(tweet => ({
        id: tweet.id,
        username: tweet.username,
        text: tweet.text,
        time: tweet.time,
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        scrapedAt: tweet.scraped_at
      }))
    });
  } catch (error) {
    console.error('Error fetching tweets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch tweets',
        tweets: []
      },
      { status: 500 }
    );
  }
}
