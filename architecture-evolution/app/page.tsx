'use client';

import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import   Excalidraw  from '@/components/ExcalidrawPanel';


export default function Home() {
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureData | null>(null);
  const [rounds, setRounds] = useState<ArchitectureData[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(-1);

  const handleArchitectureUpdate = (newRounds: ArchitectureData[]) => {
    setRounds(newRounds);
    if (newRounds.length > 0) {
      setCurrentRoundIndex(0);
      setCurrentArchitecture(newRounds[0]);
    }
  };

  const handleRoundChange = (index: number) => {
    if (index >= 0 && index < rounds.length) {
      setCurrentRoundIndex(index);
      setCurrentArchitecture(rounds[index]);
    }
  };

  // return (
  //   <div className="flex h-screen w-screen overflow-hidden">
  //     {/* 左侧聊天面板 */}
  //     <div className="w-1/2 border-r border-gray-300 flex flex-col">
  //       <ChatPanel 
  //         onArchitectureUpdate={handleArchitectureUpdate}
  //         rounds={rounds}
  //         currentRoundIndex={currentRoundIndex}
  //         onRoundChange={handleRoundChange}
  //       />
  //     </div>

  //     {/* 右侧 Excalidraw 展示面板 */}
  //     <div className="w-1/2 flex flex-col">
      <Excalidraw />
  //     </div>
  //   </div>
  // );
  return <Excalidraw />;
}
