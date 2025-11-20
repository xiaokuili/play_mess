/**
 * 架构数据转 Excalidraw JSON 转换器 (TypeScript 版本)
 * 
 * 将 Current_Architecture 数据结构转换为 Excalidraw 可渲染的 JSON 格式
 * 包含两个核心模块：
 * 1. Layout - 负责节点位置计算和布局算法
 * 2. Style - 负责样式映射（颜色、形状、线型等）
 */

// ==================== 类型定义 ====================

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  center_x: number;
  center_y: number;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  tech_stack?: string;
  type: "client" | "gateway" | "service" | "database" | "cache" | "queue" | "third_party";
  status: "new" | "modified" | "stable";
  description?: string;
  alerts?: string[];
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  label?: string;
  interaction: "sync" | "async";
}

export interface ArchitectureData {
  round_id: number;
  round_title: string;
  decision_rationale?: string;
  architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  evolution_tracking?: {
    solved_issues?: string[];
    new_backlog?: string[];
  };
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any;
}

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

  constructor(canvas_width: number = 2000, canvas_height: number = 1500) {
    this.canvas_width = canvas_width;
    this.canvas_height = canvas_height;
    this.node_positions = new Map();
    this.layer_spacing = 250;
    this.node_spacing = 300;
    this.margin = 100;
  }

  calculate_layout(nodes: ArchitectureNode[], edges: ArchitectureEdge[]): Map<string, NodePosition> {
    // 构建图结构
    const graph = this._build_graph(nodes, edges);

    // 计算层级（拓扑排序）
    const layers = this._calculate_layers(graph, nodes);

    // 计算每个节点的位置
    const positions = new Map<string, NodePosition>();
    const start_y = this.margin + 150;

    for (let layer_idx = 0; layer_idx < layers.length; layer_idx++) {
      const layer_nodes = layers[layer_idx];
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

  get_edge_points(source_id: string, target_id: string): [number[], number[]] {
    const source_pos = this.node_positions.get(source_id);
    const target_pos = this.node_positions.get(target_id);

    if (!source_pos || !target_pos) {
      return [[0, 0], [0, 0]];
    }

    // 计算连接点（从源节点底部到目标节点顶部）
    const start_point = [source_pos.center_x, source_pos.y + source_pos.height];
    const end_point = [target_pos.center_x, target_pos.y];

    return [start_point, end_point];
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
      const edge_elements = this._create_edge(edge);
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

  private _create_edge(edge: ArchitectureEdge): ExcalidrawElement[] {
    const source_id = edge.source;
    const target_id = edge.target;
    const interaction = edge.interaction || "sync";

    // 获取连接点
    const points = this.layout_engine.get_edge_points(source_id, target_id);
    if (points[0][0] === 0 && points[0][1] === 0 && points[1][0] === 0 && points[1][1] === 0) {
      return [];
    }

    const elements: ExcalidrawElement[] = [];

    // 获取样式
    const stroke_config = this.style_config.INTERACTION_TO_STROKE[interaction] ||
      this.style_config.INTERACTION_TO_STROKE.sync;

    // 计算箭头位置（相对于起点）
    const [start_x, start_y] = points[0];
    const [end_x, end_y] = points[1];
    const relative_points = [
      [0, 0],
      [end_x - start_x, end_y - start_y]
    ];

    const edge_elem: ExcalidrawElement = {
      id: `edge_${source_id}_${target_id}`,
      type: "arrow",
      x: start_x,
      y: start_y,
      width: Math.abs(end_x - start_x),
      height: Math.abs(end_y - start_y),
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
      // 计算标签位置（箭头中点）
      const label_x = (start_x + end_x) / 2;
      const label_y = (start_y + end_y) / 2;

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

export function convert_architecture_to_excalidraw(architecture_data: ArchitectureData): ExcalidrawData {
  const converter = new ArchitectureToExcalidraw();
  return converter.convert(architecture_data);
}

