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

    /**
     * 当 architectureData 变化时，更新 initialData
     * 
     * 数据来源：ArchitectureData.output（ExcalidrawData）
     */
    useEffect(() => {
        // 从 ArchitectureData 获取 Excalidraw 初始数据
        // 这个函数会从 architectureData.output 获取数据，如果没有则自动生成
        const data = getExcalidrawInitialDataFromArchitecture(architectureData);
        setInitialData(data);
    }, [architectureData]);

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
    return (
        <div className="relative h-full overflow-hidden">
            <ExcalidrawPrimitive
                initialData={initialData}
                theme={theme as Theme}
            />
        </div>
    );
};

export default Excalidraw;
