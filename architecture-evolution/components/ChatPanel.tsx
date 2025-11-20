'use client';

/**
 * ChatPanel 组件
 * 
 * 功能说明：
 * 1. 管理架构演进的工作流程
 * 2. 基于当前要解决的 issue 和之前的版本，生成新版本的 ArchitectureData（包含 output.json）
 * 3. 显示 Issue Backlog，允许用户选择要解决的问题
 * 4. 显示架构演进的轮次历史
 * 
 * 工作流程：
 * - 初始阶段：用户输入需求，生成初始架构（多轮）
 * - 演进阶段：用户从 Backlog 中选择一个 issue，基于最后一个版本生成新版本
 */

import { useState, useRef, useEffect } from 'react';
import { ArchitectureData, createArchitectureData } from '@/lib/architecture-to-excalidraw';

/**
 * ChatPanel 组件的 Props
 */
interface ChatPanelProps {
  /** 当架构数据更新时的回调函数，传入完整的 rounds 数组 */
  onArchitectureUpdate: (rounds: ArchitectureData[]) => void;
  /** 当前的架构演进轮次数组 */
  rounds: ArchitectureData[];
  /** 当前选中的轮次索引 */
  currentRoundIndex: number;
  /** 当用户切换轮次时的回调函数 */
  onRoundChange: (index: number) => void;
}

export default function ChatPanel({
  onArchitectureUpdate,
  rounds,
  currentRoundIndex,
  onRoundChange
}: ChatPanelProps) {
  // ==================== 状态管理 ====================
  
  /** 初始需求输入框的值 */
  const [input, setInput] = useState('');
  /** 是否正在加载（调用 API） */
  const [loading, setLoading] = useState(false);
  /** 消息历史记录（仅在初始阶段显示） */
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  /** Issue Backlog：待解决的问题列表 */
  const [issueBacklog, setIssueBacklog] = useState<string[]>([]);
  /** 添加新 Issue 的输入框值 */
  const [newIssueInput, setNewIssueInput] = useState('');
  /** 原始需求（用于后续的演进请求） */
  const [originalRequirement, setOriginalRequirement] = useState<string>('');
  /** 消息列表的底部引用，用于自动滚动 */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ==================== 工具函数 ====================

  /**
   * 自动滚动到消息列表底部
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * 处理 API 返回的架构数据，确保每个数据都包含 lifecycle 和 output
   * 
   * @param rawRounds 从 API 返回的原始轮次数据（可能不包含 lifecycle 和 output）
   * @returns 完整的 ArchitectureData 数组，每个都包含 lifecycle 和 output
   */
  const processArchitectureRounds = (rawRounds: any[]): ArchitectureData[] => {
    return rawRounds.map((round) => {
      // 如果已经有 lifecycle 和 output，直接返回
      if (round.lifecycle && round.output) {
        return round as ArchitectureData;
      }
      // 否则，使用 createArchitectureData 创建完整的数据
      return createArchitectureData(round);
    });
  };

  // ==================== 事件处理函数 ====================

  /**
   * 处理初始需求提交
   * 
   * 工作流程：
   * 1. 用户输入初始需求
   * 2. 调用 API 生成初始架构（通常生成多轮，如 3 轮）
   * 3. 处理返回的数据，确保包含 lifecycle 和 output
   * 4. 更新 rounds 和 backlog
   */
  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setOriginalRequirement(userMessage);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // 调用架构演进 API
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: userMessage,
          currentArchitecture: null, // 初始阶段，没有当前架构
          issueBacklog: ['实现核心业务功能'], // 初始问题
          maxRounds: 3 // 生成 3 轮初始架构
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get architecture evolution');
      }

      const data = await response.json();
      const rawRounds: any[] = data.rounds || [];
      const finalBacklog: string[] = data.final_backlog || [];

      if (rawRounds.length > 0) {
        // 处理返回的数据，确保包含 lifecycle 和 output
        const processedRounds = processArchitectureRounds(rawRounds);
        
        // 更新架构数据
        onArchitectureUpdate(processedRounds);
        
        // 更新 backlog（使用最后一轮的 new_backlog，如果没有则使用 final_backlog）
        const lastRound = processedRounds[processedRounds.length - 1];
        const backlog = lastRound.evolution_tracking?.new_backlog || finalBacklog;
        setIssueBacklog(backlog);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `已生成 ${processedRounds.length} 轮架构演进方案。请查看右侧图表和下方的 Issue Backlog。`
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

  /**
   * 处理基于 Issue 的架构演进
   * 
   * 这是 ChatPanel 的核心工作流程：
   * 1. 用户从 Backlog 中选择一个要解决的 issue
   * 2. 获取最后一个版本的 ArchitectureData（之前的版本）
   * 3. 调用 API，传入：原始需求、当前架构、要解决的 issue
   * 4. API 返回新的 ArchitectureData（新版本）
   * 5. 将新版本添加到 rounds 数组
   * 6. 更新 backlog（移除已解决的，添加新发现的）
   * 
   * @param selectedIssue 用户选择要解决的 issue
   */
  const handleIssueEvolve = async (selectedIssue: string) => {
    if (loading || rounds.length === 0) return;

    // 获取最后一个版本的架构数据（之前的版本）
    const previousVersion = rounds[rounds.length - 1];
    
    // 从 backlog 中移除即将解决的 issue
    const updatedBacklog = issueBacklog.filter(issue => issue !== selectedIssue);
    
    setLoading(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: `解决 Issue: ${selectedIssue}`
    }]);

    try {
      // 调用架构演进 API
      // 传入：原始需求、当前架构（最后一个版本）、要解决的 issue
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: originalRequirement, // 原始需求
          currentArchitecture: previousVersion, // 之前的版本
          issueBacklog: [selectedIssue], // 当前要解决的 issue
          maxRounds: 1 // 只生成 1 轮新版本
        })
      });

      if (!response.ok) {
        throw new Error('Failed to evolve architecture');
      }

      const data = await response.json();
      const rawRounds: any[] = data.rounds || [];
      const finalBacklog: string[] = data.final_backlog || [];

      if (rawRounds.length > 0) {
        // 处理返回的数据，确保包含 lifecycle 和 output
        const newRounds = processArchitectureRounds(rawRounds);
        
        // 将新版本添加到 rounds 数组
        const updatedRounds = [...rounds, ...newRounds];
        onArchitectureUpdate(updatedRounds);
        
        // 更新 backlog
        // 1. 移除已解决的 issue（已经在 updatedBacklog 中处理）
        // 2. 添加新发现的 issue（从最后一轮的 new_backlog 获取）
        const lastRound = newRounds[newRounds.length - 1];
        const newBacklog = lastRound.evolution_tracking?.new_backlog || finalBacklog;
        // 合并：移除已解决的 + 添加新发现的，并去重
        const mergedBacklog = [...updatedBacklog, ...newBacklog].filter((v, i, a) => a.indexOf(v) === i);
        setIssueBacklog(mergedBacklog);
        
        // 自动切换到新生成的轮次
        onRoundChange(updatedRounds.length - 1);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `已解决 "${selectedIssue}"，生成新的架构演进。`
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

  /**
   * 添加新 Issue 到 Backlog
   */
  const handleAddIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueInput.trim()) return;
    
    setIssueBacklog(prev => [...prev, newIssueInput.trim()]);
    setNewIssueInput('');
  };

  /**
   * 从 Backlog 中删除 Issue
   */
  const handleDeleteIssue = (issue: string) => {
    setIssueBacklog(prev => prev.filter(i => i !== issue));
  };

  // ==================== 渲染逻辑 ====================

  const hasArchitecture = rounds.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="p-4 border-b border-gray-300 bg-gray-50">
        <h1 className="text-xl font-bold">演进式架构师</h1>
        <p className="text-sm text-gray-600">
          {hasArchitecture ? '基于 Issue 迭代演进架构' : '输入你的需求，AI 将帮你演进架构'}
        </p>
      </div>

      {/* 轮次选择器：显示所有架构演进的轮次 */}
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

      {/* Issue Backlog 面板：有架构后显示 */}
      {hasArchitecture && (
        <div className="p-4 border-b border-gray-300 bg-yellow-50">
          <h2 className="text-lg font-semibold mb-3">📋 Issue Backlog</h2>
          <p className="text-xs text-gray-500 mb-3">
            点击 Issue 可以基于当前架构生成新版本来解决它
          </p>
          
          {issueBacklog.length === 0 ? (
            <p className="text-sm text-gray-500 italic">暂无待解决问题</p>
          ) : (
            <div className="space-y-2 mb-3">
              {issueBacklog.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-300"
                >
                  <button
                    onClick={() => handleIssueEvolve(issue)}
                    disabled={loading}
                    className="flex-1 text-left text-sm text-gray-700 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="font-medium">🔧 {issue}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteIssue(issue)}
                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 添加新 Issue */}
          <form onSubmit={handleAddIssue} className="flex gap-2">
            <input
              type="text"
              value={newIssueInput}
              onChange={(e) => setNewIssueInput(e.target.value)}
              placeholder="添加新 Issue..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newIssueInput.trim()}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              添加
            </button>
          </form>
        </div>
      )}

      {/* 消息列表：仅在初始阶段显示 */}
      {!hasArchitecture && (
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
      )}

      {/* 输入框：仅在初始阶段显示 */}
      {!hasArchitecture && (
        <form onSubmit={handleInitialSubmit} className="p-4 border-t border-gray-300">
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
              开始
            </button>
          </div>
        </form>
      )}

      {/* 有架构后显示简要状态 */}
      {hasArchitecture && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <p className="font-semibold">当前状态：</p>
            {currentRoundIndex >= 0 && rounds[currentRoundIndex] && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{rounds[currentRoundIndex].round_title}</p>
                {rounds[currentRoundIndex].decision_rationale && (
                  <p className="text-xs text-gray-500 mt-1">
                    {rounds[currentRoundIndex].decision_rationale}
                  </p>
                )}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>正在演进架构...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
