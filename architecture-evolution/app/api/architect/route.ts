import { NextRequest, NextResponse } from 'next/server';
import { EVOLUTIONARY_ARCHITECT_PROMPT } from '@/lib/prompt';

/**
 * 架构演进 API 路由
 * 
 * 功能说明：
 * 1. 接收用户输入、当前架构状态、要解决的 issue
 * 2. 调用 LLM 生成新的架构演进方案
 * 3. 返回 ArchitectureData 数组（不包含 lifecycle 和 output，由前端处理）
 * 
 * 工作流程：
 * - 初始阶段：userInput 有值，currentArchitecture 为 null，生成多轮初始架构
 * - 演进阶段：userInput 为原始需求，currentArchitecture 为最后一个版本，issueBacklog 为要解决的 issue，生成 1 轮新版本
 * 
 * 注意：
 * - 返回的数据不包含 lifecycle 和 output 字段
 * - ChatPanel 会使用 createArchitectureData 自动添加这些字段
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userInput, currentArchitecture, issueBacklog, maxRounds = 3 } = body;

    // 构建提示词
    const systemPrompt = EVOLUTIONARY_ARCHITECT_PROMPT;
    const userPrompt = `
原始需求: ${userInput}

当前架构状态:
${JSON.stringify(currentArchitecture || {}, null, 2)}

当前问题清单 (Issue_Backlog):
${JSON.stringify(issueBacklog || ["实现核心业务功能"], null, 2)}

请生成前 ${maxRounds} 轮的架构演进过程。每一轮需要输出：
1. Current_Architecture (符合上述 JSON 格式)
2. Issue_Backlog (下一轮要解决的问题)

请以 JSON 格式返回，格式如下：
{
  "rounds": [
    {
      "round_id": 1,
      "round_title": "...",
      "decision_rationale": "...",
      "architecture": { ... },
      "evolution_tracking": { ... }
    },
    ...
  ],
  "final_backlog": [...]
}
`;

    // 调用 LLM API
    // 注意：这里需要配置你的 LLM API (OpenAI, Anthropic, 或其他)
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    
    if (!apiKey) {
      // 如果没有配置 API Key，返回模拟数据用于测试
      const mockRounds = generateMockRounds(userInput, maxRounds, issueBacklog);
      const finalBacklog = mockRounds.length > 0 
        ? (mockRounds[mockRounds.length - 1].evolution_tracking?.new_backlog || [])
        : [];
      return NextResponse.json({
        rounds: mockRounds,
        final_backlog: finalBacklog
      });
    }

    // 实际调用 LLM
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // 解析 JSON 响应
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // 如果解析失败，尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse LLM response as JSON');
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Architect API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 生成模拟数据（用于测试，当没有配置 API Key 时）
 * 
 * 注意：
 * - 返回的数据不包含 lifecycle 和 output 字段
 * - ChatPanel 会使用 createArchitectureData 自动添加这些字段
 * 
 * @param userInput 用户输入的原始需求
 * @param maxRounds 要生成的轮次数
 * @param issueBacklog 初始问题列表
 * @returns 架构演进轮次数组（不包含 lifecycle 和 output）
 */
function generateMockRounds(userInput: string, maxRounds: number, issueBacklog?: string[]) {
  const rounds = [];
  const initialBacklog = issueBacklog || ['实现核心业务功能'];
  
  for (let i = 1; i <= maxRounds; i++) {
    const currentIssue = i === 1 ? initialBacklog[0] : (i === 2 ? '数据库读压力过大' : 'Redis 单点故障风险');
    rounds.push({
      round_id: i,
      round_title: i === 1 ? "实现核心业务功能" : i === 2 ? "引入缓存层" : "解决单点故障",
      decision_rationale: i === 1 
        ? "实现基本的业务逻辑和数据库存储"
        : i === 2
        ? "为了缓解数据库读压力，引入 Redis 缓存层"
        : "通过主从复制和负载均衡解决单点故障",
      architecture: {
        nodes: [
          {
            id: "client",
            label: "Web Client",
            tech_stack: "React/TypeScript",
            type: "client",
            status: i === 1 ? "new" : "stable",
            description: "前端应用",
            alerts: []
          },
          {
            id: "api_server",
            label: "API Server",
            tech_stack: "Python/FastAPI",
            type: "service",
            status: i === 1 ? "new" : i === 2 ? "modified" : "stable",
            description: "业务逻辑处理",
            alerts: i === 2 ? ["QPS 可能达到瓶颈"] : []
          },
          ...(i >= 2 ? [{
            id: "redis",
            label: "Redis Cache",
            tech_stack: "Redis 6.0",
            type: "cache",
            status: i === 2 ? "new" : "stable",
            description: "缓存层",
            alerts: i === 2 ? ["单点故障风险"] : []
          }] : []),
          {
            id: "database",
            label: "PostgreSQL",
            tech_stack: "PostgreSQL 14",
            type: "database",
            status: "stable",
            description: "主数据库",
            alerts: []
          }
        ],
        edges: [
          {
            source: "client",
            target: "api_server",
            label: "HTTP Request",
            interaction: "sync"
          },
          ...(i >= 2 ? [{
            source: "api_server",
            target: "redis",
            label: "Cache Read",
            interaction: "sync"
          }] : []),
          {
            source: "api_server",
            target: "database",
            label: "DB Query",
            interaction: "sync"
          }
        ]
      },
      evolution_tracking: {
        solved_issues: i === 1 
          ? [initialBacklog[0] || "实现核心业务功能"]
          : i === 2
          ? ["数据库读压力过大"]
          : ["Redis 单点故障风险"],
        new_backlog: i === 1
          ? ["数据库读压力过大"]
          : i === 2
          ? ["Redis 单点故障风险", "缓存一致性需要处理"]
          : ["缓存一致性需要处理", "监控和告警系统"]
      }
    });
  }
  
  return rounds;
}

