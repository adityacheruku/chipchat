
'use server';
/**
 * @fileOverview A Genkit flow to suggest a user's mood based on their message text.
 *
 * - suggestMood - A function that analyzes message text and suggests a mood.
 * - SuggestMoodInput - The input type for the suggestMood function.
 * - SuggestMoodOutput - The return type for the suggestMood function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';

const SuggestMoodInputSchema = z.object({
  messageText: z.string().describe('The text of the message sent by the user.'),
  currentMood: z.enum(ALL_MOODS as [Mood, ...Mood[]]).describe('The current mood of the user.'),
});
export type SuggestMoodInput = z.infer<typeof SuggestMoodInputSchema>;

const SuggestMoodOutputSchema = z.object({
  suggestedMood: z.enum(ALL_MOODS as [Mood, ...Mood[]]).optional().describe('The suggested mood based on the message text. If no strong mood is detected or it matches the current mood, this may be undefined.'),
  confidence: z.number().optional().describe('A confidence score (0-1) for the suggestion, if a mood is suggested.'),
  reasoning: z.string().optional().describe('A brief explanation for the mood suggestion.'),
});
export type SuggestMoodOutput = z.infer<typeof SuggestMoodOutputSchema>;

export async function suggestMood(input: SuggestMoodInput): Promise<SuggestMoodOutput> {
  return suggestMoodFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMoodPrompt',
  input: {schema: SuggestMoodInputSchema},
  output: {schema: SuggestMoodOutputSchema},
  prompt: `You are an empathetic assistant helping to identify a user's mood based on their chat message.
The user's current mood is {{currentMood}}.
The user just sent the following message: "{{messageText}}"

Analyze the message text. If the message strongly suggests a mood DIFFERENT from their current mood, suggest one of the following moods: ${ALL_MOODS.join(', ')}.
Provide a confidence score (0.0 to 1.0) and a brief reasoning.
If the message is neutral, doesn't strongly indicate a mood, or if the implied mood is very similar to their currentMood, do not suggest a new mood (leave suggestedMood undefined).

Example Output (if a mood is strongly suggested and different):
{
  "suggestedMood": "Happy",
  "confidence": 0.85,
  "reasoning": "The user used multiple exclamation points and positive words like 'exciting!'"
}

Example Output (if no strong mood change is detected):
{
  "reasoning": "The message is a neutral statement or aligns with the current mood."
}
`,
});

const suggestMoodFlow = ai.defineFlow(
  {
    name: 'suggestMoodFlow',
    inputSchema: SuggestMoodInputSchema,
    outputSchema: SuggestMoodOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);
      if (output?.suggestedMood && ALL_MOODS.includes(output.suggestedMood as Mood)) {
        return output;
      }
      return { reasoning: output?.reasoning || "No strong mood change detected." };
    } catch (error) {
      console.error('Error in suggestMoodFlow:', error);
      return { reasoning: "Error analyzing mood." };
    }
  }
);
