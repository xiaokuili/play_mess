'use client';

/**
 * ExcalidrawPanel 组件
 * 
 * 功能说明：
 * 1. 接收当前的 ArchitectureData
 * 2. 从 ArchitectureData.output 获取 Excalidraw 数据（output.json）
 * 3. 将数据传递给 Excalidraw 组件进行渲染
 * 
 * 数据流：
 * ArchitectureData -> ArchitectureData.output (ExcalidrawData) -> Excalidraw 组件
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

import { Theme } from '@excalidraw/excalidraw/types/element/types';

import { useColorScheme } from '@/lib/hooks/useColorScheme';
import { ArchitectureData } from '@/lib/architecture-to-excalidraw';
import { getExcalidrawInitialDataFromArchitecture } from '@/lib/excalidraw-file-manager';

// 动态导入 Excalidraw 组件（因为它是客户端组件）
const ExcalidrawPrimitive = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
    ssr: false,
});

/**
 * ExcalidrawPanel 组件的 Props
 */
interface ExcalidrawProps {
    /** 当前的架构数据，如果为 null 则显示提示信息 */
    architectureData: ArchitectureData | null;
}

/**
 * ExcalidrawPanel 组件
 * 
 * 从 ArchitectureData.output 获取 Excalidraw 数据并渲染
 */
const Excalidraw = ({ architectureData }: ExcalidrawProps) => {
    const { theme } = useColorScheme();
    /** Excalidraw 组件的初始数据 */
    const [initialData, setInitialData] = useState<any>(null);
    /** 解决方案描述面板是否展开 */
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
    /** 当前数据的唯一标识，用于确保数据更新时重新渲染 */
    const [dataKey, setDataKey] = useState<string>('');

    /**
     * 当 architectureData 变化时，更新 initialData 和 dataKey
     * 
     * 数据来源：ArchitectureData.output（ExcalidrawData）
     */
    useEffect(() => {
        if (!architectureData) {
            setInitialData(null);
            setDataKey('');
            return;
        }

        // 从 ArchitectureData 获取 Excalidraw 初始数据
        // 这个函数会从 architectureData.output 获取数据，如果没有则自动生成
        const data = getExcalidrawInitialDataFromArchitecture(architectureData);
        
        // 生成唯一 key，包含 round_id、updatedAt 和 elements 数量，确保数据变化时 key 也会变化
        const elementsCount = data?.elements?.length || 0;
        const key = `${architectureData.round_id}_${architectureData.lifecycle?.updatedAt || architectureData.lifecycle?.createdAt || Date.now()}_${elementsCount}`;
        
        setInitialData(data);
        setDataKey(key);
        
        // 切换轮次时重置描述面板展开状态
        setIsDescriptionExpanded(true);
    }, [
        architectureData?.round_id,
        architectureData?.lifecycle?.updatedAt,
        architectureData?.lifecycle?.createdAt,
        architectureData?.output,
        architectureData
    ]);

    // 如果还没有架构数据，显示提示信息
    if (!architectureData) {
        return (
            <div className="relative h-full overflow-hidden flex items-center justify-center">
                <div className="text-gray-500">请在左侧输入框中输入需求并点击发送按钮</div>
            </div>
        );
    }

    // 如果数据还没准备好，显示加载状态
    if (!initialData) {
        return (
            <div className="relative h-full overflow-hidden flex items-center justify-center">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    // 渲染 Excalidraw 组件
    // initialData 来自 ArchitectureData.output
    // 使用 key 强制在 architectureData 变化时重新渲染组件
    // 这样当切换到不同轮次时，Excalidraw 会使用新的 initialData
    const decisionRationale = architectureData.decision_rationale;
    
    return (
        <div className="relative h-full overflow-hidden flex flex-col">
            {/* 决策理由面板 */}
            {decisionRationale && (
                <div className="border-b border-gray-200 bg-white shadow-sm">
                    <button
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Info size={18} className="text-blue-600" />
                            <span className="font-semibold text-gray-800">
                                第 {architectureData.round_id} 轮：{architectureData.round_title}
                            </span>
                        </div>
                        {isDescriptionExpanded ? (
                            <ChevronUp size={20} className="text-gray-500" />
                        ) : (
                            <ChevronDown size={20} className="text-gray-500" />
                        )}
                    </button>
                    {isDescriptionExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {decisionRationale}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Excalidraw 画布 */}
            <div className="flex-1 relative overflow-hidden">
                {initialData && (
                    <ExcalidrawPrimitive
                        key={dataKey || architectureData.round_id}
                        initialData={initialData}
                        theme={theme as Theme}
                    />
                )}
            </div>
        </div>
    );
};

export default Excalidraw;
