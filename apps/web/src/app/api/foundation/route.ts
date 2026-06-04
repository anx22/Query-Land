import { NextResponse } from "next/server";
import { loadFoundationDashboardData } from "../../../lib/foundation-api";

export async function GET() {
  const foundation = await loadFoundationDashboardData();
  return NextResponse.json(foundation, { status: foundation.connected ? 200 : 503 });
}
