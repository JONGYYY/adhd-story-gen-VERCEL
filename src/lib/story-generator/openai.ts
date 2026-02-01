import OpenAI from 'openai';
import { TEST_PROMPTS } from '../prompts/test';
import { aitaPrompt } from '../prompts/aita';
import { proRevengePrompt } from '../prompts/pro-revenge';
import { trueOffMyChestPrompt } from '../prompts/true-off-my-chest';
import { relationshipsPrompt } from '../prompts/relationships';
import { confessionPrompt } from '../prompts/confession';
import { nosleepPrompt } from '../prompts/nosleep';
import { shortScaryStoriesPrompt } from '../prompts/short-scary-stories';
import { talesFromYourServerPrompt } from '../prompts/tales-from-your-server';
import { talesFromTechSupportPrompt } from '../prompts/tales-from-tech-support';
import { tifuPrompt } from '../prompts/tifu';

// Map of subreddit prompts with type safety
export const SUBREDDIT_PROMPTS: Record<string, string> = {
  ...TEST_PROMPTS,
  // AITA - accept both full name and abbreviation
  'r/AmItheAsshole': aitaPrompt,
  'r/AITA': aitaPrompt, // Alias
  // ProRevenge
  'r/ProRevenge': proRevengePrompt,
  'r/prorevenge': proRevengePrompt, // Alias (lowercase)
  // TrueOffMyChest
  'r/TrueOffMyChest': trueOffMyChestPrompt,
  'r/trueoffmychest': trueOffMyChestPrompt, // Alias (lowercase)
  // Relationships - accept multiple variations
  'r/relationship_advice': relationshipsPrompt,
  'r/relationships': relationshipsPrompt, // Alias
  // Confession
  'r/confession': confessionPrompt,
  // NoSleep
  'r/nosleep': nosleepPrompt,
  // ShortScaryStories
  'r/shortscarystories': shortScaryStoriesPrompt,
  'r/ShortScaryStories': shortScaryStoriesPrompt, // Alias (proper case)
  // TalesFromYourServer
  'r/TalesFromYourServer': talesFromYourServerPrompt,
  'r/talesfromyourserver': talesFromYourServerPrompt, // Alias (lowercase)
  // TalesFromTechSupport
  'r/TalesFromTechSupport': talesFromTechSupportPrompt,
  'r/talesfromtechsupport': talesFromTechSupportPrompt, // Alias (lowercase)
  // TIFU
  'r/tifu': tifuPrompt,
  'r/TIFU': tifuPrompt, // Alias (uppercase)
};

type StoryPrompt = {
  subreddit: string;
  narratorGender: 'male' | 'female';
};

export type SubredditStory = {
  title: string;
  story: string;
  subreddit: string;
  author: string;
  startingQuestion?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateStory({ subreddit, narratorGender }: StoryPrompt, retryCount = 0): Promise<SubredditStory> {
  const maxRetries = 3;
  console.log('Generating story with params:', JSON.stringify({ subreddit, narratorGender, retryCount }, null, 2));
  
  if (retryCount > maxRetries) {
    console.error('Max retries exceeded for story generation');
    throw new Error('Failed to generate valid story after maximum retries');
  }
  
  const promptTemplate = SUBREDDIT_PROMPTS[subreddit];
  console.log('Found prompt template:', promptTemplate ? 'yes' : 'no');
  console.log('Available subreddits:', Object.keys(SUBREDDIT_PROMPTS));
  
  if (!promptTemplate) {
    console.error('No prompt template found for:', { subreddit, availableSubreddits: Object.keys(SUBREDDIT_PROMPTS) });
    throw new Error(`No prompt template found for subreddit: ${subreddit}`);
  }

  try {
    console.log(`Generating story for ${subreddit} (attempt ${retryCount + 1})`);
    console.log('Using prompt template:', promptTemplate);
    
    // Define subreddits that require special fields
    const subredditsRequiringStartingQuestion = [
      'r/ProRevenge',
      'r/prorevenge',
      'r/TrueOffMyChest',
      'r/trueoffmychest'
    ];
    
    const needsStartingQuestion = subredditsRequiringStartingQuestion.includes(subreddit);
    
    const systemMessage = `You are a creative writer who specializes in generating engaging Reddit stories. 

CRITICAL FORMATTING REQUIREMENTS:
- Follow the prompt EXACTLY as given
- Include ALL required fields in the exact format specified
${needsStartingQuestion ? '- This subreddit REQUIRES a "StartingQuestion:" field - DO NOT omit it' : ''}
- Write in a natural style for a ${narratorGender} narrator

Double-check your output includes all required fields before responding.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        {
          role: 'user',
          content: promptTemplate,
        },
      ],
      temperature: 0.9,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      console.error('No response from OpenAI');
      throw new Error('No response from OpenAI');
    }

    console.log('Received story response:', response);

    // Parse the response into our expected format
    const lines = response.split('\n').filter(line => line.trim() !== '');
    console.log('Parsed lines:', JSON.stringify(lines, null, 2));
    
    const story: Partial<SubredditStory> = {
      subreddit, // Always include the subreddit
      author: 'Anonymous', // Default author
    };

    // Extract title, story, and optionally startingQuestion using regex
    const titleMatch = response.match(/Title:\s*(.+?)(?:\n|$)/);
    const storyMatch = response.match(/Story:\s*(.+?)(?:\n|$)/);
    const startingQuestionMatch = response.match(/StartingQuestion:\s*(.+?)(?:\n|$)/);

    if (!titleMatch || !storyMatch) {
      console.error('Failed to parse story format:', response);
      throw new Error('Story is missing required fields (title or story content)');
    }

    story.title = titleMatch[1].trim();
    story.story = storyMatch[1].trim();
    
    // Extract starting question if present
    if (startingQuestionMatch) {
      story.startingQuestion = startingQuestionMatch[1].trim();
    }

    console.log('Parsed story before validation:', JSON.stringify(story, null, 2));

    // Validate the story format
    if (!story.title || !story.story) {
      console.error('Invalid story format:', JSON.stringify(story, null, 2));
      throw new Error('Story is missing required fields (title or story content)');
    }

    // Validate title word count for test subreddit
    if (subreddit === 'r/test') {
      const titleWords = story.title.split(/\s+/).length;
      // For story word count, exclude the [BREAK] tag from counting
      const storyWithoutBreak = story.story.replace(/\[BREAK\]/g, '').trim();
      const storyWords = storyWithoutBreak.split(/\s+/).filter(word => word.length > 0).length;
      
      if (titleWords > 6) {
        console.error('Invalid test story format - title must be 6 words or less:', story.title);
        throw new Error('Test story title must be 6 words or less');
      }
      
      if (storyWords > 15) {
        console.error('Invalid test story format - story must be 15 words or less:', story.story);
        throw new Error('Test story must be 15 words or less');
      }
    }

    // Validate starting question for subreddits that require it
    if (needsStartingQuestion && !story.startingQuestion) {
      console.error(`${subreddit} story missing starting question:`, JSON.stringify(story, null, 2));
      console.error('Retrying story generation...');
      if (retryCount < maxRetries) {
        return generateStory({ subreddit, narratorGender }, retryCount + 1);
      }
      throw new Error(`${subreddit} story must include a starting question. Please try again.`);
    }

    console.log('Successfully generated and validated story:', JSON.stringify(story, null, 2));
    return story as SubredditStory;
  } catch (error) {
    console.error('Failed to generate story:', error);
    throw error;
  }
} 