import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'x_scrapper', 'crypto_tweets.db');
    
    // Open database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Get the 20 most recent tweets
    const tweets = await db.all(`
      SELECT username, text, time, likes, retweets, replies 
      FROM tweets 
      ORDER BY id DESC 
      LIMIT 20
    `);

    await db.close();

    // Format the response
    const formattedTweets = tweets.map((tweet, index) => ({
      id: String(index + 1),
      username: tweet.username,
      text: tweet.text,
      time: tweet.time,
      likes: parseInt(tweet.likes) || 0,
      retweets: parseInt(tweet.retweets) || 0,
      replies: parseInt(tweet.replies) || 0,
      verified: ['elonmusk', 'VitalikButerin', 'saylor', 'cz_binance', 'APompliano', 'CoinDesk', 'Cointelegraph'].includes(tweet.username)
    }));

    return NextResponse.json({ tweets: formattedTweets }, { status: 200 });
  } catch (error) {
    console.error('Error fetching tweets from database:', error);
    return NextResponse.json({ tweets: [] }, { status: 200 });
  }
}
