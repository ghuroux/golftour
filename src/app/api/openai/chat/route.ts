import { NextResponse } from 'next/server';
// import OpenAI from 'openai';

export const runtime = "edge";

export async function POST(req: Request) {
  // Return a "not implemented" response
  return NextResponse.json(
    { error: 'OpenAI chat is not currently available' },
    { status: 501 }
  );

  /* Original implementation commented out
  try {
    const { messages } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream);
  } catch (error) {
    console.error('Error in OpenAI chat:', error);
    return NextResponse.json(
      { error: 'Error processing chat request' },
      { status: 500 }
    );
  }
  */
}
