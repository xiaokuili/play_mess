'use client';

import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import   Excalidraw  from '@/components/ExcalidrawPanel';


export default function Home() {
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureData | null>(null);
  const [rounds, setRounds] = useState<ArchitectureData[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(-1);
  const [shouldRenderExcalidraw, setShouldRenderExcalidraw] = useState<boolean>(false);

  const handleArchitectureUpdate = (newRounds: ArchitectureData[]) => {
    setRounds(newRounds);
    if (newRounds.length > 0) {
      setCurrentRoundIndex(0);
      setCurrentArchitecture(newRounds[0]);
      // 当有架构数据时，触发 Excalidraw 渲染
      setShouldRenderExcalidraw(true);
    }
  };

  const handleRoundChange = (index: number) => {
    if (index >= 0 && index < rounds.length) {
      setCurrentRoundIndex(index);
      setCurrentArchitecture(rounds[index]);
    }
  };


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
        <Excalidraw shouldLoad={shouldRenderExcalidraw} />
      </div>
    </div>
  );
}
