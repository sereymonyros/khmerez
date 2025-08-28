'use server';
/**
 * @fileOverview A translation and text-to-speech flow.
 *
 * - translateAndSynthesizeText - A function that translates text between English and Cambodian and synthesizes the translated text into speech.
 * - TranslateAndSynthesizeTextInput - The input type for the translateAndSynthesizeText function.
 * - TranslateAndSynthesizeOutput - The return type for the translateAndSynthesizeText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const TranslateAndSynthesizeTextInputSchema = z.object({
  text: z.string().describe('The text to translate and synthesize.'),
  sourceLanguage: z.enum(['en', 'km']).describe('The source language of the text.'),
});
export type TranslateAndSynthesizeTextInput = z.infer<typeof TranslateAndSynthesizeTextInputSchema>;

const TranslateAndSynthesizeOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
  speechDataUri: z.string().describe('The audio data URI of the synthesized speech.'),
  targetLanguage: z.enum(['en', 'km']).describe('The language that the text was translated to.'),
});
export type TranslateAndSynthesizeOutput = z.infer<typeof TranslateAndSynthesizeOutputSchema>;

export async function translateAndSynthesizeText(
  input: TranslateAndSynthesizeTextInput
): Promise<TranslateAndSynthesizeOutput> {
  return translateAndSynthesizeTextFlow(input);
}

const translateAndSynthesizeTextPrompt = ai.definePrompt({
  name: 'translateAndSynthesizeTextPrompt',
  input: {schema: TranslateAndSynthesizeTextInputSchema},
  output: {schema: z.object({translatedText: z.string()})},
  prompt: `Translate the following text from {{sourceLanguage}} to {{targetLanguage}}:\n\n{{text}}`,
});

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const translateAndSynthesizeTextFlow = ai.defineFlow(
  {
    name: 'translateAndSynthesizeTextFlow',
    inputSchema: TranslateAndSynthesizeTextInputSchema,
    outputSchema: TranslateAndSynthesizeOutputSchema,
  },
  async input => {
    const targetLanguage = input.sourceLanguage === 'en' ? 'km' : 'en';
    const {output} = await translateAndSynthesizeTextPrompt({
      ...input,
      targetLanguage,
    });

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {voiceName: 'Algenib'},
          },
        },
      },
      prompt: output!.translatedText,
    });

    if (!media) {
      throw new Error('no media returned');
    }

    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    const speechDataUri = 'data:audio/wav;base64,' + (await toWav(audioBuffer));

    return {
      translatedText: output!.translatedText,
      speechDataUri: speechDataUri,
      targetLanguage: targetLanguage as 'en' | 'km',
    };
  }
);
