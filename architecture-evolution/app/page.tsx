'use client';

/**
 * 主页面组件
 * 
 * 功能说明：
 * 1. 管理架构演进的全局状态（rounds 数组）
 * 2. 协调 ChatPanel 和 ExcalidrawPanel 之间的数据流
 * 3. 将当前的 ArchitectureData 传递给 ExcalidrawPanel
 * 
 * 数据流：
 * ChatPanel -> rounds (ArchitectureData[]) -> 当前选中的 ArchitectureData -> ExcalidrawPanel
 * 
 * 注意：
 * - ExcalidrawPanel 直接从 ArchitectureData.output 获取 Excalidraw 数据
 * - 不再需要 ExcalidrawFile 中间层
 */

import { useState, useEffect } from 'react';
import ChatPanel from '@/components/ChatPanel';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import Excalidraw from '@/components/ExcalidrawPanel';

export default function Home() {
  // ==================== 状态管理 ====================
  
  /** 当前选中的架构数据，传递给 ExcalidrawPanel */
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureData | null>(null);
  /** 所有架构演进的轮次数组 */
  const [rounds, setRounds] = useState<ArchitectureData[]>([]);
  /** 当前选中的轮次索引 */
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(-1);

  // ==================== 副作用处理 ====================

  /**
   * 当 rounds 或 currentRoundIndex 变化时，更新 currentArchitecture
   * 
   * 这样 ExcalidrawPanel 就能获取到当前选中的架构数据
   */
  useEffect(() => {
    if (currentRoundIndex >= 0 && currentRoundIndex < rounds.length) {
      // 从 rounds 数组中获取当前选中的 ArchitectureData
      const selectedArchitecture = rounds[currentRoundIndex];
      setCurrentArchitecture(selectedArchitecture);
    } else {
      setCurrentArchitecture(null);
    }
  }, [currentRoundIndex, rounds]);

  // ==================== 事件处理函数 ====================

  /**
   * 处理架构数据更新
   * 
   * 当 ChatPanel 生成新的架构数据时，会调用这个函数
   * 
   * @param newRounds 新的架构演进轮次数组
   * @param autoSelectIndex 自动选中的索引（如果提供，则选中该索引；否则如果是初始生成，选中第一个）
   */
  const handleArchitectureUpdate = (newRounds: ArchitectureData[], autoSelectIndex?: number) => {
    setRounds(newRounds);
    // 如果有新数据，根据参数决定选中哪个索引
    if (newRounds.length > 0) {
      if (autoSelectIndex !== undefined) {
        // 如果指定了索引，使用指定的索引（用于演进时跳转到新轮次）
        setCurrentRoundIndex(autoSelectIndex);
      } else if (currentRoundIndex === -1 || rounds.length === 0) {
        // 如果是初始生成（当前没有轮次），选中第一个
        setCurrentRoundIndex(0);
      }
      // 否则保持当前选中的索引（不自动切换）
    }
  };

  /**
   * 处理轮次切换
   * 
   * 当用户在 ChatPanel 中切换轮次时，会调用这个函数
   * 
   * @param index 要切换到的轮次索引
   */
  const handleRoundChange = (index: number) => {
    if (index >= 0 && index < rounds.length) {
      setCurrentRoundIndex(index);
    }
  };

  // ==================== 渲染 ====================

  return (
    <div className="flex h-screen">
      {/* 左侧聊天面板 */}
      <div className="w-1/3 border-r border-gray-300 flex flex-col">
        <ChatPanel
          onArchitectureUpdate={handleArchitectureUpdate}
          rounds={rounds}
          currentRoundIndex={currentRoundIndex}
          onRoundChange={handleRoundChange}
        />
      </div>
      
      {/* 右侧 Excalidraw 面板 */}
      <div className="flex-1 flex flex-col">
        {/* 
          ExcalidrawPanel 接收当前的 ArchitectureData
          它会从 architectureData.output 获取 Excalidraw 数据并渲染
        */}
        <Excalidraw architectureData={currentArchitecture} />
      </div>
    </div>
  );
}
