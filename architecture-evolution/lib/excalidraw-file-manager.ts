/**
 * Excalidraw 文件管理模块
 * 负责管理架构数据到 Excalidraw 文件的转换和存储
 */

import { ArchitectureData, ExcalidrawData, convert_architecture_to_excalidraw } from './architecture-to-excalidraw';

/**
 * Excalidraw 文件对象类型
 * 包含 Excalidraw 数据和相关的元信息
 */
export interface ExcalidrawFile {
  id: string;
  architectureData: ArchitectureData;
  excalidrawData: ExcalidrawData;
  createdAt: number;
  roundId: number;
  roundTitle: string;
}

/**
 * 从架构数据创建 Excalidraw 文件
 */
export function createExcalidrawFile(architectureData: ArchitectureData): ExcalidrawFile {
  const excalidrawData = convert_architecture_to_excalidraw(architectureData);
  
  return {
    id: `excalidraw_${architectureData.round_id}_${Date.now()}`,
    architectureData,
    excalidrawData,
    createdAt: Date.now(),
    roundId: architectureData.round_id,
    roundTitle: architectureData.round_title,
  };
}

/**
 * 从多个架构数据创建多个 Excalidraw 文件
 */
export function createExcalidrawFiles(architectureRounds: ArchitectureData[]): ExcalidrawFile[] {
  return architectureRounds.map(createExcalidrawFile);
}

/**
 * 获取 Excalidraw 文件用于渲染的格式
 * 返回 Excalidraw 组件需要的 initialData 格式
 */
export function getExcalidrawInitialData(file: ExcalidrawFile | null): any {
  if (!file) {
    return null;
  }

  return {
    elements: file.excalidrawData.elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
    },
  };
}

