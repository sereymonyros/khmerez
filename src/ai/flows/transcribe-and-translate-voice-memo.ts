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

const transcriptionPrompt = ai.definePrompt({
  name: 'transcriptionPrompt',
  input: {schema: z.object({
    voiceMemoDataUri: TranscribeAndTranslateVoiceMemoInputSchema.shape.voiceMemoDataUri,
    sourceLanguage: TranscribeAndTranslateVoiceMemoInputSchema.shape.sourceLanguage,
  })},
  output: {schema: z.object({transcription: TranscribeAndTranslateVoiceMemoOutputSchema.shape.transcription})},
  prompt: `You are a transcription expert. A user will provide a voice memo and its source language. You will transcribe the voice memo.

Voice Memo: {{media url=voiceMemoDataUri}}
Source Language: {{sourceLanguage}}`,
  model: gemini15Pro,
});

const translationPrompt = ai.definePrompt({
    name: 'translationPrompt',
    input: {schema: z.object({
        textToTranslate: z.string(),
        targetLanguage: TranscribeAndTranslateVoiceMemoInputSchema.shape.targetLanguage,
    })},
    output: {schema: z.object({translation: TranscribeAndTranslateVoiceMemoOutputSchema.shape.translation})},
    prompt: `You are a translator. A user will provide text and a target language. You will translate the text to the target language.

Text to Translate: {{textToTranslate}}
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
    // Step 1: Transcribe
    const transcriptionResponse = await transcriptionPrompt({
        voiceMemoDataUri: input.voiceMemoDataUri,
        sourceLanguage: input.sourceLanguage,
    });
    const transcription = transcriptionResponse.output?.transcription;
    if (!transcription) {
        throw new Error('Failed to transcribe audio.');
    }

    // Step 2: Translate
    const translationResponse = await translationPrompt({
        textToTranslate: transcription,
        targetLanguage: input.targetLanguage,
    });
    const translation = translationResponse.output?.translation;
    if (!translation) {
        throw new Error('Failed to translate text.');
    }

    return {
      transcription,
      translation,
    };
  }
);
