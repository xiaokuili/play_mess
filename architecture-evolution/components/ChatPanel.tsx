'use client';

/**
 * ChatPanel 组件
 * 
 * 功能说明：
 * 1. 管理架构演进的工作流程
 * 2. 基于当前要解决的 issue 和之前的版本，生成新版本的 ArchitectureData（包含 output.json）
 * 3. 显示 Issue Backlog，允许用户选择要解决的问题
 * 4. 显示架构演进的轮次历史
 * 5. 管理任务依赖关系和状态
 * 6. 维护已解决问题的历史记录，过滤大模型返回的 backlog 中已解决的问题
 * 
 * 工作流程：
 * - 初始阶段：用户输入需求，生成初始架构（多轮）
 * - 演进阶段：用户从 Backlog 中选择一个 issue，基于最后一个版本生成新版本
 * 
 * 已解决问题历史维护：
 * - 大模型返回的 backlog 是累积的，可能包含已经解决的问题
 * - 通过维护 solvedIssuesHistory 状态，记录所有已解决的问题
 * - 在处理新 backlog 时，自动过滤掉已解决的问题，避免重复添加
 */

import { useState, useRef, useEffect } from 'react';
import { ArchitectureData, createArchitectureData } from '@/lib/architecture-to-excalidraw';
import { Link, Lock, MousePointer2, Trash2, CheckCircle, Plus, ArrowDown } from 'lucide-react';

/**
 * Issue 接口：包含依赖关系和状态
 */
interface Issue {
  id: number;
  title: string;
  status: 'open' | 'done';
  dependencies: number[]; // 依赖的其他 issue 的 id
}

/**
 * ChatPanel 组件的 Props
 */
interface ChatPanelProps {
  /** 当架构数据更新时的回调函数，传入完整的 rounds 数组和可选的自动选中索引 */
  onArchitectureUpdate: (rounds: ArchitectureData[], autoSelectIndex?: number) => void;
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
  /** Issue Backlog：待解决的问题列表（带依赖关系和状态） */
  const [issues, setIssues] = useState<Issue[]>([]);
  /** 添加新 Issue 的输入框值 */
  const [newIssueText, setNewIssueText] = useState('');
  /** 新 Issue 的依赖选择 */
  const [newIssueDep, setNewIssueDep] = useState<string>('');
  /** 当前正在构建的 Issue ID */
  const [activeIssueId, setActiveIssueId] = useState<number | null>(null);
  /** 原始需求（用于后续的演进请求） */
  const [originalRequirement, setOriginalRequirement] = useState<string>('');
  /** 已解决问题的历史记录（用于过滤大模型返回的 backlog） */
  const [solvedIssuesHistory, setSolvedIssuesHistory] = useState<Set<string>>(new Set());
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

  /**
   * 检查 Issue 是否被阻塞（依赖未完成）
   * 
   * @param issue 要检查的 Issue
   * @returns 是否被阻塞，以及阻塞它的 Issue 列表
   */
  const getIssueStatusInfo = (issue: Issue) => {
    const blockers = issue.dependencies.filter(depId => {
      const parent = issues.find(i => i.id === depId);
      return parent && parent.status !== 'done';
    });
    
    return {
      isBlocked: blockers.length > 0,
      blockers: blockers.map(id => issues.find(i => i.id === id)).filter(Boolean) as Issue[]
    };
  };

  // ==================== 事件处理函数 ====================

  /**
   * 处理初始需求提交
   * 
   * 工作流程：
   * 1. 用户输入初始需求
   * 2. 调用 API 生成第一轮架构（只生成 1 轮）
   * 3. 处理返回的数据，确保包含 lifecycle 和 output
   * 4. 更新 rounds 和 backlog（显示问题日志）
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
      // 调用架构演进 API，只生成第一轮
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: userMessage,
          currentArchitecture: null, // 初始阶段，没有当前架构
          issueBacklog: [], // 初始问题
          maxRounds: 1 // 只生成第一轮，显示问题日志
        })
      });

      if (!response.ok) {
        // 尝试获取详细的错误信息
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to get architecture evolution');
      }

      const data = await response.json();
      const rawRounds: any[] = data.rounds || [];
      const finalBacklog: string[] = data.final_backlog || [];

      if (rawRounds.length > 0) {
        // 处理返回的数据，确保包含 lifecycle 和 output
        const processedRounds = processArchitectureRounds(rawRounds);
        
        // 更新架构数据
        onArchitectureUpdate(processedRounds);
        
        // 更新 backlog（使用第一轮的 new_backlog，如果没有则使用 final_backlog）
        // 将字符串数组转换为 Issue 对象数组
        const firstRound = processedRounds[0];
        const backlog = firstRound.evolution_tracking?.new_backlog || finalBacklog;
        
        // 初始阶段，没有用户操作，所以没有已解决的问题
        // 所有 issue 都是待处理状态
        const newIssues: Issue[] = backlog.map((title, index) => {
          return {
            id: Date.now() + index, // 使用时间戳确保唯一性
            title,
            status: 'open' as const,
            dependencies: []
          };
        });
        setIssues(newIssues);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ 已生成第一轮架构演进方案！\n\n📋 请查看下方的 Issue Backlog，点击"构建"按钮开始解决任务。\n\n💡 提示：任务可以设置依赖关系，被阻塞的任务无法开始。`
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
   * 开始解决 Issue（开始构建）
   * 
   * @param issueId 要解决的 Issue ID
   */
  const startSolving = (issueId: number) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    
    const { isBlocked } = getIssueStatusInfo(issue);
    if (isBlocked) {
      alert("警告：此任务的前置依赖尚未完成，建议按顺序执行。");
      return;
    }
    
    setActiveIssueId(issueId);
    // 不修改issue状态，保持为open，直到生成完成后再更新为done
    
    // 开始演进
    handleIssueEvolve(issue.title);
  };

  /**
   * 处理基于 Issue 的架构演进
   * 
   * 这是 ChatPanel 的核心工作流程：
   * 1. 用户从 Backlog 中选择一个要解决的 issue
   * 2. 获取最后一个版本的 ArchitectureData（之前的版本）
   * 3. 调用 API，传入：原始需求、当前架构、要解决的 issue
   * 4. API 返回新的 ArchitectureData（新版本，只生成 1 轮）
   * 5. 将新版本添加到 rounds 数组
   * 6. 更新 backlog（移除已解决的，添加新发现的）
   * 
   * 注意：迭代是一轮一轮进行的，每次只生成一轮新版本
   * 
   * @param selectedIssueTitle 用户选择要解决的 issue 标题
   */
  const handleIssueEvolve = async (selectedIssueTitle: string) => {
    if (loading || rounds.length === 0) return;

    // 获取最后一个版本的架构数据（之前的版本）
    const previousVersion = rounds[rounds.length - 1];
    
    setLoading(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: `解决 Issue: ${selectedIssueTitle}`
    }]);

    try {
      // 调用架构演进 API
      // 传入：原始需求、当前架构（最后一个版本）、要解决的 issue
      // 只生成 1 轮新版本，然后引入新问题
      const response = await fetch('/api/architect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: originalRequirement, // 原始需求
          currentArchitecture: previousVersion, // 之前的版本
          issueBacklog: [selectedIssueTitle], // 当前要解决的 issue
          maxRounds: 1 // 只生成 1 轮新版本，迭代是一点点进行
        })
      });

      if (!response.ok) {
        // 尝试获取详细的错误信息
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to evolve architecture');
      }

      const data = await response.json();
      const rawRounds: any[] = data.rounds || [];
      const finalBacklog: string[] = data.final_backlog || [];

      if (rawRounds.length > 0) {
        // 处理返回的数据，确保包含 lifecycle 和 output
        const newRounds = processArchitectureRounds(rawRounds);
        
        // 将新版本添加到 rounds 数组（只添加一轮）
        const updatedRounds = [...rounds, ...newRounds];
        const newRoundIndex = updatedRounds.length - 1;
        
        // 更新架构数据，并自动跳转到新生成的轮次
        onArchitectureUpdate(updatedRounds, newRoundIndex);
        
        // 更新 issues
        // 1. 将当前 activeIssueId 标记为 done（基于用户操作）
        // 2. 将当前解决的 issue 标题添加到已解决历史记录（基于用户操作，不依赖大模型返回）
        // 3. 添加新发现的 issue
        const newRound = newRounds[0];
        const newBacklog = newRound.evolution_tracking?.new_backlog || finalBacklog;
        
        // 基于用户操作维护已解决问题历史：用户点击"构建"并成功生成架构，说明该 issue 已解决
        setSolvedIssuesHistory(prev => {
          const newSet = new Set(prev);
          // 将当前用户操作的 issue 标题添加到已解决历史
          newSet.add(selectedIssueTitle);
          
          // 在同一个更新中处理 issues，使用最新的历史记录
          setIssues(prevIssues => {
            // 标记当前 issue 为 done（基于用户操作）
            const updated = prevIssues.map(i => 
              i.id === activeIssueId ? { ...i, status: 'done' as const } : i
            );
            
            // 处理新发现的 issue
            const newIssues: Issue[] = newBacklog.map((title, index) => {
              // 检查是否已存在相同标题的 issue（在当前的 issues 列表中）
              const existing = updated.find(i => i.title === title);
              if (existing) {
                // 如果已存在，保留原有issue（包括done状态的）
                return existing;
              }
              
              // 新issue，根据是否已在已解决历史中设置状态
              const isSolved = newSet.has(title);
              return {
                id: Date.now() + index,
                title,
                status: isSolved ? 'done' as const : 'open' as const,
                dependencies: []
              };
            });
            
            // 合并并去重（基于 id，保留所有issue）
            const merged = [...updated, ...newIssues];
            const unique = merged.filter((issue, index, self) => 
              index === self.findIndex(i => i.id === issue.id)
            );
            
            return unique;
          });
          
          return newSet;
        });
        
        // 清除 activeIssueId
        setActiveIssueId(null);
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ 已解决 "${selectedIssueTitle}"，生成第 ${newRound.round_id} 轮架构演进。已自动切换到最新版本，请查看 Issue Backlog 选择下一个要修复的问题。`
        }]);
      }
    } catch (error: any) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${error.message}`
      }]);
      
      // 如果出错，清除 activeIssueId（状态保持为 open，不需要修改）
      if (activeIssueId !== null) {
        setActiveIssueId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加新 Issue 到 Backlog
   * 如果该 issue 已在已解决历史记录中，自动标记为 done
   */
  const handleAddIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueText.trim()) return;
    
    const issueTitle = newIssueText.trim();
    // 检查是否已在已解决历史记录中
    const isSolved = solvedIssuesHistory.has(issueTitle);
    
    const newIssue: Issue = {
      id: Date.now(),
      title: issueTitle,
      status: isSolved ? 'done' : 'open',
      dependencies: newIssueDep ? [parseInt(newIssueDep)] : []
    };
    
    setIssues(prev => [...prev, newIssue]);
    setNewIssueText('');
    setNewIssueDep('');
  };

  /**
   * 从 Backlog 中删除 Issue
   */
  const handleDeleteIssue = (issueId: number) => {
    // 检查是否有其他 issue 依赖此 issue
    const hasDependents = issues.some(i => i.dependencies.includes(issueId));
    if (hasDependents) {
      alert("无法删除：其他任务依赖于此任务。");
      return;
    }
    
    setIssues(prev => prev.filter(i => i.id !== issueId));
    if (activeIssueId === issueId) {
      setActiveIssueId(null);
    }
  };

  /**
   * 切换 Issue 状态（done <-> open）
   * 同时更新已解决历史记录（基于用户操作）
   */
  const toggleIssueStatus = (issueId: number) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    
    const { isBlocked } = getIssueStatusInfo(issue);
    if (isBlocked && issue.status === 'open') {
      alert("警告：此任务的前置依赖尚未完成，建议按顺序执行。");
      return;
    }
    
    const isCurrentlyDone = issue.status === 'done';
    const newStatus: 'done' | 'open' = isCurrentlyDone ? 'open' : 'done';
    
    // 基于用户操作更新已解决历史记录
    setSolvedIssuesHistory(prev => {
      const newSet = new Set(prev);
      if (newStatus === 'done') {
        // 用户标记为 done，添加到历史记录
        newSet.add(issue.title);
      } else {
        // 用户标记为 open，从历史记录中移除
        newSet.delete(issue.title);
      }
      return newSet;
    });
    
    setIssues(prev => prev.map(i => {
      if (i.id === issueId) {
        if (activeIssueId === issueId && i.status === 'open') {
          setActiveIssueId(null);
          return { ...i, status: 'done' as const };
        }
        return { ...i, status: newStatus };
      }
      return i;
    }));
  };

  // ==================== 渲染逻辑 ====================

  const hasArchitecture = rounds.length > 0;

  return (
    <div className="flex flex-col h-full">
    

      {/* Issue Backlog 面板：有架构后显示 */}
      {hasArchitecture && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 标题和进度 */}
          <div className="p-4 border-b border-gray-300 bg-gray-50">
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Link className="text-blue-600" size={20}/> 
              架构演进路径
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              定义依赖关系，向客户展示实施路径。
            </p>
            
            {/* Progress Bar */}
            {issues.length > 0 && (
              <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${Math.round((issues.filter(i => i.status === 'done').length / issues.length) * 100)}%` 
                  }}
                ></div>
              </div>
            )}
          </div>

          {/* Issue 输入区域 */}
          <div className="p-3 border-b border-gray-100 bg-white space-y-2">
            <div className="text-xs font-semibold text-gray-500 mb-1">添加新任务</div>
            
            <form onSubmit={handleAddIssue} className="space-y-2">
              <input 
                type="text" 
                placeholder="任务名称 (例如: 引入 Redis)" 
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                value={newIssueText}
                onChange={(e) => setNewIssueText(e.target.value)}
                disabled={loading}
              />
              <div className="flex gap-2">
                <select 
                  className="flex-1 text-xs px-2 py-2 border border-gray-200 rounded bg-gray-50 text-gray-600 outline-none"
                  value={newIssueDep}
                  onChange={(e) => setNewIssueDep(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- 选择前置依赖 (可选) --</option>
                  {issues.filter(i => i.status !== 'done').map(i => (
                    <option key={i.id} value={i.id}>依赖于: #{i.id} {i.title}</option>
                  ))}
                </select>
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center justify-center transition-colors"
                  disabled={loading || !newIssueText.trim()}
                >
                  <Plus size={16} />
                </button>
              </div>
            </form>
          </div>

          {/* Issue 列表 - 按状态分组展示 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {issues.length === 0 ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">🎉 恭喜！所有问题已解决</p>
                <p className="text-xs text-green-600 mt-1">你可以添加新 Issue 继续演进架构</p>
              </div>
            ) : (
              <>
                {/* 按状态分组 */}
                {(() => {
                  const openIssues = issues.filter(i => i.status === 'open');
                  const doneIssues = issues.filter(i => i.status === 'done');
                  
                  const renderIssue = (issue: Issue) => {
                    const { isBlocked, blockers } = getIssueStatusInfo(issue);
                    const isDone = issue.status === 'done';
                    const isActive = activeIssueId === issue.id;

                    return (
                      <div 
                        key={issue.id} 
                        className={`
                          relative rounded-lg border p-3 transition-all duration-200 mb-3
                          ${isDone ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white'}
                          ${isActive ? 'border-blue-400 ring-1 ring-blue-200 shadow-md transform scale-[1.02] z-10' : 'border-gray-200 hover:border-blue-300'}
                          ${isBlocked && !isDone ? 'bg-gray-50 border-gray-200' : ''}
                        `}
                      >
                        {/* Dependency Connector Line */}
                        {issue.dependencies.length > 0 && (
                          <div className="absolute -top-3 left-4 w-0.5 h-3 bg-gray-300"></div>
                        )}
                        
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-400">#{issue.id}</span>
                              <span className={`font-medium text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {issue.title}
                              </span>
                            </div>
                            
                            {/* Blocker Info */}
                            {isBlocked && !isDone && (
                              <div className="flex items-start gap-1 mt-1 text-xs text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-100">
                                <Lock size={12} className="mt-0.5 shrink-0"/>
                                <span>
                                  需先完成: {blockers.map(b => `#${b.id}`).join(', ')}
                                </span>
                              </div>
                            )}
                            
                            {/* Dependency Info */}
                            {!isBlocked && issue.dependencies.length > 0 && (
                              <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                <Link size={10}/> 依赖于 #{issue.dependencies[0]}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-2 pl-2">
                            {/* Status Action */}
                            {isDone ? (
                              <button 
                                onClick={() => toggleIssueStatus(issue.id)} 
                                className="text-green-500 hover:text-green-600"
                              >
                                <CheckCircle size={18}/>
                              </button>
                            ) : (
                              <button 
                                onClick={() => startSolving(issue.id)}
                                disabled={isBlocked || loading}
                                className={`
                                  p-1.5 rounded transition-colors flex items-center gap-1 text-xs
                                  ${isBlocked 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium'}
                                  ${isActive ? 'opacity-50 cursor-wait' : ''}
                                `}
                              >
                                {isBlocked ? <Lock size={14}/> : <><MousePointer2 size={14}/>构建</>}
                              </button>
                            )}
                            
                            {!isDone && !isActive && (
                              <button 
                                onClick={() => handleDeleteIssue(issue.id)} 
                                className="text-gray-300 hover:text-red-400"
                                disabled={loading}
                              >
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };
                  
                  return (
                    <>
                      {/* 待处理 */}
                      {openIssues.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            待处理 ({openIssues.length})
                          </div>
                          {openIssues.map(renderIssue)}
                        </div>
                      )}
                      
                      {/* 处理过 */}
                      {doneIssues.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
                            <CheckCircle size={12} className="text-green-600"/>
                            处理过 ({doneIssues.length})
                          </div>
                          {doneIssues.map(renderIssue)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
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

      {/* 有架构后显示加载状态 */}
      {hasArchitecture && loading && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="font-medium">正在生成下一轮架构演进...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
