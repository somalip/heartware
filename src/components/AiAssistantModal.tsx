import React, { useState, useEffect, useRef } from 'react';
import { IosSheet } from './IosSheet';
import { IosSpinner } from './IosSpinner';
import { toolCallingService, AssistantMessage } from '../services/toolCallingService';
import { useHardware } from '../context/HardwareContext';
import { triggerHaptic } from '../utils/haptics';

interface AiAssistantModalProps {
  onClose: () => void;
}

export function AiAssistantModal({ onClose }: AiAssistantModalProps) {
  const { state: hwState } = useHardware();

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Heartware Clinical AI assistant. I can directly control your dispenser, actuate servos over BLE, check inventory, and verify medication safety.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [apiKey, setApiKey] = useState(toolCallingService.getApiKey());
  const [showKeyInput, setShowKeyInput] = useState(!toolCallingService.getApiKey());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript;
          if (transcript) {
            setInputText(transcript);
            handleSend(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your command.');
      return;
    }
    triggerHaptic('medium');
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    toolCallingService.setApiKey(apiKey);
    setShowKeyInput(false);
    triggerHaptic('success');
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    setInputText('');
    triggerHaptic('light');

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history: { role: 'user' | 'assistant'; content: string }[] = [...messages, userMsg].map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const res = await toolCallingService.chatWithTools(history);

      const assistantMsg: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.text,
        toolCalls: res.toolCalls,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      triggerHaptic('success');
    } catch (err: any) {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to execute request'}. If your Gemini API key is missing or invalid, tap the key icon above.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errorMsg]);
      triggerHaptic('warning');
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    { label: '💊 Dispense Bottle 1', prompt: 'Please dispense 1 pill from Bottle 1.' },
    { label: '📊 Status & Levels', prompt: 'What is the current status of my dispenser and bottle levels?' },
    { label: '🔗 Morning Meds (1 & 2)', prompt: 'Dispense my morning medications from bottles 1 and 2 in a sequence.' },
    { label: '🛡️ Check Safety', prompt: 'Is it clinically safe for me to take a dose from bottle 1 right now?' },
    { label: '⚙️ Calibrate Servo 1', prompt: 'Calibrate Bottle 1 servo to 90 degrees.' },
  ];

  return (
    <IosSheet
      title="Heartware Clinical AI"
      leftActionText="Done"
      onLeftAction={onClose}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '70vh', maxHeight: '680px' }}>
        {/* Header hardware & API key status bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--ios-bar-bg)',
            borderRadius: '12px',
            marginBottom: '10px',
            fontSize: '12px',
            border: '1px solid var(--ios-separator)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: hwState.connected ? 'var(--ios-green)' : 'var(--ios-orange)',
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {hwState.connected
                ? `${hwState.deviceId} (${hwState.connectionType.toUpperCase()})`
                : 'Hardware: Simulated Virtual Link'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ios-blue)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '12px',
              padding: '2px 6px',
            }}
          >
            {apiKey ? '🔑 Key Configured' : '⚠️ Set Gemini Key'}
          </button>
        </div>

        {/* API Key Form toggle */}
        {showKeyInput && (
          <form
            onSubmit={handleSaveApiKey}
            style={{
              padding: '10px',
              backgroundColor: 'var(--ios-card-bg)',
              borderRadius: '10px',
              marginBottom: '10px',
              display: 'flex',
              gap: '8px',
              border: '1px solid var(--ios-separator)',
            }}
          >
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste Google Gemini API Key"
              className="ios-input"
              style={{ fontSize: '13px', flex: 1 }}
            />
            <button type="submit" className="ios-pill-btn blue">
              Save Key
            </button>
          </form>
        )}

        {/* Message Thread */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                <div
                  style={{
                    backgroundColor: isUser ? 'var(--ios-blue)' : 'var(--ios-card-bg)',
                    color: isUser ? '#ffffff' : 'inherit',
                    padding: '10px 14px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '14px',
                    lineHeight: '1.45',
                    maxWidth: '85%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: isUser ? 'none' : '1px solid var(--ios-separator)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>

                {/* Render any Tool Calls issued during this turn */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ marginTop: '8px', width: '85%', maxWidth: '380px' }}>
                    {msg.toolCalls.map(tool => (
                      <div
                        key={tool.id}
                        style={{
                          backgroundColor: 'var(--ios-bar-bg)',
                          border: '1px solid var(--ios-separator)',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          marginBottom: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--ios-blue)',
                            }}
                          >
                            ⚙️ {tool.name}
                          </span>
                          <span
                            className={`ios-badge ${
                              tool.status === 'success' ? 'green' : tool.status === 'error' ? 'red' : 'blue'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {tool.status.toUpperCase()}
                          </span>
                        </div>

                        {tool.bleCommand && (
                          <div
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              color: 'var(--ios-secondary)',
                              marginBottom: '2px',
                            }}
                          >
                            BLE TX: &quot;{tool.bleCommand}&quot; &rarr; ESP32 Servo
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--ios-secondary)',
                            backgroundColor: 'var(--ios-card-bg)',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            overflowX: 'auto',
                            fontFamily: 'monospace',
                          }}
                        >
                          {JSON.stringify(tool.args)}
                        </div>

                        {tool.errorMessage && (
                          <div style={{ color: 'var(--ios-red)', marginTop: '4px', fontSize: '11px' }}>
                            {tool.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--ios-secondary)',
                    marginTop: '2px',
                    padding: '0 4px',
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px' }}>
              <IosSpinner size={16} color="var(--ios-blue)" />
              <span style={{ fontSize: '13px', color: 'var(--ios-secondary)' }}>
                Heartware AI evaluating clinical safety & executing tool...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt suggestion chips */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '8px 0',
            scrollbarWidth: 'none',
          }}
        >
          {chips.map((c, i) => (
            <button
              key={i}
              type="button"
              className="ios-badge"
              style={{
                cursor: 'pointer',
                border: '1px solid var(--ios-separator)',
                whiteSpace: 'nowrap',
                padding: '6px 10px',
                fontSize: '12px',
              }}
              onClick={() => handleSend(c.prompt)}
              disabled={loading}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Bottom Input Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--ios-separator)',
          }}
        >
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Speak command'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isListening ? 'var(--ios-red)' : 'var(--ios-bar-bg)',
              color: isListening ? '#ffffff' : 'var(--ios-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <input
            className="ios-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder={isListening ? 'Listening for speech...' : 'Type clinical command or question...'}
            disabled={loading}
            style={{ flex: 1 }}
          />

          <button
            type="button"
            className="ios-pill-btn blue"
            onClick={() => handleSend()}
            disabled={loading || !inputText.trim()}
            style={{ flexShrink: 0 }}
          >
            Send
          </button>
        </div>
      </div>
    </IosSheet>
  );
}
