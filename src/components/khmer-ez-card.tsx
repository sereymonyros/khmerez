
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Languages, Mic, Send, Speaker } from "lucide-react";
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
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const { toast } = useToast();

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
    setResult(null);
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
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: e instanceof Error ? e.message : "Please try again.",
        });
        setResult(null);
      }
    });
  };

  const handleTextTranslate = () => {
    if (!inputText.trim()) return;
    setResult(null);
    processStream(
      translateAndSynthesizeText,
      { text: inputText, sourceLanguage },
      (output) => {
        setResult({
          translation: output.translatedText,
          speechDataUri: output.speechDataUri,
        });
      }
    );
  };

  const handleVoiceTranslate = (voiceMemoDataUri: string) => {
    setResult(null);
    startTransition(async () => {
      try {
        const voiceResult = await transcribeAndTranslateVoiceMemo({
          voiceMemoDataUri,
          sourceLanguage,
          targetLanguage,
        });

        if (!voiceResult) throw new Error("Failed to transcribe and translate voice memo.");

        setInputText(voiceResult.transcription);
        
        const speechResult = await translateAndSynthesizeText({
          sourceLanguage: targetLanguage, // Language of the translated text
          translatedText: voiceResult.translation,
        });

        if (!speechResult) throw new Error("Failed to synthesize speech for the translation.");
        
        setResult({
          transcription: voiceResult.transcription,
          translation: voiceResult.translation,
          speechDataUri: speechResult.speechDataUri,
        });

      } catch (e) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "An error occurred during voice translation.",
          description: e instanceof Error ? e.message : "Please try again.",
        });
        setResult(null);
      }
    });
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setResult(null);
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

  const handlePlayAudio = () => {
    if (!result?.speechDataUri || isSpeaking) return;

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const audio = new Audio(result.speechDataUri);
    audioPlayerRef.current = audio;

    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => {
      setIsSpeaking(false);
      toast({ variant: "destructive", title: "Could not play audio." });
    };

    audio.play();
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
              className="pr-24 min-h-[120px] text-base focus-visible:ring-primary/80"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  handleTextTranslate();
                }
              }}
            />
            <div className="absolute top-3 right-3 flex flex-col space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" onClick={handleTextTranslate} disabled={!inputText.trim() || isPending}>
                    <Send className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Translate (Enter)</p>
                </TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isRecording ? "destructive" : "outline"}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={isPending}
                    className={cn(isRecording && "animate-pulse ring-2 ring-destructive ring-offset-2 ring-offset-background")}
                    id="recordingButton"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? "Release to Stop" : "Press and Hold to Record"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          {isPending && (
            <div className="space-y-4 rounded-lg border border-accent/50 bg-accent/10 p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-accent/20" />
                <Skeleton className="h-5 w-4/5 bg-accent/20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-accent/20" />
                <Skeleton className="h-5 w-full bg-accent/20" />
                <Skeleton className="h-5 w-2/3 bg-accent/20" />
              </div>
            </div>
          )}
          

          {/* translation result */}
          {result && !isPending && (
            <Card className="bg-accent/10 border-accent/50">
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Translation</h3>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-lg font-semibold text-foreground flex-1 pt-1" id="translatedText">
                      {result.translation}
                    </p>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button
                              variant="outline"
                              size="icon"
                              onClick={handlePlayAudio}
                              disabled={!result.speechDataUri || isSpeaking}
                              aria-label="Play translated text"
                              className={cn(isSpeaking && "text-primary")}
                              id="speakingButton"
                            >
                              <Speaker className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Listen to Translation</p></TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>      
    </TooltipProvider>
  );
}
