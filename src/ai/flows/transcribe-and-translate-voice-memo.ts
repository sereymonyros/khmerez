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

const TranscribeAndTranslateVoiceMemoInputSchema = z.object({
  voiceMemoDataUri: z
    .string()
    .describe(
      'A voice memo as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
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

const transcribeAndTranslatePrompt = ai.definePrompt({
  name: 'transcribeAndTranslatePrompt',
  input: {schema: TranscribeAndTranslateVoiceMemoInputSchema},
  output: {schema: TranscribeAndTranslateVoiceMemoOutputSchema},
  prompt: `You are a translator. A user will provide a voice memo, its source language and the target language. You will transcribe the voice memo and translate it to the target language.

Voice Memo: {{media url=voiceMemoDataUri}}
Source Language: {{sourceLanguage}}
Target Language: {{targetLanguage}}`,
});

const transcribeAndTranslateVoiceMemoFlow = ai.defineFlow(
  {
    name: 'transcribeAndTranslateVoiceMemoFlow',
    inputSchema: TranscribeAndTranslateVoiceMemoInputSchema,
    outputSchema: TranscribeAndTranslateVoiceMemoOutputSchema,
  },
  async input => {
    const {output} = await transcribeAndTranslatePrompt(input);
    return output!;
  }
);
