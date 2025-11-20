'use client';

import { useState, useEffect } from 'react';
import ChatPanel from '@/components/ChatPanel';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import { ExcalidrawFile } from '@/lib/excalidraw-file-manager';
import Excalidraw from '@/components/ExcalidrawPanel';


export default function Home() {
  const [currentArchitecture, setCurrentArchitecture] = useState<ArchitectureData | null>(null);
  const [rounds, setRounds] = useState<ArchitectureData[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(-1);
  const [excalidrawFiles, setExcalidrawFiles] = useState<ExcalidrawFile[]>([]);
  const [currentExcalidrawFile, setCurrentExcalidrawFile] = useState<ExcalidrawFile | null>(null);

  // 当 rounds 或 excalidrawFiles 更新时，同步更新当前选中的文件
  useEffect(() => {
    if (currentRoundIndex >= 0 && currentRoundIndex < excalidrawFiles.length) {
      setCurrentExcalidrawFile(excalidrawFiles[currentRoundIndex]);
    }
    if (currentRoundIndex >= 0 && currentRoundIndex < rounds.length) {
      setCurrentArchitecture(rounds[currentRoundIndex]);
    }
  }, [currentRoundIndex, excalidrawFiles, rounds]);

  const handleArchitectureUpdate = (newRounds: ArchitectureData[]) => {
    setRounds(newRounds);
    if (newRounds.length > 0) {
      setCurrentRoundIndex(0);
    }
  };

  const handleExcalidrawFileUpdate = (files: ExcalidrawFile[]) => {
    setExcalidrawFiles(files);
    if (files.length > 0) {
      setCurrentRoundIndex(0);
    }
  };

  const handleRoundChange = (index: number) => {
    if (index >= 0 && index < rounds.length && index < excalidrawFiles.length) {
      setCurrentRoundIndex(index);
    }
  };


  return (
    <div className="flex h-screen">
      {/* 左侧聊天面板 */}
      <div className="w-1/3 border-r border-gray-300 flex flex-col">
        <ChatPanel
          onArchitectureUpdate={handleArchitectureUpdate}
          onExcalidrawFileUpdate={handleExcalidrawFileUpdate}
          rounds={rounds}
          currentRoundIndex={currentRoundIndex}
          onRoundChange={handleRoundChange}
        />
      </div>
      
      {/* 右侧 Excalidraw 面板 */}
      <div className="flex-1 flex flex-col">
        <Excalidraw excalidrawFile={currentExcalidrawFile} />
      </div>
    </div>
  );
}
