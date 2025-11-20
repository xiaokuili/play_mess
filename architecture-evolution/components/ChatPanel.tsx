'use client';

import { useState, useRef, useEffect } from 'react';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import { ExcalidrawFile, createExcalidrawFiles } from '@/lib/excalidraw-file-manager';

interface ChatPanelProps {
  onArchitectureUpdate: (rounds: ArchitectureData[]) => void;
  onExcalidrawFileUpdate: (files: ExcalidrawFile[]) => void;
  rounds: ArchitectureData[];
  currentRoundIndex: number;
  onRoundChange: (index: number) => void;
}

export default function ChatPanel({
  onArchitectureUpdate,
  onExcalidrawFileUpdate,
  rounds,
  currentRoundIndex,
  onRoundChange
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: userMessage,
          currentArchitecture: null,
          issueBacklog: ['实现核心业务功能'],
          maxRounds: 3
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get architecture evolution');
      }

      const data = await response.json();
      const newRounds: ArchitectureData[] = data.rounds || [];

      if (newRounds.length > 0) {
        onArchitectureUpdate(newRounds);
        
        // 生成 Excalidraw 文件
        const excalidrawFiles = createExcalidrawFiles(newRounds);
        onExcalidrawFileUpdate(excalidrawFiles);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `已生成 ${newRounds.length} 轮架构演进方案。请查看右侧图表。`
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '未能生成架构演进方案，请重试。'
        }]);
      }
    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="p-4 border-b border-gray-300 bg-gray-50">
        <h1 className="text-xl font-bold">演进式架构师</h1>
        <p className="text-sm text-gray-600">输入你的需求，AI 将帮你演进架构</p>
      </div>

      {/* 轮次选择器 */}
      {rounds.length > 0 && (
        <div className="p-4 border-b border-gray-300 bg-gray-50">
          <div className="flex gap-2 overflow-x-auto">
            {rounds.map((round, index) => (
              <button
                key={round.round_id}
                onClick={() => onRoundChange(index)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  currentRoundIndex === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Round {round.round_id}: {round.round_title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>输入你的架构需求，例如：</p>
            <p className="mt-2 text-sm">"构建一个支持 10万 QPS 的即时通讯系统"</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-300">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的架构需求..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}

