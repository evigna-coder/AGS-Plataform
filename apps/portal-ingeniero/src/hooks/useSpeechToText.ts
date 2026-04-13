import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechToTextOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
}

interface SpeechToTextReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  toggle: () => void;
}

export function useSpeechToText(opts: SpeechToTextOptions = {}): SpeechToTextReturn {
  const { lang = 'es-AR', onResult } = opts;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopRecognition = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    listeningRef.current = false;
    setIsListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    if (!isSupported) return;
    // Clean up any existing instance
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = '';
    let shouldRestart = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const full = finalTranscript + interim;
      setTranscript(full);
      onResultRef.current?.(full);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldRestart = false;
        stopRecognition();
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('SpeechRecognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't manually stopped
      if (shouldRestart && listeningRef.current) {
        try {
          const newRecognition = new SR();
          newRecognition.lang = lang;
          newRecognition.continuous = false;
          newRecognition.interimResults = true;
          newRecognition.onresult = recognition.onresult;
          newRecognition.onerror = recognition.onerror;
          newRecognition.onend = recognition.onend;
          recognitionRef.current = newRecognition;
          newRecognition.start();
        } catch {
          stopRecognition();
        }
      } else {
        stopRecognition();
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setIsListening(true);
    setTranscript('');

    try {
      recognition.start();
    } catch {
      stopRecognition();
    }
  }, [isSupported, lang, stopRecognition]);

  const toggle = useCallback(() => {
    if (listeningRef.current) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  useEffect(() => {
    return () => { stopRecognition(); };
  }, [stopRecognition]);

  return { isListening, isSupported, transcript, toggle };
}
