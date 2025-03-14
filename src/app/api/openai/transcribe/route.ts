import { NextResponse } from "next/server";
// import OpenAI from "openai";

export async function POST(req: Request) {
  // Return a "not implemented" response
  return NextResponse.json(
    { error: 'OpenAI transcription is not currently available' },
    { status: 501 }
  );

  /* Original implementation commented out
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const fileBlob = new Blob([buffer]);

    const transcription = await openai.audio.transcriptions.create({
      file: fileBlob,
      model: 'whisper-1',
    });

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { error: 'Error transcribing audio' },
      { status: 500 }
    );
  }
  */
}
