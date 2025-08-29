
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Languages, Mic, Globe, Volume2 } from "lucide-react";
import { transcribeAndTranslateVoiceMemo } from "@/ai/flows/transcribe-and-translate-voice-memo";
import { translateAndSynthesizeText } from "@/ai/flows/translate-and-synthesize-text";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LanguagePair = "en-km" | "km-en";
type TranslationResult = {
  transcription?: string;
  translation: string;
  speechDataUri?: string;
};

export function KhmerEzCard() {
  const [languagePair, setLanguagePair] = useState<LanguagePair>("en-km");
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const activeToastId = useRef<string | null>(null);


  const { toast, dismiss } = useToast();

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
      toast({ variant: "destructive", title: "Could not play audio." });
    };
  
    audio.play();
  };

  const showTranslationToast = (result: TranslationResult, variant: 'success' | 'destructive' = 'success') => {
    const { update } = toast({
      variant,
      duration: Infinity,
      description: (
        <div className="flex items-center gap-4">
          <span>{result.translation}</span>
          {result.speechDataUri && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePlayAudio(result.speechDataUri!)}
              disabled={isSpeaking}
              aria-label="Play translated text"
              className={cn("text-success-foreground hover:bg-white/20 hover:text-success-foreground", isSpeaking && "text-primary")}
            >
              <Volume2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      ),
    });
    activeToastId.current = update.id;
  };
  
  const showLoadingToast = () => {
    if (activeToastId.current) {
      dismiss(activeToastId.current);
    }
    const { id } = toast({
      variant: 'success',
      duration: Infinity,
      description: (
        <div className="space-y-2">
            <Skeleton className="h-5 w-full bg-white/30" />
        </div>
      ),
    });
    activeToastId.current = id;
  };

  const processStream = (
    action: (input: any) => Promise<any>,
    input: any,
    onSuccess: (output: any) => void
  ) => {
    startTransition(async () => {
      showLoadingToast();
      try {
        const output = await action(input);
        if (!output) throw new Error("Received an empty response from the AI.");
        onSuccess(output);
      } catch (e) {
        if (activeToastId.current) dismiss(activeToastId.current);
        console.error(e);
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: e instanceof Error ? e.message : "Please try again.",
        });
      }
    });
  };

  const handleTextTranslate = () => {
    if (!inputText.trim()) return;
    processStream(
      translateAndSynthesizeText,
      { text: inputText, sourceLanguage },
      (output) => {
        if (output.translatedText) {
          const newResult = {
            translation: output.translatedText,
            speechDataUri: output.speechDataUri,
          };
          showTranslationToast(newResult, 'success');
        } else {
          showTranslationToast({ translation: 'No result found.' }, 'destructive');
        }
      }
    );
  };

  const handleVoiceTranslate = (voiceMemoDataUri: string) => {
    setInputText("");
    startTransition(async () => {
      showLoadingToast();
      try {
        const voiceResult = await transcribeAndTranslateVoiceMemo({
          voiceMemoDataUri,
          sourceLanguage,
          targetLanguage,
        });
  
        if (!voiceResult || !voiceResult.translation) {
            showTranslationToast({ translation: 'No result found.' }, 'destructive');
            return;
        }
  
        setInputText(voiceResult.transcription);
        
        const speechResult = await translateAndSynthesizeText({
          sourceLanguage: targetLanguage,
          translatedText: voiceResult.translation,
        });

        const newResult = {
          transcription: voiceResult.transcription,
          translation: voiceResult.translation,
          speechDataUri: speechResult?.speechDataUri,
        };
        
        showTranslationToast(newResult, 'success');
  
      } catch (e) {
        if (activeToastId.current) dismiss(activeToastId.current);
        console.error(e);
        toast({
          variant: "destructive",
          title: "An error occurred during voice translation",
          description: e instanceof Error ? e.message : "Please try again.",
        });
      }
    });
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setInputText("");
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
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings to use this feature.",
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
              placeholder={`Type in ${langNames[sourceLanguage]}...`}
              className="min-h-[120px] text-base focus-visible:ring-primary/80"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  handleTextTranslate();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleTextTranslate}
              disabled={!inputText.trim() || isPending}
            >
              <Globe className="w-5 h-5 mr-2" />
              Translate
            </Button>
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
