'use client';

/**
 * Loading 组件
 * 
 * 用于显示加载状态的通用组件
 */

interface LoadingProps {
  /** 加载提示文本 */
  message?: string;
  /** 颜色主题，默认为 gray */
  color?: 'gray' | 'yellow' | 'blue';
  /** 是否显示在容器中（带背景和边框），默认为 false */
  inContainer?: boolean;
}

export default function Loading({ 
  message = '加载中...', 
  color = 'gray',
  inContainer = false 
}: LoadingProps) {
  const colorClasses = {
    gray: 'bg-gray-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500'
  };

  const containerClasses = inContainer 
    ? 'bg-yellow-50 border border-yellow-200 p-3 rounded-lg'
    : '';

  const textColorClasses = inContainer
    ? 'text-yellow-800'
    : '';

  const dotColor = colorClasses[color];

  const content = (
    <div className={`flex items-center gap-2 ${textColorClasses}`}>
      <div className="flex gap-1">
        <div 
          className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} 
          style={{ animationDelay: '0ms' }}
        ></div>
        <div 
          className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} 
          style={{ animationDelay: '150ms' }}
        ></div>
        <div 
          className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} 
          style={{ animationDelay: '300ms' }}
        ></div>
      </div>
      {message && <span className="font-medium">{message}</span>}
    </div>
  );

  if (inContainer) {
    return <div className={containerClasses}>{content}</div>;
  }

  return content;
}

