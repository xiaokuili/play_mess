'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Theme } from '@excalidraw/excalidraw/types/element/types';

import { useColorScheme } from '@/lib/hooks/useColorScheme';
import { ExcalidrawFile, getExcalidrawInitialData } from '@/lib/excalidraw-file-manager';

const ExcalidrawPrimitive = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
    ssr: false,
});

interface ExcalidrawProps {
    excalidrawFile: ExcalidrawFile | null;
}

const Excalidraw = ({ excalidrawFile }: ExcalidrawProps) => {
    const { theme } = useColorScheme();
    const [initialData, setInitialData] = useState<any>(null);

    useEffect(() => {
        // 从 Excalidraw 文件获取初始数据
        const data = getExcalidrawInitialData(excalidrawFile);
        setInitialData(data);
    }, [excalidrawFile]);

    // 如果还没有文件，显示提示信息
    if (!excalidrawFile) {
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
