import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Return a "not implemented" response
  return NextResponse.json(
    { error: 'Deepgram API is not currently available' },
    { status: 501 }
  );

  /* Original implementation commented out
  // Only return the API key, not the actual implementation
  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      { error: 'Deepgram API key not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ apiKey: process.env.DEEPGRAM_API_KEY });
  */
}
