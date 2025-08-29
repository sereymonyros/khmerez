
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Languages, Mic, Globe, Volume2 } from "lucide-react";
import { transcribeAndTranslateVoiceMemo } from "@/ai/flows/transcribe-and-translate-voice-memo";
import { translateAndSynthesizeText } from "@/ai/flows/translate-and-synthesize-text";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type LanguagePair = "en-km" | "km-en";
type TranslationResult = {
  transcription?: string;
  translation: string;
  speechDataUri?: string;
};
type ResultState = {
    type: "loading" | "success" | "error" | null;
    message?: string;
    data?: TranslationResult | null;
};

export function KhmerEzCard() {
  const [languagePair, setLanguagePair] = useState<LanguagePair>("en-km");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<ResultState>({ type: null });
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const sourceLanguage = languagePair.split("-")[0] as "en" | "km";
  const targetLanguage = languagePair.split("-")[1] as "en" | "km";

  const langNames = {
    en: "English",
    km: "Cambodian",
  };

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const handleLanguageToggle = () => {
    setLanguagePair(prev => (prev === "en-km" ? "km-en" : "en-km"));
    setInputText("");
    setResult({ type: null });
  };
  
  const handlePlayAudio = (speechDataUri: string) => {
    if (!speechDataUri || isSpeaking) return;
  
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const audio = new Audio(speechDataUri);
    audioPlayerRef.current = audio;
  
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => {
      setIsSpeaking(false);
      setResult({ type: 'error', message: "Could not play audio." });
    };
  
    audio.play();
  };

  const processStream = (
    action: (input: any) => Promise<any>,
    input: any,
    onSuccess: (output: any) => void
  ) => {
    startTransition(async () => {
      try {
        const output = await action(input);
        if (!output) throw new Error("Received an empty response from the AI.");
        onSuccess(output);
      } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Please try again.";
        setResult({ type: 'error', message });
      }
    });
  };

  const handleTextTranslate = () => {
    if (!inputText.trim()) return;
    setResult({ type: 'loading' });
    startTransition(() => {
      processStream(
        translateAndSynthesizeText,
        { text: inputText, sourceLanguage },
        (output) => {
          if (output.translatedText) {
            setResult({
              type: 'success',
              data: {
                translation: output.translatedText,
                speechDataUri: output.speechDataUri,
              },
            });
          } else {
              setResult({ type: 'error', message: 'No result found.' });
          }
        }
      );
    });
  };

  const handleVoiceTranslate = (voiceMemoDataUri: string) => {
    setInputText("");
    setResult({ type: 'loading' });
    startTransition(async () => {
      try {
        const voiceResult = await transcribeAndTranslateVoiceMemo({
          voiceMemoDataUri,
          sourceLanguage,
          targetLanguage,
        });
  
        if (!voiceResult || !voiceResult.translation) {
            setResult({ type: 'error', message: 'No result found.' });
            return;
        }
  
        setInputText(voiceResult.transcription);
        
        const speechResult = await translateAndSynthesizeText({
          sourceLanguage: targetLanguage,
          translatedText: voiceResult.translation,
        });

        setResult({
            type: 'success',
            data: {
                transcription: voiceResult.transcription,
                translation: voiceResult.translation,
                speechDataUri: speechResult?.speechDataUri,
            }
        });
  
      } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Please try again.";
        setResult({ type: 'error', message: `An error occurred during voice translation: ${message}` });
      }
    });
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setInputText("");
      setResult({ type: 'loading' });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleVoiceTranslate(reader.result as string);
        };
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Microphone access denied:", error);
      setResult({
        type: 'error',
        message: "Please allow microphone access in your browser settings to use this feature."
      });
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <TooltipProvider>
      {result.type && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 z-50 mb-4">
          {result.type === 'loading' && (
              <Alert variant="success">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-5 w-full" />
                </div>
              </Alert>
          )}
          {result.type === 'error' && (
              <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
              </Alert>
          )}
          {result.type === 'success' && result.data && (
              <Alert variant="success" className="flex items-center justify-between">
                  <AlertDescription className="text-base text-black focus-visible:ring-primary/80">
                    {result.data.translation}
                  </AlertDescription>
                  {result.data.speechDataUri && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayAudio(result.data.speechDataUri!)}
                      disabled={isSpeaking}
                      aria-label="Play translated text"
                    >
                      <Volume2 className={cn("w-5 h-5", isSpeaking ? "text-primary" : "text-black")} />
                    </Button>
                  )}
              </Alert>
          )}
        </div>
      )}
      <Card className="w-full max-w-2xl mt-8 shadow-2xl shadow-primary/10">
        <CardHeader className="text-center">
          <CardTitle className="relative flex items-center justify-center gap-4 text-2xl font-headline">
            <span>{langNames[sourceLanguage]}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleLanguageToggle} aria-label="Swap languages">
                  <Languages className="w-6 h-6 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Swap to {langNames[targetLanguage]} → {langNames[sourceLanguage]}</p>
              </TooltipContent>
            </Tooltip>
            <span>{langNames[targetLanguage]}</span>
          </CardTitle>
          <CardDescription>
            Enter text or use your voice to translate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Textarea
              id="originalText"
              placeholder="Type in English or Cambodian..."
              className="min-h-[120px] text-base focus-visible:ring-primary/80"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setResult({type: null});
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  handleTextTranslate();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="flex-1"
                  onClick={handleTextTranslate}
                  disabled={!inputText.trim() || isPending}
                  aria-label="Translate text"
                >
                  <Globe className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Translate</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isRecording ? 'destructive' : 'outline'}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isPending}
                  className={cn(
                    'flex-1',
                    isRecording &&
                      'animate-pulse ring-2 ring-destructive ring-offset-2 ring-offset-background'
                  )}
                  id="recordingButton"
                >
                  <Mic className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isRecording
                    ? 'Release to Stop'
                    : 'Press and Hold to Record'}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>      
    </TooltipProvider>
  );
}
