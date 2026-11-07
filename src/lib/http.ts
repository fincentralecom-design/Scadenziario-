import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorJson(e: unknown, status = 400) {
  return json({ error: e instanceof Error ? e.message : String(e) }, status);
}
