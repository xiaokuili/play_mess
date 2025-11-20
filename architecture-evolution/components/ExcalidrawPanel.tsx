'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Theme } from '@excalidraw/excalidraw/types/element/types';

import { useColorScheme } from '@/lib/hooks/useColorScheme';

const ExcalidrawPrimitive = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
    ssr: false,
});

interface ExcalidrawProps {
    shouldLoad?: boolean;
}

const Excalidraw = ({ shouldLoad = false }: ExcalidrawProps) => {
    const { theme } = useColorScheme();
    const [initialData, setInitialData] = useState<any>(null);

    useEffect(() => {
        // 只有当 shouldLoad 为 true 时才加载数据
        if (!shouldLoad) {
            return;
        }

        // 加载示例 Excalidraw 数据
        const loadExampleData = async () => {
            try {
                const response = await fetch('/api/excalidraw/load-example');
                if (response.ok) {
                    const data = await response.json();
                    // 确保数据格式正确，包含 elements 和 appState
                    setInitialData({
                        elements: data.elements || [],
                        appState: {
                            viewBackgroundColor: data.appState?.viewBackgroundColor || '#ffffff',
                            currentItemFontFamily: data.appState?.currentItemFontFamily || 1,
                            ...data.appState,
                        },
                    });
                } else {
                    // 如果加载失败，使用默认数据
                    setInitialData({
                        appState: {
                            viewBackgroundColor: '#ffffff',
                            currentItemFontFamily: 1,
                        },
                        elements: [],
                    });
                }
            } catch (error) {
                console.error('Failed to load example data:', error);
                // 使用默认数据
                setInitialData({
                    appState: {
                        viewBackgroundColor: '#ffffff',
                        currentItemFontFamily: 1,
                    },
                    elements: [],
                });
            }
        };

        loadExampleData();
    }, [shouldLoad]);

    // 如果还没有触发加载，显示提示信息
    if (!shouldLoad) {
        return (
            <div className="relative h-full overflow-hidden flex items-center justify-center">
                <div className="text-gray-500">请在左侧输入框中输入需求并点击发送按钮</div>
            </div>
        );
    }

    // 如果数据还没加载完成，显示加载状态
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
