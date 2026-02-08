import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "100";
    const type = searchParams.get("type") || "";
    const severity = searchParams.get("severity") || "";

    // Build query parameters
    const params = new URLSearchParams();
    params.append("limit", limit);
    if (type && type !== "all") params.append("log_type", type);
    if (severity) params.append("severity", severity);

    // Fetch from Python backend
    const response = await fetch(
      `http://localhost:8000/logs?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    // Return empty logs if backend is not running
    return NextResponse.json({ logs: [] });
  }
}
