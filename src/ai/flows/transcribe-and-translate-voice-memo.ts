'use server';

/**
 * @fileOverview A flow to transcribe a voice memo and translate it to the other language.
 *
 * - transcribeAndTranslateVoiceMemo - A function that handles the voice memo transcription and translation process.
 * - TranscribeAndTranslateVoiceMemoInput - The input type for the transcribeAndTranslateVoiceMemo function.
 * - TranscribeAndTranslateVoiceMemoOutput - The return type for the transcribeAndTranslateVoiceMemo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { gemini15Pro } from '@genkit-ai/googleai';

const TranscribeAndTranslateVoiceMemoInputSchema = z.object({
  voiceMemoDataUri: z
    .string()
    .describe(
      "A voice memo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  sourceLanguage: z.enum(['en', 'km']).describe('The language of the voice memo.'),
  targetLanguage: z.enum(['en', 'km']).describe('The language to translate the voice memo to.'),
});
export type TranscribeAndTranslateVoiceMemoInput = z.infer<
  typeof TranscribeAndTranslateVoiceMemoInputSchema
>;

const TranscribeAndTranslateVoiceMemoOutputSchema = z.object({
  transcription: z.string().describe('The transcription of the voice memo.'),
  translation: z.string().describe('The translation of the voice memo.'),
});
export type TranscribeAndTranslateVoiceMemoOutput = z.infer<
  typeof TranscribeAndTranslateVoiceMemoOutputSchema
>;

export async function transcribeAndTranslateVoiceMemo(
  input: TranscribeAndTranslateVoiceMemoInput
): Promise<TranscribeAndTranslateVoiceMemoOutput> {
  return transcribeAndTranslateVoiceMemoFlow(input);
}

const transcriptionAndTranslationPrompt = ai.definePrompt({
  name: 'transcriptionAndTranslationPrompt',
  input: {schema: TranscribeAndTranslateVoiceMemoInputSchema},
  output: {schema: TranscribeAndTranslateVoiceMemoOutputSchema},
  prompt: `You are a transcription and translation expert. A user will provide a voice memo, its source language, and a target language. You will transcribe the voice memo and then translate the transcription to the target language.

Voice Memo: {{media url=voiceMemoDataUri}}
Source Language: {{sourceLanguage}}
Target Language: {{targetLanguage}}`,
  model: gemini15Pro,
});


const transcribeAndTranslateVoiceMemoFlow = ai.defineFlow(
  {
    name: 'transcribeAndTranslateVoiceMemoFlow',
    inputSchema: TranscribeAndTranslateVoiceMemoInputSchema,
    outputSchema: TranscribeAndTranslateVoiceMemoOutputSchema,
  },
  async input => {
    const {output} = await transcriptionAndTranslationPrompt(input);
    if (!output) {
      throw new Error('Failed to transcribe and translate audio.');
    }
    return output;
  }
);
