import { useState, useRef, useEffect } from 'react';
import { generateChatCompletion } from '../services/api';
import { VoiceSettings } from '../types';

interface UseTurnBasedAgentProps {
  systemInstruction: string;
  voiceSettings?: VoiceSettings;
  onTranscriptUpdate: (text: string, isUser: boolean) => void;
  provider?: string;
  model?: string;
}

export const useTurnBasedAgent = ({ 
    systemInstruction, 
    voiceSettings, 
    onTranscriptUpdate,
    provider = 'deepseek',
    model 
}: UseTurnBasedAgentProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const statusRef = useRef<'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('IDLE');
  const [volume, setVolume] = useState(0); // Mock volume for now

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const chatHistoryRef = useRef<any[]>([
        { role: 'system', content: systemInstruction }
    ]);

    // Update system instruction when it changes
    useEffect(() => {
        if (chatHistoryRef.current.length > 0) {
            chatHistoryRef.current[0] = { role: 'system', content: systemInstruction };
        } else {
             chatHistoryRef.current.push({ role: 'system', content: systemInstruction });
        }
    }, [systemInstruction]);

    // Load Voices
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    setAvailableVoices(voices);
                }
            };
            
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false; // Turn-based: listen, process, speak
            recognition.interimResults = true;
            // Set language based on settings
            recognition.lang = voiceSettings?.language === 'en' ? 'en-US' : 'zh-CN';

            recognition.onstart = () => {
                console.log("ASR Started");
                statusRef.current = 'LISTENING';
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                // We assume onTranscriptUpdate handles appending/updating
                if (finalTranscript) {
                    statusRef.current = 'PROCESSING';
                    handleUserInput(finalTranscript);
                }
            };

            recognition.onerror = (event: any) => {
                console.error("ASR Error", event.error);
                if (event.error === 'no-speech') {
                    // Ignore no-speech, onend will restart
                    return;
                }
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    isConnectedRef.current = false;
                    setIsConnected(false);
                }
            };

            recognition.onend = () => {
                // If connected and we should be listening (unexpected stop or no-speech)
                // Restart listening
                if (isConnectedRef.current && statusRef.current === 'LISTENING') {
                     try {
                        recognition.start();
                    } catch (e) { /* ignore */ }
                }
            };

            recognitionRef.current = recognition;
        }
    }
  }, [voiceSettings?.language]); // Re-init if language changes

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    
    // Stop any current speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 1. Language
    const lang = voiceSettings?.language === 'en' ? 'en-US' : 'zh-CN';
    utterance.lang = lang;

    // 2. Voice Selection
    // Use state-based voices if available, otherwise try ref (fallback)
    const voices = availableVoices.length > 0 ? availableVoices : synthesisRef.current.getVoices();
    let selectedVoice = null;
    let genderMismatch = false;
    
    // Try to find a voice that matches language and gender preference
    const isFemale = voiceSettings?.gender === 'female';
    const langVoices = voices.filter(v => v.lang.includes(lang.replace('-', '_')) || v.lang.includes(lang) || v.lang.includes(lang.split('-')[0]));
    
    if (langVoices.length > 0) {
        // Simple heuristic for gender based on voice names
        if (isFemale) {
            selectedVoice = langVoices.find(v => 
                v.name.includes('Female') || 
                v.name.includes('Woman') || 
                v.name.includes('Huihui') || 
                v.name.includes('Yaoyao') ||
                v.name.includes('Google 汉语') // Often female
            );
        } else {
            // Priority for Known Male Voices
            // Search in reverse as some good male voices might be at the end (e.g. Google US English)
            const reversedVoices = [...langVoices].reverse();
            
            selectedVoice = reversedVoices.find(v => 
                v.name.includes('Male') || 
                v.name.includes('Man') || 
                v.name.includes('Kangkang') || 
                v.name.includes('Danny') ||
                v.name.includes('David') ||
                v.name.includes('Mark') ||
                v.name.includes('Hanhan') || 
                v.name.includes('Yunyang') || // Microsoft Chinese Male
                v.name.includes('Shaun') // Microsoft English Male
            );

            // If no explicit Male voice found, try to avoid known Female voices
            if (!selectedVoice) {
                selectedVoice = langVoices.find(v => 
                    !v.name.includes('Female') &&
                    !v.name.includes('Woman') &&
                    !v.name.includes('Huihui') &&
                    !v.name.includes('Yaoyao') &&
                    !v.name.includes('Xiaoxiao') && // Microsoft Female
                    !v.name.includes('Google 汉语')
                );
            }
            
            // If we still can't find a non-female voice, we have a gender mismatch
            if (!selectedVoice) {
                genderMismatch = true;
                // Fallback to whatever we have, but we will adjust pitch later
                selectedVoice = langVoices[0];
            }
        }
        
        // Fallback to first in language if no voice found yet
        if (!selectedVoice) selectedVoice = langVoices[0];
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    // 3. Tone Adjustment (Pitch/Rate)
    if (voiceSettings?.tone) {
        const tone = voiceSettings.tone;
        if (tone.includes('沉稳') || tone.includes('Deep')) {
            utterance.pitch = genderMismatch ? 0.6 : 0.8; // Deepen more if gender mismatch
            utterance.rate = 0.9;
        } else if (tone.includes('阳光') || tone.includes('Bright')) {
            utterance.pitch = genderMismatch ? 0.75 : 1.1; // Still keep it lower if mismatch
            utterance.rate = 1.1;
        } else if (tone.includes('干练') || tone.includes('Professional')) {
            utterance.pitch = genderMismatch ? 0.7 : 1.0;
            utterance.rate = 1.1;
        } else if (tone.includes('温柔') || tone.includes('Warm') || tone.includes('Gentle')) {
            utterance.pitch = genderMismatch ? 0.7 : 0.9;
            utterance.rate = 0.9;
        } else if (tone.includes('甜美') || tone.includes('Sweet')) {
             utterance.pitch = 1.2;
             utterance.rate = 1.0;
        }
    } else if (genderMismatch && !isFemale) {
        // No tone selected, but gender mismatch (User wanted Male, got Female)
        // Manually deepen the pitch to simulate male voice
        utterance.pitch = 0.65; // Aggressive deepening
        utterance.rate = 1.0;
    }

    utterance.onstart = () => {
        setIsSpeaking(true);
        statusRef.current = 'SPEAKING';
    };
    utterance.onend = () => {
        setIsSpeaking(false);
        // After AI finishes speaking, start listening again if connected
        if (isConnectedRef.current && recognitionRef.current) {
            try {
                recognitionRef.current.start();
                // statusRef will be updated to LISTENING in onstart
            } catch (e) { /* ignore if already started */ }
        }
    };
    
    synthesisRef.current.speak(utterance);
  };

  const handleUserInput = async (text: string) => {
      // 1. Update Transcript
      onTranscriptUpdate(text, true);
      
      // 2. Stop Listening
      try { recognitionRef.current.stop(); } catch(e) {}

      // 3. Add to history
      chatHistoryRef.current.push({ role: 'user', content: text });

      // 4. Call LLM
      try {
          const responseText = await generateChatCompletion(provider, chatHistoryRef.current, model);
          
          // 5. Update Transcript with AI response
          onTranscriptUpdate(responseText, false);
          
          // 6. Add to history
          chatHistoryRef.current.push({ role: 'assistant', content: responseText });

          // 7. Speak
          speak(responseText);

      } catch (error) {
          console.error("LLM Error", error);
          onTranscriptUpdate("抱歉，我出了一点问题。", false);
          speak("抱歉，我出了一点问题。");
      }
  };

  const connect = async () => {
      setIsConnected(true);
      // Start by listening
      if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch(e) {
              console.error("Failed to start ASR", e);
          }
      }
      
      // Optionally AI says hello if history only has system prompt
      if (chatHistoryRef.current.length === 1) {
          // If we have a system instruction, we could generate a greeting or just wait.
          // Or we can just synthesize a default greeting based on settings.
          const greeting = voiceSettings?.language === 'en' ? "Hello, I'm ready." : "你好，我们可以开始了。";
          // Don't add to history yet, just speak to prompt user
          speak(greeting);
      }
  };

  const disconnect = () => {
      setIsConnected(false);
      isConnectedRef.current = false;
      statusRef.current = 'IDLE';
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthesisRef.current) synthesisRef.current.cancel();
      setIsSpeaking(false);
  };

  return {
      connect,
      disconnect,
      isConnected,
      isSpeaking,
      volume
  };
};
