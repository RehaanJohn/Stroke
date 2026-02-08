import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch from Python backend
    const response = await fetch("http://localhost:8000/logs/stats", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch log stats:", error);
    // Return default stats if backend is not running
    return NextResponse.json({
      total_logs: 0,
      by_type: {
        signal: 0,
        execution: 0,
        analysis: 0,
        routing: 0,
        monitor: 0,
      },
      by_severity: {
        critical: 0,
        high: 0,
        warning: 0,
        success: 0,
        info: 0,
      },
    });
  }
}
