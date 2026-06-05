import { NextResponse } from "next/server";

/** Wrap a handler so any thrown error becomes a 500 {error} JSON response. */
export async function jsonHandler<T>(
  fn: () => T | Promise<T>
): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error("[api] handler error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
