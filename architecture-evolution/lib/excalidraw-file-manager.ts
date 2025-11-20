/**
 * Excalidraw 文件管理模块
 * 
 * 注意：现在 ArchitectureData 已经包含了 output 字段（ExcalidrawData），
 * 所以这个模块主要用于向后兼容和提供便捷函数。
 * 
 * 推荐直接使用 ArchitectureData.output 来获取 Excalidraw 数据。
 */

import { ArchitectureData, ExcalidrawData, convert_architecture_to_excalidraw } from './architecture-to-excalidraw';

/**
 * Excalidraw 文件对象类型（向后兼容）
 * 现在 ArchitectureData 已经包含了 output 字段，这个类型主要用于兼容旧代码
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
 * 从架构数据创建 Excalidraw 文件（向后兼容函数）
 * 
 * 注意：如果 ArchitectureData 已经有 output 字段，直接使用它；
 * 否则，自动生成 Excalidraw 数据。
 */
export function createExcalidrawFile(architectureData: ArchitectureData): ExcalidrawFile {
  // 如果 ArchitectureData 已经有 output 字段，直接使用
  // 否则，自动生成
  const excalidrawData = architectureData.output || convert_architecture_to_excalidraw(architectureData);
  
  return {
    id: `excalidraw_${architectureData.round_id}_${Date.now()}`,
    architectureData,
    excalidrawData,
    createdAt: architectureData.lifecycle?.createdAt || Date.now(),
    roundId: architectureData.round_id,
    roundTitle: architectureData.round_title,
  };
}

/**
 * 从多个架构数据创建多个 Excalidraw 文件（向后兼容函数）
 */
export function createExcalidrawFiles(architectureRounds: ArchitectureData[]): ExcalidrawFile[] {
  return architectureRounds.map(createExcalidrawFile);
}

/**
 * 从 ArchitectureData 获取 Excalidraw 初始数据
 * 
 * 这是推荐使用的方法：直接从 ArchitectureData.output 获取数据
 * 
 * @param architectureData 架构数据对象
 * @returns Excalidraw 组件需要的 initialData 格式，如果数据不存在则返回 null
 */
export function getExcalidrawInitialDataFromArchitecture(architectureData: ArchitectureData | null): any {
  if (!architectureData) {
    return null;
  }

  // 优先使用 ArchitectureData.output，如果没有则尝试生成
  const excalidrawData = architectureData.output || convert_architecture_to_excalidraw(architectureData);

  return {
    elements: excalidrawData.elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemFontFamily: 1,
    },
  };
}

/**
 * 获取 Excalidraw 文件用于渲染的格式（向后兼容函数）
 * 返回 Excalidraw 组件需要的 initialData 格式
 * 
 * @deprecated 推荐使用 getExcalidrawInitialDataFromArchitecture 直接传入 ArchitectureData
 */
export function getExcalidrawInitialData(file: ExcalidrawFile | null): any {
  if (!file) {
    return null;
  }

  return getExcalidrawInitialDataFromArchitecture(file.architectureData);
}

