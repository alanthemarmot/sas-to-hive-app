import { useState, useRef, useEffect, useCallback } from 'react';
import { streamFollowUp } from '../api/client';
import './ChatPanel.css';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  sasCode: string;
  hiveSQL: string;
  explanation: string;
  isVisible: boolean;
  onClose: () => void;
  selectedModel?: string;
}

export default function ChatPanel({
  sasCode,
  hiveSQL,
  explanation,
  isVisible,
  onClose,
  selectedModel,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      inputRef.current?.focus();
    }
  }, [isVisible]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Build history from existing messages (excluding the new question — it's passed separately)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      let assistantContent = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      for await (const token of streamFollowUp(
        sasCode,
        hiveSQL,
        explanation,
        question,
        history,
        selectedModel,
      )) {
        assistantContent += token;
        const snapshot = assistantContent;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: snapshot };
          return updated;
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${errorMsg}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, sasCode, hiveSQL, explanation, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
  };

  if (!isVisible) return null;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-left">
          💬 Ask about this translation
        </span>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button className="chat-clear-btn" onClick={handleClear}>
              Clear
            </button>
          )}
          <button className="chat-close-btn" onClick={onClose} aria-label="Close chat panel">
            ×
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask a question about the translated code — e.g. "What does PARTITION BY do here?"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message--${msg.role}`}>
            {msg.content || (
              <span className="chat-typing-dots">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          disabled={isStreaming}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
