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
      "round_title": "...",
      "decision_rationale": "...",
      "solution_description": "...", // 详细阐述这一轮架构演进的具体实施方案和为什么这样做可以解决问题
      "architecture": { ... },
      "evolution_tracking": {
        "solved_issues": [...],
        "new_backlog": [...]
      }
    }
  ],
  "final_backlog": [...]
}
`;

    // 调用阿里云通义千问 LLM API
    // Qwen API 使用兼容 OpenAI 的接口格式
    const isMock = false;
    const apiKey = process.env.QWEN_LLM_API_KEY || 'sk-919c7bdd1b59457fa93d705c950c53d3';
    const baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const apiUrl = `${baseUrl}/chat/completions`;
    
    if (isMock) {
      // 如果没有配置 API Key，返回模拟数据用于测试
      const mockRounds = generateMockRounds(userInput, maxRounds, issueBacklog, currentArchitecture);
      const finalBacklog = mockRounds.length > 0 
        ? (mockRounds[mockRounds.length - 1].evolution_tracking?.new_backlog || [])
        : [];
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
        model: process.env.LLM_MODEL || 'qwen-plus-latest',
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
    let roundTitle, decisionRationale, solutionDescription, architecture, solvedIssues, newBacklog;
    
    if (isInitial || roundId === 1) {
      // 第一轮：实现核心业务功能
      roundTitle = "实现核心业务功能";
      decisionRationale = "实现基本的业务逻辑和数据库存储";
      solutionDescription = "本轮实施方案：\n1. 创建 Web Client 前端应用，使用 React/TypeScript 技术栈\n2. 部署 API Server 后端服务，使用 Python/FastAPI 框架处理业务逻辑\n3. 配置 PostgreSQL 数据库用于数据持久化\n\n为什么这样做可以解决问题：\n- 采用前后端分离架构，便于独立开发和部署\n- 使用 FastAPI 框架可以快速构建高性能的 RESTful API\n- PostgreSQL 作为成熟的关系型数据库，提供 ACID 事务保证和数据一致性\n- 这个基础架构为后续演进提供了稳定的基础";
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
      solutionDescription = "本轮实施方案：\n1. 在 API Server 和数据库之间引入 Redis 缓存层\n2. 实现缓存读取策略：先查缓存，缓存未命中再查数据库\n3. 配置缓存过期时间和更新策略\n\n为什么这样做可以解决问题：\n- Redis 作为内存数据库，读取速度远快于磁盘数据库，可以显著降低数据库读压力\n- 对于热点数据，缓存命中率通常可以达到 80% 以上，大幅减少数据库查询次数\n- 通过缓存层，可以将数据库 QPS 降低 70-90%，有效解决读压力问题\n- 选择 Redis 是因为它性能优异、功能丰富，支持多种数据结构，适合各种缓存场景";
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
      solutionDescription = "本轮实施方案：\n1. 引入 Nginx 负载均衡器，实现 API Server 的高可用\n2. 部署多个 API Server 实例（至少 2 个），通过负载均衡分发请求\n3. Redis 配置主从复制，Master 负责写操作，Slave 负责读操作\n4. 实现故障自动切换机制\n\n为什么这样做可以解决问题：\n- 负载均衡可以将流量分散到多个 API Server，单个服务器故障不会影响整体服务\n- Redis 主从复制提供了数据冗余，Master 故障时可以快速切换到 Slave\n- 通过多实例部署，系统具备了水平扩展能力，可以应对更高的 QPS\n- 这种架构设计确保了系统的高可用性，单点故障不会导致服务中断";
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
      solutionDescription = `本轮实施方案：\n针对 "${selectedIssue}" 问题，我们进行了相应的架构优化和调整。\n\n为什么这样做可以解决问题：\n- 通过分析问题的根本原因，我们采取了针对性的解决方案\n- 优化后的架构能够更好地满足业务需求，提升系统性能和稳定性`;
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
      solution_description: solutionDescription,
      architecture: architecture,
      evolution_tracking: {
        solved_issues: solvedIssues,
        new_backlog: newBacklog
      }
    });
  }
  
  return rounds;
}

