import { NextResponse } from "next/server";
// import Replicate from "replicate";

export async function POST(req: Request) {
  // Return a "not implemented" response
  return NextResponse.json(
    { error: 'Image generation is not currently available' },
    { status: 501 }
  );

  /* Original implementation commented out
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
      {
        input: {
          prompt: prompt,
          image_dimensions: "768x768",
          num_outputs: 1,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
        },
      }
    );

    return NextResponse.json({ output });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Error generating image' },
      { status: 500 }
    );
  }
  */
}
