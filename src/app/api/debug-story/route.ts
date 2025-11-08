import { NextRequest, NextResponse } from 'next/server';
import { generateStory } from '@/lib/story-generator/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subreddit: string = body?.subreddit || 'r/test';
    const isCliffhanger: boolean = Boolean(body?.isCliffhanger);
    const narratorGender: 'male' | 'female' = (body?.narratorGender === 'female' ? 'female' : 'male');

    // Mirror UI API behavior: r/test does not require OpenAI
    if (subreddit === 'r/test') {
      const story = {
        title: 'Simple Test Story Title',
        story: isCliffhanger ? 'Mini test story [BREAK] continue' : 'Mini test story for video',
        subreddit,
        author: 'Anonymous'
      };
      return NextResponse.json({ success: true, story });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not set on the UI service' },
        { status: 500 }
      );
    }

    const story = await generateStory({ subreddit, isCliffhanger, narratorGender });
    return NextResponse.json({ success: true, story });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to generate story' },
      { status: 500 }
    );
  }
}

