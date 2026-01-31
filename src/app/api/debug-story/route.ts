import { NextRequest, NextResponse } from 'next/server';
import { generateStory } from '@/lib/story-generator/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subreddit: string = body?.subreddit || 'r/test';
    const narratorGender: 'male' | 'female' = (body?.narratorGender === 'female' ? 'female' : 'male');

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not set on the UI service' },
        { status: 500 }
      );
    }

    const story = await generateStory({ subreddit, narratorGender });
    return NextResponse.json({ success: true, story });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to generate story' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subreddit = searchParams.get('subreddit') || 'r/test';
    const narratorGender = (searchParams.get('narratorGender') === 'female' ? 'female' : 'male') as 'male' | 'female';

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not set on the UI service' },
        { status: 500 }
      );
    }

    const story = await generateStory({ subreddit, narratorGender });
    return NextResponse.json({ success: true, story });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to generate story' },
      { status: 500 }
    );
  }
}

