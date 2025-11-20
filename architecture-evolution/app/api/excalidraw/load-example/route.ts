import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * 加载示例 Excalidraw JSON 文件
 * 从 v1/output.excalidraw.json 读取文件
 */
export async function GET() {
  try {
    // 获取项目根目录
    const projectRoot = process.cwd();
    // 构建文件路径：从 architecture-evolution 目录到 v1/output.excalidraw.json
    const filePath = join(projectRoot, '..', 'v1', 'output.excalidraw.json');
    
    // 读取文件
    const fileContent = await readFile(filePath, 'utf-8');
    const excalidrawData = JSON.parse(fileContent);
    
    return NextResponse.json(excalidrawData);
  } catch (error) {
    console.error('Error loading example Excalidraw file:', error);
    return NextResponse.json(
      { error: 'Failed to load example file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

