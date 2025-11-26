/**
 * 架构数据转 Excalidraw JSON 转换器 (TypeScript 版本)
 * 
 * 将 Current_Architecture 数据结构转换为 Excalidraw 可渲染的 JSON 格式
 * 包含两个核心模块：
 * 1. Layout - 负责节点位置计算和布局算法
 * 2. Style - 负责样式映射（颜色、形状、线型等）
 */

// ==================== 类型定义 ====================

/**
 * 节点位置信息
 * 用于布局计算和渲染定位
 */
export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  center_x: number;
  center_y: number;
}

/**
 * 架构节点接口
 * 表示架构图中的一个组件（如服务、数据库、缓存等）
 */
export interface ArchitectureNode {
  /** 节点的唯一标识符 */
  id: string;
  /** 节点的显示名称 */
  label: string;
  /** 技术栈信息，如 "Python/FastAPI" */
  tech_stack?: string;
  /** 节点类型，决定在 Excalidraw 中的形状和图标 */
  type: "client" | "gateway" | "service" | "database" | "cache" | "queue" | "third_party";
  /** 节点状态，决定颜色：new（绿色）、modified（黄色）、stable（灰色） */
  status: "new" | "modified" | "stable";
  /** 节点的描述信息 */
  description?: string;
  /** 节点上的警告信息列表，用于显示风险或局限性 */
  alerts?: string[];
}

/**
 * 架构边接口
 * 表示架构图中两个节点之间的连接关系
 */
export interface ArchitectureEdge {
  /** 源节点的 ID */
  source: string;
  /** 目标节点的 ID */
  target: string;
  /** 边的标签，显示在连接线上 */
  label?: string;
  /** 交互方式：sync（同步，实线）或 async（异步，虚线） */
  interaction: "sync" | "async";
}

/**
 * 架构数据的生命周期状态
 * 用于追踪架构演进的不同阶段
 */
export interface ArchitectureLifecycle {
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** 当前状态：draft（草稿）、active（活跃）、archived（已归档） */
  status: 'draft' | 'active' | 'archived';
  /** 版本号，用于版本控制 */
  version: number;
}

/**
 * 架构数据接口
 * 表示一轮架构演进的完整信息，包含架构图数据和演进追踪
 */
export interface ArchitectureData {
  /** 轮次 ID，从 1 开始递增 */
  round_id: number;
  /** 本轮次标题，用于显示在时间轴上 */
  round_title: string;
  /** 决策理由，解释为什么做出这些架构决策 */
  decision_rationale?: string;
  /** 架构图数据，包含节点和边的定义 */
  architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  /** 演进追踪信息，记录解决的问题和新发现的问题 */
  evolution_tracking?: {
    solved_issues?: string[];
    new_backlog?: string[];
  };
  /** 生命周期对象，用于管理架构数据的创建、更新和状态 */
  lifecycle: ArchitectureLifecycle;
  /** 当前轮次的 Excalidraw 输出数据（output.json）
   * 这个字段存储了将架构数据转换为 Excalidraw 格式后的 JSON 数据
   * 可以直接用于 Excalidraw 组件渲染
   */
  output?: ExcalidrawData;
}

/**
 * Excalidraw 元素接口
 * 表示 Excalidraw 画布中的一个元素（如矩形、文本、箭头等）
 */
export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any;
}

/**
 * Excalidraw 数据接口
 * 这是 ArchitectureData.output 的类型，表示完整的 Excalidraw 画布数据
 * 可以直接传递给 Excalidraw 组件进行渲染
 */
export interface ExcalidrawData {
  type: string;
  version: number;
  source: string;
  elements: ExcalidrawElement[];
}

// ==================== Style 模块 ====================

class StyleConfig {
  // 节点类型到形状的映射
  static TYPE_TO_SHAPE: Record<string, string> = {
    client: "ellipse",
    gateway: "diamond",
    service: "rectangle",
    database: "rectangle",
    cache: "rectangle",
    queue: "rectangle",
    third_party: "rectangle"
  };

  // 节点类型到图标的映射
  static TYPE_TO_ICON: Record<string, string> = {
    client: "📱",
    gateway: "🚪",
    service: "⚙️",
    database: "🗄️",
    cache: "⚡",
    queue: "📬",
    third_party: "🔌"
  };

  // 状态到颜色的映射
  static STATUS_TO_COLOR: Record<string, { stroke: string; fill: string }> = {
    new: {
      stroke: "#2f9e44",
      fill: "#d3f9d8"
    },
    modified: {
      stroke: "#f59f00",
      fill: "#fff3bf"
    },
    stable: {
      stroke: "#868e96",
      fill: "#e9ecef"
    }
  };

  // 交互类型到线型的映射
  static INTERACTION_TO_STROKE: Record<string, { style: string; width: number }> = {
    sync: {
      style: "solid",
      width: 2
    },
    async: {
      style: "dashed",
      width: 2
    }
  };

  // 默认尺寸
  static DEFAULT_NODE_SIZE = {
    width: 200,
    height: 100
  };

  // 文本样式
  static TEXT_STYLES = {
    title: {
      fontSize: 24,
      fontFamily: 1,
      fontStyle: "bold",
      color: "#1e1e1e"
    },
    label: {
      fontSize: 16,
      fontFamily: 1,
      color: "#1e1e1e"
    },
    tech_stack: {
      fontSize: 12,
      fontFamily: 1,
      color: "#495057"
    },
    alert: {
      fontSize: 11,
      fontFamily: 1,
      color: "#c92a2a"
    }
  };
}

// ==================== Layout 模块 ====================

class LayoutEngine {
  private canvas_width: number;
  private canvas_height: number;
  private node_positions: Map<string, NodePosition>;
  private layer_spacing: number;
  private node_spacing: number;
  private margin: number;
  private is_single_layer_flag: boolean;

  constructor(canvas_width: number = 2000, canvas_height: number = 1500) {
    this.canvas_width = canvas_width;
    this.canvas_height = canvas_height;
    this.node_positions = new Map();
    this.layer_spacing = 250;
    this.node_spacing = 300;
    this.margin = 100;
    this.is_single_layer_flag = false;
  }

  calculate_layout(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): Map<string, NodePosition> {
    // 1. 构建图结构（包括反向图，用于查找入边）
    const graph = this._build_graph(nodes, edges);
    const reverse_graph = this._build_reverse_graph(nodes, edges);

    // 2. 计算层级（拓扑排序）
    const layers = this._calculate_layers(graph, nodes);

    // 检测单层情况
    this.is_single_layer_flag = layers.length === 1;

    // 3. 优化每一层内节点的顺序，减少边交叉
    const optimized_layers = this._optimize_layer_order(layers, graph, reverse_graph);

    // 4. 计算每个节点的位置
    const positions = new Map<string, NodePosition>();
    const start_y = this.margin + 150;

    for (let layer_idx = 0; layer_idx < optimized_layers.length; layer_idx++) {
      const layer_nodes = optimized_layers[layer_idx];
      const layer_y = start_y + layer_idx * this.layer_spacing;
      const layer_width = layer_nodes.length * this.node_spacing;
      const start_x = (this.canvas_width - layer_width) / 2;

      for (let node_idx = 0; node_idx < layer_nodes.length; node_idx++) {
        const node = layer_nodes[node_idx];
        const x = start_x + node_idx * this.node_spacing;
        const y = layer_y;
        const width = StyleConfig.DEFAULT_NODE_SIZE.width;
        const height = StyleConfig.DEFAULT_NODE_SIZE.height;

        positions.set(node.id, {
          x,
          y,
          width,
          height,
          center_x: x + width / 2,
          center_y: y + height / 2
        });
      }
    }

    this.node_positions = positions;
    return positions;
  }

  private _build_graph(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    nodes.forEach(node => graph.set(node.id, []));
    edges.forEach(edge => {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    });
    return graph;
  }

  private _build_reverse_graph(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): Map<string, string[]> {
    const reverse_graph = new Map<string, string[]>();
    nodes.forEach(node => reverse_graph.set(node.id, []));
    edges.forEach(edge => {
      const sources = reverse_graph.get(edge.target) || [];
      sources.push(edge.source);
      reverse_graph.set(edge.target, sources);
    });
    return reverse_graph;
  }

  private _calculate_layers(graph: Map<string, string[]>, nodes: ArchitectureNode[]): ArchitectureNode[][] {
    // 找到所有入度为0的节点（起始节点）
    const in_degree = new Map<string, number>();
    nodes.forEach(node => in_degree.set(node.id, 0));

    graph.forEach((targets, source) => {
      targets.forEach(target => {
        in_degree.set(target, (in_degree.get(target) || 0) + 1);
      });
    });

    // 从入度为0的节点开始分层
    const layers: ArchitectureNode[][] = [];
    const remaining = new Set(nodes.map(n => n.id));
    let current_layer = nodes.filter(node => (in_degree.get(node.id) || 0) === 0);

    while (current_layer.length > 0) {
      layers.push(current_layer);
      const next_layer: ArchitectureNode[] = [];

      current_layer.forEach(node => {
        remaining.delete(node.id);
        const targets = graph.get(node.id) || [];
        targets.forEach(target => {
          const degree = (in_degree.get(target) || 0) - 1;
          in_degree.set(target, degree);
          if (degree === 0 && remaining.has(target)) {
            const targetNode = nodes.find(n => n.id === target);
            if (targetNode) next_layer.push(targetNode);
          }
        });
      });

      current_layer = next_layer;
    }

    // 处理剩余节点（循环依赖等）
    if (remaining.size > 0) {
      const remaining_nodes = nodes.filter(node => remaining.has(node.id));
      layers.push(remaining_nodes);
    }

    return layers;
  }

  /**
   * 优化每一层内节点的顺序，减少边交叉
   * - 多层情况：使用重心算法（barycenter）
   * - 单层情况：使用边交叉计数优化
   */
  private _optimize_layer_order(
    layers: ArchitectureNode[][],
    graph: Map<string, string[]>,
    reverse_graph: Map<string, string[]>
  ): ArchitectureNode[][] {
    // 检测单层情况
    if (layers.length === 1) {
      return [this._optimize_single_layer(layers[0], graph)];
    }

    // 多层情况：使用重心算法
    const optimized_layers: ArchitectureNode[][] = [];
    
    for (let layer_idx = 0; layer_idx < layers.length; layer_idx++) {
      const layer_nodes = layers[layer_idx];
      
      if (layer_idx === 0 || layer_nodes.length <= 1) {
        // 第一层或只有一个节点，不需要优化
        optimized_layers.push([...layer_nodes]);
        continue;
      }

      // 计算每个节点在上一层的"重心"位置
      const node_positions_in_prev_layer = new Map<string, number>();
      optimized_layers[layer_idx - 1].forEach((node, idx) => {
        node_positions_in_prev_layer.set(node.id, idx);
      });

      // 为每个节点计算重心值（连接的源节点在上一层的平均位置）
      const node_barycenters = new Map<string, number>();
      layer_nodes.forEach(node => {
        const sources = reverse_graph.get(node.id) || [];
        if (sources.length === 0) {
          // 没有入边，使用一个很大的值，放在后面
          node_barycenters.set(node.id, 10000);
        } else {
          // 计算所有源节点在上一层的平均位置
          let sum = 0;
          let count = 0;
          sources.forEach(source_id => {
            const pos = node_positions_in_prev_layer.get(source_id);
            if (pos !== undefined) {
              sum += pos;
              count++;
            }
          });
          node_barycenters.set(node.id, count > 0 ? sum / count : 10000);
        }
      });

      // 按照重心值排序
      const sorted_nodes = [...layer_nodes].sort((a, b) => {
        const bary_a = node_barycenters.get(a.id) || 10000;
        const bary_b = node_barycenters.get(b.id) || 10000;
        return bary_a - bary_b;
      });

      optimized_layers.push(sorted_nodes);
    }

    return optimized_layers;
  }

  /**
   * 单层情况的边交叉计数优化
   * 使用贪心算法：尝试交换相邻节点，选择交叉数最少的排列
   */
  private _optimize_single_layer(
    nodes: ArchitectureNode[],
    graph: Map<string, string[]>
  ): ArchitectureNode[] {
    if (nodes.length <= 1) {
      return [...nodes];
    }

    // 构建所有边的列表
    const edges: Array<{ source: string; target: string }> = [];
    graph.forEach((targets, source) => {
      targets.forEach(target => {
        edges.push({ source, target });
      });
    });

    if (edges.length === 0) {
      return [...nodes];
    }

    // 计算边交叉数的辅助函数
    const count_crossings = (order: ArchitectureNode[]): number => {
      const node_positions = new Map<string, number>();
      order.forEach((node, idx) => {
        node_positions.set(node.id, idx);
      });

      let crossings = 0;
      for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
          const e1 = edges[i];
          const e2 = edges[j];
          const pos1_source = node_positions.get(e1.source) ?? -1;
          const pos1_target = node_positions.get(e1.target) ?? -1;
          const pos2_source = node_positions.get(e2.source) ?? -1;
          const pos2_target = node_positions.get(e2.target) ?? -1;

          // 检查两条边是否交叉
          if (
            pos1_source !== -1 && pos1_target !== -1 &&
            pos2_source !== -1 && pos2_target !== -1
          ) {
            const source_order = pos1_source < pos2_source;
            const target_order = pos1_target < pos2_target;
            if (source_order !== target_order) {
              crossings++;
            }
          }
        }
      }
      return crossings;
    };

    // 贪心优化：尝试交换相邻节点
    let best_order = [...nodes];
    let best_crossings = count_crossings(best_order);
    let improved = true;

    while (improved) {
      improved = false;
      for (let i = 0; i < best_order.length - 1; i++) {
        // 尝试交换 i 和 i+1
        const new_order = [...best_order];
        [new_order[i], new_order[i + 1]] = [new_order[i + 1], new_order[i]];
        const new_crossings = count_crossings(new_order);

        if (new_crossings < best_crossings) {
          best_order = new_order;
          best_crossings = new_crossings;
          improved = true;
        }
      }
    }

    return best_order;
  }

  get_edge_points(
    source_id: string,
    target_id: string,
    is_single_layer: boolean = false
  ): number[][] {
    const source_pos = this.node_positions.get(source_id);
    const target_pos = this.node_positions.get(target_id);

    if (!source_pos || !target_pos) {
      return [[0, 0], [0, 0]];
    }

    // 单层情况：使用折线路由（向上弯曲，避免重叠）
    if (is_single_layer) {
      const mid_y = source_pos.y - 50; // 向上弯曲 50px
      return [
        [source_pos.center_x, source_pos.y + source_pos.height], // 起点：源节点底部
        [source_pos.center_x, mid_y],                            // 中间点1：向上
        [target_pos.center_x, mid_y],                            // 中间点2：水平移动
        [target_pos.center_x, target_pos.y]                      // 终点：目标节点顶部
      ];
    }

    // 多层情况：使用直线连接
    const start_point = [source_pos.center_x, source_pos.y + source_pos.height];
    const end_point = [target_pos.center_x, target_pos.y];

    return [start_point, end_point];
  }

  is_single_layer(): boolean {
    return this.is_single_layer_flag;
  }
}

// ==================== 转换器主函数 ====================

export class ArchitectureToExcalidraw {
  private style_config: typeof StyleConfig;
  private layout_engine: LayoutEngine;
  private element_id_counter: number;

  constructor() {
    this.style_config = StyleConfig;
    this.layout_engine = new LayoutEngine();
    this.element_id_counter = 0;
  }

  private _generate_id(): string {
    this.element_id_counter += 1;
    return `element_${this.element_id_counter}`;
  }

  convert(architecture_data: ArchitectureData): ExcalidrawData {
    const elements: ExcalidrawElement[] = [];

    // 1. 添加标题
    const title_elements = this._create_title(architecture_data);
    elements.push(...title_elements);

    // 2. 计算布局
    const nodes = architecture_data.architecture.nodes;
    const edges = architecture_data.architecture.edges;
    const positions = this.layout_engine.calculate_layout(nodes, edges);
    
    // 检测是否只有一层
    const is_single_layer = this.layout_engine.is_single_layer();

    // 3. 创建节点元素
    nodes.forEach(node => {
      const position = positions.get(node.id);
      if (position) {
        const node_elements = this._create_node(node, position);
        elements.push(...node_elements);
      }
    });

    // 4. 创建边元素
    edges.forEach(edge => {
      const edge_elements = this._create_edge(edge, is_single_layer);
      if (edge_elements.length > 0) {
        elements.push(...edge_elements);
      }
    });

    // 5. 创建演进追踪信息
    if (architecture_data.evolution_tracking) {
      const tracking_elements = this._create_evolution_tracking(
        architecture_data.evolution_tracking,
        positions
      );
      elements.push(...tracking_elements);
    }

    return {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements
    };
  }

  private _create_title(data: ArchitectureData): ExcalidrawElement[] {
    const elements: ExcalidrawElement[] = [];

    // 主标题
    const title_text = `Round ${data.round_id}: ${data.round_title}`;
    const title_elem: ExcalidrawElement = {
      id: this._generate_id(),
      type: "text",
      x: 50,
      y: 20,
      width: 600,
      height: 40,
      text: title_text,
      fontSize: this.style_config.TEXT_STYLES.title.fontSize,
      fontFamily: this.style_config.TEXT_STYLES.title.fontFamily,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 32,
      strokeColor: this.style_config.TEXT_STYLES.title.color,
      fontStyle: "bold",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      seed: 1,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: 1,
      link: null,
      locked: false,
      lineHeight: 1.25
    };
    elements.push(title_elem);

    // 决策理由
    if (data.decision_rationale) {
      const rationale_elem: ExcalidrawElement = {
        id: this._generate_id(),
        type: "text",
        x: 50,
        y: 70,
        width: 800,
        height: 30,
        text: `💡 ${data.decision_rationale}`,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 20,
        strokeColor: "#495057",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
        lineHeight: 1.25
      };
      elements.push(rationale_elem);
    }

    return elements;
  }

  private _create_node(node: ArchitectureNode, position: NodePosition): ExcalidrawElement[] {
    const elements: ExcalidrawElement[] = [];

    const node_type = node.type || "service";
    const node_status = node.status || "stable";

    // 获取样式
    const shape_type = this.style_config.TYPE_TO_SHAPE[node_type] || "rectangle";
    const colors = this.style_config.STATUS_TO_COLOR[node_status] || this.style_config.STATUS_TO_COLOR.stable;
    const icon = this.style_config.TYPE_TO_ICON[node_type] || "⚙️";

    // 创建形状元素
    const shape_elem: ExcalidrawElement = {
      id: `shape_${node.id}`,
      type: shape_type,
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      strokeColor: colors.stroke,
      backgroundColor: colors.fill,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      seed: 1,
      groupIds: [],
      frameId: null,
      roundness: shape_type === "rectangle" ? { type: 3 } : { type: 2 },
      boundElements: [],
      updated: 1,
      link: null,
      locked: false
    };
    elements.push(shape_elem);

    // 创建标签文本
    const label_text = `${icon} ${node.label || node.id}`;
    const label_elem: ExcalidrawElement = {
      id: `label_${node.id}`,
      type: "text",
      x: position.x + 10,
      y: position.y + 15,
      width: position.width - 20,
      height: 25,
      text: label_text,
      fontSize: this.style_config.TEXT_STYLES.label.fontSize,
      fontFamily: this.style_config.TEXT_STYLES.label.fontFamily,
      textAlign: "center",
      verticalAlign: "top",
      baseline: 20,
      strokeColor: this.style_config.TEXT_STYLES.label.color,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      seed: 1,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: 1,
      link: null,
      locked: false,
      lineHeight: 1.25
    };
    elements.push(label_elem);

    // 创建技术栈文本
    if (node.tech_stack) {
      const tech_elem: ExcalidrawElement = {
        id: `tech_${node.id}`,
        type: "text",
        x: position.x + 10,
        y: position.y + 45,
        width: position.width - 20,
        height: 20,
        text: node.tech_stack,
        fontSize: this.style_config.TEXT_STYLES.tech_stack.fontSize,
        fontFamily: this.style_config.TEXT_STYLES.tech_stack.fontFamily,
        textAlign: "center",
        verticalAlign: "top",
        baseline: 14,
        strokeColor: this.style_config.TEXT_STYLES.tech_stack.color,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
        lineHeight: 1.25
      };
      elements.push(tech_elem);
    }

    // 创建警告文本
    if (node.alerts && node.alerts.length > 0) {
      let alert_y = position.y + 70;
      node.alerts.forEach(alert => {
        const alert_elem: ExcalidrawElement = {
          id: `alert_${node.id}_${this._generate_id()}`,
          type: "text",
          x: position.x + 10,
          y: alert_y,
          width: position.width - 20,
          height: 15,
          text: `⚠️ ${alert}`,
          fontSize: this.style_config.TEXT_STYLES.alert.fontSize,
          fontFamily: this.style_config.TEXT_STYLES.alert.fontFamily,
          textAlign: "left",
          verticalAlign: "top",
          baseline: 12,
          strokeColor: this.style_config.TEXT_STYLES.alert.color,
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          angle: 0,
          seed: 1,
          groupIds: [],
          frameId: null,
          roundness: null,
          boundElements: [],
          updated: 1,
          link: null,
          locked: false,
          lineHeight: 1.25
        };
        elements.push(alert_elem);
        alert_y += 18;
      });
    }

    return elements;
  }

  private _create_edge(edge: ArchitectureEdge, is_single_layer: boolean = false): ExcalidrawElement[] {
    const source_id = edge.source;
    const target_id = edge.target;
    const interaction = edge.interaction || "sync";

    // 获取连接点（可能是多个点，用于折线）
    const points = this.layout_engine.get_edge_points(source_id, target_id, is_single_layer);
    if (points.length === 0 || (points.length === 2 && points[0][0] === 0 && points[0][1] === 0 && points[1][0] === 0 && points[1][1] === 0)) {
      return [];
    }

    const elements: ExcalidrawElement[] = [];

    // 获取样式
    const stroke_config = this.style_config.INTERACTION_TO_STROKE[interaction] ||
      this.style_config.INTERACTION_TO_STROKE.sync;

    // 计算箭头位置（相对于起点）
    const [start_x, start_y] = points[0];
    const last_point = points[points.length - 1];
    const relative_points = points.map((point, idx) => {
      if (idx === 0) return [0, 0];
      return [point[0] - start_x, point[1] - start_y];
    });

    // 计算边界框（用于 width 和 height）
    const min_x = Math.min(...points.map(p => p[0]));
    const max_x = Math.max(...points.map(p => p[0]));
    const min_y = Math.min(...points.map(p => p[1]));
    const max_y = Math.max(...points.map(p => p[1]));

    const edge_elem: ExcalidrawElement = {
      id: `edge_${source_id}_${target_id}`,
      type: "arrow",
      x: start_x,
      y: start_y,
      width: Math.abs(max_x - min_x),
      height: Math.abs(max_y - min_y),
      points: relative_points,
      strokeColor: "#1e1e1e",
      strokeWidth: stroke_config.width,
      strokeStyle: stroke_config.style,
      roughness: 1,
      opacity: 100,
      angle: 0,
      seed: 1,
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: 1,
      link: null,
      locked: false,
      endArrowhead: "arrow",
      startArrowhead: null
    };
    elements.push(edge_elem);

    // 添加标签
    if (edge.label) {
      // 计算标签位置（使用中间点，如果是折线则使用中间段的中心）
      const mid_point = points[Math.floor(points.length / 2)];
      const next_mid_point = points[Math.floor(points.length / 2) + 1] || points[points.length - 1];
      const label_x = (mid_point[0] + next_mid_point[0]) / 2;
      const label_y = (mid_point[1] + next_mid_point[1]) / 2;

      const label_elem: ExcalidrawElement = {
        id: `edge_label_${source_id}_${target_id}`,
        type: "text",
        x: label_x - 50,
        y: label_y - 10,
        width: 100,
        height: 20,
        text: edge.label,
        fontSize: 12,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        baseline: 15,
        strokeColor: "#495057",
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
        lineHeight: 1.25
      };
      elements.push(label_elem);
    }

    return elements;
  }

  private _create_evolution_tracking(
    tracking: { solved_issues?: string[]; new_backlog?: string[] },
    positions: Map<string, NodePosition>
  ): ExcalidrawElement[] {
    const elements: ExcalidrawElement[] = [];

    // 找到最右侧节点的x坐标
    let max_x = 1000;
    if (positions.size > 0) {
      max_x = Math.max(...Array.from(positions.values()).map(pos => pos.x + pos.width));
    }
    const tracking_x = max_x + 50;
    let tracking_y = 200;

    // 已解决问题
    if (tracking.solved_issues && tracking.solved_issues.length > 0) {
      const solved_title: ExcalidrawElement = {
        id: this._generate_id(),
        type: "text",
        x: tracking_x,
        y: tracking_y,
        width: 300,
        height: 25,
        text: "✅ 已解决问题:",
        fontSize: 14,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 20,
        strokeColor: "#2f9e44",
        fontStyle: "bold",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
        lineHeight: 1.25
      };
      elements.push(solved_title);

      let y_offset = tracking_y + 30;
      tracking.solved_issues.forEach(issue => {
        const issue_elem: ExcalidrawElement = {
          id: this._generate_id(),
          type: "text",
          x: tracking_x + 20,
          y: y_offset,
          width: 280,
          height: 20,
          text: `• ${issue}`,
          fontSize: 12,
          fontFamily: 1,
          textAlign: "left",
          verticalAlign: "top",
          baseline: 15,
          strokeColor: "#495057",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          angle: 0,
          seed: 1,
          groupIds: [],
          frameId: null,
          roundness: null,
          boundElements: [],
          updated: 1,
          link: null,
          locked: false,
          lineHeight: 1.25
        };
        elements.push(issue_elem);
        y_offset += 25;
      });
      tracking_y = y_offset + 20;
    }

    // 新问题
    if (tracking.new_backlog && tracking.new_backlog.length > 0) {
      const backlog_y = tracking.solved_issues && tracking.solved_issues.length > 0 ? tracking_y : 200;
      const backlog_title: ExcalidrawElement = {
        id: this._generate_id(),
        type: "text",
        x: tracking_x,
        y: backlog_y,
        width: 300,
        height: 25,
        text: "⚠️ 新发现问题:",
        fontSize: 14,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: 20,
        strokeColor: "#f59f00",
        fontStyle: "bold",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        angle: 0,
        seed: 1,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
        lineHeight: 1.25
      };
      elements.push(backlog_title);

      let y_offset = backlog_y + 30;
      tracking.new_backlog.forEach(issue => {
        const issue_elem: ExcalidrawElement = {
          id: this._generate_id(),
          type: "text",
          x: tracking_x + 20,
          y: y_offset,
          width: 280,
          height: 20,
          text: `• ${issue}`,
          fontSize: 12,
          fontFamily: 1,
          textAlign: "left",
          verticalAlign: "top",
          baseline: 15,
          strokeColor: "#c92a2a",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1,
          opacity: 100,
          angle: 0,
          seed: 1,
          groupIds: [],
          frameId: null,
          roundness: null,
          boundElements: [],
          updated: 1,
          link: null,
          locked: false,
          lineHeight: 1.25
        };
        elements.push(issue_elem);
        y_offset += 25;
      });
    }

    return elements;
  }
}

// ==================== 便捷函数 ====================

/**
 * 将架构数据转换为 Excalidraw 格式
 * @param architecture_data 架构数据对象
 * @returns Excalidraw 格式的数据，可以直接用于渲染
 */
export function convert_architecture_to_excalidraw(architecture_data: ArchitectureData): ExcalidrawData {
  const converter = new ArchitectureToExcalidraw();
  return converter.convert(architecture_data);
}

/**
 * 创建带有完整生命周期和输出的架构数据
 * 这是一个辅助函数，用于创建新的架构数据时自动填充生命周期信息
 * @param roundData 轮次数据（不包含 lifecycle 和 output）
 * @returns 完整的 ArchitectureData，包含生命周期和 Excalidraw 输出
 */
export function createArchitectureData(roundData: Omit<ArchitectureData, 'lifecycle' | 'output'>): ArchitectureData {
  const now = Date.now();
  const architectureData: ArchitectureData = {
    ...roundData,
    lifecycle: {
      createdAt: now,
      updatedAt: now,
      status: 'active',
      version: roundData.round_id,
    },
  };
  
  // 自动生成 Excalidraw 输出数据
  architectureData.output = convert_architecture_to_excalidraw(architectureData);
  
  return architectureData;
}

