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
    const isInitial = !currentArchitecture;
    const nextRoundId = isInitial ? 1 : ((currentArchitecture?.round_id || 0) + 1);
    const instructionText = isInitial 
      ? `请生成第一轮的架构演进方案。需要输出：
1. Current_Architecture (符合上述 JSON 格式)
2. Issue_Backlog (下一轮要解决的问题，可以列出所有潜在问题)`
      : `请基于当前架构和要解决的问题，生成下一轮的架构演进方案。需要输出：
1. Current_Architecture (符合上述 JSON 格式)
2. Issue_Backlog (解决当前问题后，新发现的问题)`;
    
    const userPrompt = `
原始需求: ${userInput}

当前架构状态:
${JSON.stringify(currentArchitecture || {}, null, 2)}

当前问题清单 (Issue_Backlog):
${JSON.stringify(issueBacklog || ["实现核心业务功能"], null, 2)}

${instructionText}

请以 JSON 格式返回，格式如下：
{
  "rounds": [
    {
      "round_id": ${nextRoundId},
      "round_title": "...", // 本轮标题，用于时间轴显示，e.g., "引入缓存层"
      "decision_rationale": "...", // 本轮决策理由，解释为什么做出这些架构决策
      "architecture": { ... }, // 架构图数据，包含节点和边的定义
      "evolution_tracking": { // 演进追踪信息，记录解决的问题和新发现的问题
        "solved_issues": [...], // 本轮解决的 Backlog 问题
        "new_backlog": [...] // 审计后发现的新问题 (输入给下一轮)
      }
    }
  ], // 架构演进轮次数组（不包含 lifecycle 和 output）
  "final_backlog": [...] // 最终问题清单，基于输入的final_backlog和每一轮的evolution_tracking.new_backlog，去重后返回
}
`;

    // 调用阿里云通义千问 LLM API
    // Qwen API 使用兼容 OpenAI 的接口格式
    const isMock = false;
    const apiKey = process.env.YUNWU_API_KEY ;
    const baseUrl = 'https://yunwu.ai/v1';
    const apiUrl = `${baseUrl}/chat/completions`;
    
    if (isMock || apiKey === undefined) {
      // 如果没有配置 API Key，返回模拟数据用于测试
      const mockRounds = generateMockRounds(userInput, maxRounds, issueBacklog, currentArchitecture);
      const finalBacklog = mockRounds.length > 0 
        ? (mockRounds[mockRounds.length - 1].evolution_tracking?.new_backlog || [])
        : [];
      console.log('mock rounds');
      return NextResponse.json({
        rounds: mockRounds,
        final_backlog: finalBacklog
      });
    }
    console.log('userPrompt', userPrompt);
    // 实际调用通义千问 LLM
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
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
 * @param maxRounds 要生成的轮次数（通常为 1，迭代是一轮一轮进行）
 * @param issueBacklog 当前要解决的问题列表
 * @param currentArchitecture 当前架构状态（如果为 null，则是初始阶段）
 * @returns 架构演进轮次数组（不包含 lifecycle 和 output）
 */
function generateMockRounds(userInput: string, maxRounds: number, issueBacklog?: string[], currentArchitecture?: any) {
  const rounds = [];
  const isInitial = !currentArchitecture;
  const currentRoundId = isInitial ? 1 : ((currentArchitecture?.round_id || 0) + 1);
  const selectedIssue = issueBacklog && issueBacklog.length > 0 ? issueBacklog[0] : '实现核心业务功能';
  
  // 只生成一轮（迭代是一轮一轮进行）
  for (let i = 0; i < maxRounds; i++) {
    const roundId = currentRoundId + i;
    
    // 根据要解决的问题和当前轮次，生成相应的架构
    let roundTitle, decisionRationale, architecture, solvedIssues, newBacklog;
    
    if (isInitial || roundId === 1) {
      // 第一轮：实现核心业务功能
      roundTitle = "实现核心业务功能";
      decisionRationale = "实现基本的业务逻辑和数据库存储";
      architecture = {
        nodes: [
          {
            id: "client",
            label: "Web Client",
            tech_stack: "React/TypeScript",
            type: "client",
            status: "new",
            description: "前端应用",
            alerts: []
          },
          {
            id: "api_server",
            label: "API Server",
            tech_stack: "Python/FastAPI",
            type: "service",
            status: "new",
            description: "业务逻辑处理",
            alerts: []
          },
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
          {
            source: "api_server",
            target: "database",
            label: "DB Query",
            interaction: "sync"
          }
        ]
      };
      solvedIssues = [selectedIssue];
      newBacklog = ["数据库读压力过大", "API 服务器单点故障风险"];
    } else if (selectedIssue.includes("数据库读压力") || selectedIssue.includes("缓存")) {
      // 第二轮：引入缓存层
      roundTitle = "引入缓存层";
      decisionRationale = "为了缓解数据库读压力，引入 Redis 缓存层";
      architecture = {
        nodes: [
          {
            id: "client",
            label: "Web Client",
            tech_stack: "React/TypeScript",
            type: "client",
            status: "stable",
            description: "前端应用",
            alerts: []
          },
          {
            id: "api_server",
            label: "API Server",
            tech_stack: "Python/FastAPI",
            type: "service",
            status: "modified",
            description: "业务逻辑处理",
            alerts: ["QPS 可能达到瓶颈"]
          },
          {
            id: "redis",
            label: "Redis Cache",
            tech_stack: "Redis 6.0",
            type: "cache",
            status: "new",
            description: "缓存层",
            alerts: ["单点故障风险"]
          },
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
          {
            source: "api_server",
            target: "redis",
            label: "Cache Read",
            interaction: "sync"
          },
          {
            source: "api_server",
            target: "database",
            label: "DB Query",
            interaction: "sync"
          }
        ]
      };
      solvedIssues = [selectedIssue];
      newBacklog = ["Redis 单点故障风险", "缓存一致性需要处理"];
    } else if (selectedIssue.includes("单点故障") || selectedIssue.includes("Redis")) {
      // 第三轮：解决单点故障
      roundTitle = "解决单点故障";
      decisionRationale = "通过主从复制和负载均衡解决单点故障";
      architecture = {
        nodes: [
          {
            id: "client",
            label: "Web Client",
            tech_stack: "React/TypeScript",
            type: "client",
            status: "stable",
            description: "前端应用",
            alerts: []
          },
          {
            id: "load_balancer",
            label: "Load Balancer",
            tech_stack: "Nginx",
            type: "service",
            status: "new",
            description: "负载均衡器",
            alerts: []
          },
          {
            id: "api_server_1",
            label: "API Server 1",
            tech_stack: "Python/FastAPI",
            type: "service",
            status: "stable",
            description: "业务逻辑处理",
            alerts: []
          },
          {
            id: "api_server_2",
            label: "API Server 2",
            tech_stack: "Python/FastAPI",
            type: "service",
            status: "stable",
            description: "业务逻辑处理",
            alerts: []
          },
          {
            id: "redis_master",
            label: "Redis Master",
            tech_stack: "Redis 6.0",
            type: "cache",
            status: "stable",
            description: "缓存主节点",
            alerts: []
          },
          {
            id: "redis_slave",
            label: "Redis Slave",
            tech_stack: "Redis 6.0",
            type: "cache",
            status: "new",
            description: "缓存从节点",
            alerts: []
          },
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
            target: "load_balancer",
            label: "HTTP Request",
            interaction: "sync"
          },
          {
            source: "load_balancer",
            target: "api_server_1",
            label: "Load Balance",
            interaction: "sync"
          },
          {
            source: "load_balancer",
            target: "api_server_2",
            label: "Load Balance",
            interaction: "sync"
          },
          {
            source: "api_server_1",
            target: "redis_master",
            label: "Cache Read",
            interaction: "sync"
          },
          {
            source: "api_server_2",
            target: "redis_master",
            label: "Cache Read",
            interaction: "sync"
          },
          {
            source: "redis_master",
            target: "redis_slave",
            label: "Replication",
            interaction: "async"
          },
          {
            source: "api_server_1",
            target: "database",
            label: "DB Query",
            interaction: "sync"
          },
          {
            source: "api_server_2",
            target: "database",
            label: "DB Query",
            interaction: "sync"
          }
        ]
      };
      solvedIssues = [selectedIssue];
      newBacklog = ["缓存一致性需要处理", "监控和告警系统"];
    } else {
      // 默认情况：基于当前架构进行演进
      roundTitle = `解决: ${selectedIssue}`;
      decisionRationale = `针对 "${selectedIssue}" 进行架构优化`;
      architecture = currentArchitecture?.architecture || {
        nodes: [],
        edges: []
      };
      solvedIssues = [selectedIssue];
      newBacklog = ["需要进一步优化"];
    }
    
    rounds.push({
      round_id: roundId,
      round_title: roundTitle,
      decision_rationale: decisionRationale,
      architecture: architecture,
      evolution_tracking: {
        solved_issues: solvedIssues,
        new_backlog: newBacklog
      }
    });
  }
  
  return rounds;
}

