import { NextResponse } from 'next/server';
// import Anthropic from '@anthropic-ai/sdk';

export const runtime = "edge";

export async function POST(req: Request) {
  // Return a "not implemented" response
  return NextResponse.json(
    { error: 'Anthropic chat is not currently available' },
    { status: 501 }
  );

  /* Original implementation commented out
  try {
    const { messages } = await req.json();

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stream = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream);
  } catch (error) {
    console.error('Error in Anthropic chat:', error);
    return NextResponse.json(
      { error: 'Error processing chat request' },
      { status: 500 }
    );
  }
  */
}
