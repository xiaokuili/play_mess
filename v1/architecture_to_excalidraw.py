"""
架构数据转 Excalidraw JSON 转换器

将 Current_Architecture 数据结构转换为 Excalidraw 可渲染的 JSON 格式
包含两个核心模块：
1. Layout - 负责节点位置计算和布局算法
2. Style - 负责样式映射（颜色、形状、线型等）
"""

import json
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import math


# ==================== Style 模块 ====================

class StyleConfig:
    """样式配置：定义节点类型、状态到视觉样式的映射"""
    
    # 节点类型到形状的映射
    TYPE_TO_SHAPE = {
        "client": "ellipse",           # 椭圆
        "gateway": "diamond",          # 菱形
        "service": "rectangle",        # 矩形
        "database": "rectangle",       # 矩形（带特殊图标）
        "cache": "rectangle",          # 矩形（带特殊图标）
        "queue": "rectangle",          # 矩形（带特殊图标）
        "third_party": "rectangle"     # 矩形
    }
    
    # 节点类型到图标的映射
    TYPE_TO_ICON = {
        "client": "📱",
        "gateway": "🚪",
        "service": "⚙️",
        "database": "🗄️",
        "cache": "⚡",
        "queue": "📬",
        "third_party": "🔌"
    }
    
    # 状态到颜色的映射
    STATUS_TO_COLOR = {
        "new": {
            "stroke": "#2f9e44",      # 绿色边框
            "fill": "#d3f9d8"         # 浅绿色填充
        },
        "modified": {
            "stroke": "#f59f00",      # 橙色边框
            "fill": "#fff3bf"         # 浅橙色填充
        },
        "stable": {
            "stroke": "#868e96",      # 灰色边框
            "fill": "#e9ecef"         # 浅灰色填充
        }
    }
    
    # 交互类型到线型的映射
    INTERACTION_TO_STROKE = {
        "sync": {
            "style": "solid",         # 实线
            "width": 2
        },
        "async": {
            "style": "dashed",        # 虚线
            "width": 2
        }
    }
    
    # 默认尺寸
    DEFAULT_NODE_SIZE = {
        "width": 200,
        "height": 100
    }
    
    # 文本样式
    TEXT_STYLES = {
        "title": {
            "fontSize": 24,
            "fontFamily": 1,
            "fontStyle": "bold",
            "color": "#1e1e1e"
        },
        "label": {
            "fontSize": 16,
            "fontFamily": 1,
            "color": "#1e1e1e"
        },
        "tech_stack": {
            "fontSize": 12,
            "fontFamily": 1,
            "color": "#495057"
        },
        "alert": {
            "fontSize": 11,
            "fontFamily": 1,
            "color": "#c92a2a"  # 红色警告
        }
    }


# ==================== Layout 模块 ====================

@dataclass
class NodePosition:
    """节点位置信息"""
    x: float
    y: float
    width: float
    height: float
    center_x: float
    center_y: float


class LayoutEngine:
    """布局引擎：计算节点位置和边的连接点"""
    
    def __init__(self, canvas_width: int = 2000, canvas_height: int = 1500):
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height
        self.node_positions: Dict[str, NodePosition] = {}
        self.layer_spacing = 250  # 层级间距
        self.node_spacing = 300   # 同层节点间距
        self.margin = 100         # 边距
    
    def calculate_layout(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, NodePosition]:
        """
        计算节点布局
        使用分层布局算法：
        - 根据边的方向确定层级
        - 同层节点水平排列
        """
        # 构建图结构
        graph = self._build_graph(nodes, edges)
        
        # 计算层级（拓扑排序）
        layers = self._calculate_layers(graph, nodes)
        
        # 计算每个节点的位置
        positions = {}
        start_y = self.margin + 150  # 留出标题空间
        
        for layer_idx, layer_nodes in enumerate(layers):
            layer_y = start_y + layer_idx * self.layer_spacing
            layer_width = len(layer_nodes) * self.node_spacing
            start_x = (self.canvas_width - layer_width) / 2
            
            for node_idx, node in enumerate(layer_nodes):
                x = start_x + node_idx * self.node_spacing
                y = layer_y
                
                node_id = node["id"]
                width = StyleConfig.DEFAULT_NODE_SIZE["width"]
                height = StyleConfig.DEFAULT_NODE_SIZE["height"]
                
                positions[node_id] = NodePosition(
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    center_x=x + width / 2,
                    center_y=y + height / 2
                )
        
        self.node_positions = positions
        return positions
    
    def _build_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """构建邻接表"""
        graph = {node["id"]: [] for node in nodes}
        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            if source in graph:
                graph[source].append(target)
        return graph
    
    def _calculate_layers(self, graph: Dict[str, List[str]], nodes: List[Dict]) -> List[List[Dict]]:
        """
        计算节点层级
        简单实现：使用 BFS 分层
        """
        # 找到所有入度为0的节点（起始节点）
        in_degree = {node["id"]: 0 for node in nodes}
        for node in nodes:
            for target in graph.get(node["id"], []):
                in_degree[target] = in_degree.get(target, 0) + 1
        
        # 从入度为0的节点开始分层
        layers = []
        remaining = set(node["id"] for node in nodes)
        current_layer = [node for node in nodes if in_degree[node["id"]] == 0]
        
        while current_layer:
            layers.append(current_layer)
            next_layer = []
            
            for node in current_layer:
                remaining.discard(node["id"])
                for target in graph.get(node["id"], []):
                    in_degree[target] -= 1
                    if in_degree[target] == 0 and target in remaining:
                        next_layer.append(next(n for n in nodes if n["id"] == target))
            
            current_layer = next_layer
        
        # 处理剩余节点（循环依赖等）
        if remaining:
            remaining_nodes = [node for node in nodes if node["id"] in remaining]
            layers.append(remaining_nodes)
        
        return layers
    
    def get_edge_points(self, source_id: str, target_id: str) -> Tuple[List[float], List[float]]:
        """计算边的起点和终点坐标"""
        source_pos = self.node_positions.get(source_id)
        target_pos = self.node_positions.get(target_id)
        
        if not source_pos or not target_pos:
            return [[0, 0], [0, 0]]
        
        # 计算连接点（从源节点底部到目标节点顶部）
        start_point = [source_pos.center_x, source_pos.y + source_pos.height]
        end_point = [target_pos.center_x, target_pos.y]
        
        return [start_point, end_point]


# ==================== 转换器主函数 ====================

class ArchitectureToExcalidraw:
    """架构数据到 Excalidraw JSON 的转换器"""
    
    def __init__(self):
        self.style_config = StyleConfig()
        self.layout_engine = LayoutEngine()
        self.element_id_counter = 0
    
    def _generate_id(self) -> str:
        """生成唯一元素ID"""
        self.element_id_counter += 1
        return f"element_{self.element_id_counter}"
    
    def convert(self, architecture_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        将架构数据转换为 Excalidraw JSON
        
        Args:
            architecture_data: 符合 Current_Architecture 结构的数据
        
        Returns:
            Excalidraw JSON 格式的数据
        """
        elements = []
        
        # 1. 添加标题
        title_elements = self._create_title(architecture_data)
        elements.extend(title_elements)
        
        # 2. 计算布局
        nodes = architecture_data["architecture"]["nodes"]
        edges = architecture_data["architecture"]["edges"]
        positions = self.layout_engine.calculate_layout(nodes, edges)
        
        # 3. 创建节点元素
        for node in nodes:
            node_elements = self._create_node(node, positions.get(node["id"]))
            elements.extend(node_elements)
        
        # 4. 创建边元素
        for edge in edges:
            edge_elements = self._create_edge(edge)
            if edge_elements:
                if isinstance(edge_elements, list):
                    elements.extend(edge_elements)
                else:
                    elements.append(edge_elements)
        
        # 5. 创建演进追踪信息
        if "evolution_tracking" in architecture_data:
            tracking_elements = self._create_evolution_tracking(
                architecture_data["evolution_tracking"],
                positions
            )
            elements.extend(tracking_elements)
        
        return {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": elements
        }
    
    def _create_title(self, data: Dict) -> List[Dict]:
        """创建标题元素"""
        elements = []
        
        # 主标题
        title_text = f"Round {data.get('round_id', '?')}: {data.get('round_title', 'Architecture')}"
        title_elem = {
            "id": self._generate_id(),
            "type": "text",
            "x": 50,
            "y": 20,
            "width": 600,
            "height": 40,
            "text": title_text,
            "fontSize": self.style_config.TEXT_STYLES["title"]["fontSize"],
            "fontFamily": self.style_config.TEXT_STYLES["title"]["fontFamily"],
            "textAlign": "left",
            "verticalAlign": "top",
            "baseline": 32,
            "strokeColor": self.style_config.TEXT_STYLES["title"]["color"],
            "fontStyle": "bold",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "angle": 0,
            "seed": 1,
            "groupIds": [],
            "frameId": None,
            "roundness": None,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
            "lineHeight": 1.25
        }
        elements.append(title_elem)
        
        # 决策理由
        if data.get("decision_rationale"):
            rationale_elem = {
                "id": self._generate_id(),
                "type": "text",
                "x": 50,
                "y": 70,
                "width": 800,
                "height": 30,
                "text": f"💡 {data['decision_rationale']}",
                "fontSize": 14,
                "fontFamily": 1,
                "textAlign": "left",
                "verticalAlign": "top",
                "baseline": 20,
                "strokeColor": "#495057",
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "angle": 0,
                "seed": 1,
                "groupIds": [],
                "frameId": None,
                "roundness": None,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "lineHeight": 1.25
            }
            elements.append(rationale_elem)
        
        return elements
    
    def _create_node(self, node: Dict, position: NodePosition) -> List[Dict]:
        """创建节点元素（形状 + 文本）"""
        elements = []
        
        node_id = node["id"]
        node_type = node.get("type", "service")
        node_status = node.get("status", "stable")
        
        # 获取样式
        shape_type = self.style_config.TYPE_TO_SHAPE.get(node_type, "rectangle")
        colors = self.style_config.STATUS_TO_COLOR.get(node_status, self.style_config.STATUS_TO_COLOR["stable"])
        icon = self.style_config.TYPE_TO_ICON.get(node_type, "⚙️")
        
        # 创建形状元素
        shape_elem = {
            "id": f"shape_{node_id}",
            "type": shape_type,
            "x": position.x,
            "y": position.y,
            "width": position.width,
            "height": position.height,
            "strokeColor": colors["stroke"],
            "backgroundColor": colors["fill"],
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "angle": 0,
            "seed": 1,
            "groupIds": [],
            "frameId": None,
            "roundness": {"type": 3} if shape_type == "rectangle" else {"type": 2},
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False
        }
        elements.append(shape_elem)
        
        # 创建标签文本
        label_text = f"{icon} {node.get('label', node_id)}"
        label_elem = {
            "id": f"label_{node_id}",
            "type": "text",
            "x": position.x + 10,
            "y": position.y + 15,
            "width": position.width - 20,
            "height": 25,
            "text": label_text,
            "fontSize": self.style_config.TEXT_STYLES["label"]["fontSize"],
            "fontFamily": self.style_config.TEXT_STYLES["label"]["fontFamily"],
            "textAlign": "center",
            "verticalAlign": "top",
            "baseline": 20,
            "strokeColor": self.style_config.TEXT_STYLES["label"]["color"],
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "angle": 0,
            "seed": 1,
            "groupIds": [],
            "frameId": None,
            "roundness": None,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
            "lineHeight": 1.25
        }
        elements.append(label_elem)
        
        # 创建技术栈文本
        if node.get("tech_stack"):
            tech_elem = {
                "id": f"tech_{node_id}",
                "type": "text",
                "x": position.x + 10,
                "y": position.y + 45,
                "width": position.width - 20,
                "height": 20,
                "text": node["tech_stack"],
                "fontSize": self.style_config.TEXT_STYLES["tech_stack"]["fontSize"],
                "fontFamily": self.style_config.TEXT_STYLES["tech_stack"]["fontFamily"],
                "textAlign": "center",
                "verticalAlign": "top",
                "baseline": 14,
                "strokeColor": self.style_config.TEXT_STYLES["tech_stack"]["color"],
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "angle": 0,
                "seed": 1,
                "groupIds": [],
                "frameId": None,
                "roundness": None,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "lineHeight": 1.25
            }
            elements.append(tech_elem)
        
        # 创建警告文本
        if node.get("alerts"):
            alert_y = position.y + 70
            for alert in node["alerts"]:
                alert_elem = {
                    "id": f"alert_{node_id}_{self._generate_id()}",
                    "type": "text",
                    "x": position.x + 10,
                    "y": alert_y,
                    "width": position.width - 20,
                    "height": 15,
                    "text": f"⚠️ {alert}",
                    "fontSize": self.style_config.TEXT_STYLES["alert"]["fontSize"],
                    "fontFamily": self.style_config.TEXT_STYLES["alert"]["fontFamily"],
                    "textAlign": "left",
                    "verticalAlign": "top",
                    "baseline": 12,
                    "strokeColor": self.style_config.TEXT_STYLES["alert"]["color"],
                    "fillStyle": "solid",
                    "strokeWidth": 2,
                    "strokeStyle": "solid",
                    "roughness": 1,
                    "opacity": 100,
                    "angle": 0,
                    "seed": 1,
                    "groupIds": [],
                    "frameId": None,
                    "roundness": None,
                    "boundElements": [],
                    "updated": 1,
                    "link": None,
                    "locked": False,
                    "lineHeight": 1.25
                }
                elements.append(alert_elem)
                alert_y += 18
        
        return elements
    
    def _create_edge(self, edge: Dict) -> List[Dict]:
        """创建边元素（箭头 + 标签）"""
        source_id = edge["source"]
        target_id = edge["target"]
        interaction = edge.get("interaction", "sync")
        
        # 获取连接点
        points = self.layout_engine.get_edge_points(source_id, target_id)
        if not points or points == [[0, 0], [0, 0]]:
            return []
        
        elements = []
        
        # 获取样式
        stroke_config = self.style_config.INTERACTION_TO_STROKE.get(
            interaction,
            self.style_config.INTERACTION_TO_STROKE["sync"]
        )
        
        # 计算箭头位置（相对于起点）
        start_x, start_y = points[0]
        end_x, end_y = points[1]
        relative_points = [
            [0, 0],
            [end_x - start_x, end_y - start_y]
        ]
        
        edge_elem = {
            "id": f"edge_{source_id}_{target_id}",
            "type": "arrow",
            "x": start_x,
            "y": start_y,
            "width": abs(end_x - start_x),
            "height": abs(end_y - start_y),
            "points": relative_points,
            "strokeColor": "#1e1e1e",
            "strokeWidth": stroke_config["width"],
            "strokeStyle": stroke_config["style"],
            "roughness": 1,
            "opacity": 100,
            "angle": 0,
            "seed": 1,
            "groupIds": [],
            "frameId": None,
            "roundness": None,
            "boundElements": [],
            "updated": 1,
            "link": None,
            "locked": False,
            "endArrowhead": "arrow",
            "startArrowhead": None
        }
        elements.append(edge_elem)
        
        # 添加标签
        if edge.get("label"):
            # 计算标签位置（箭头中点）
            label_x = (start_x + end_x) / 2
            label_y = (start_y + end_y) / 2
            
            label_elem = {
                "id": f"edge_label_{source_id}_{target_id}",
                "type": "text",
                "x": label_x - 50,
                "y": label_y - 10,
                "width": 100,
                "height": 20,
                "text": edge["label"],
                "fontSize": 12,
                "fontFamily": 1,
                "textAlign": "center",
                "verticalAlign": "middle",
                "baseline": 15,
                "strokeColor": "#495057",
                "backgroundColor": "#ffffff",
                "fillStyle": "solid",
                "strokeWidth": 1,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "angle": 0,
                "seed": 1,
                "groupIds": [],
                "frameId": None,
                "roundness": None,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "lineHeight": 1.25
            }
            elements.append(label_elem)
        
        return elements
    
    def _create_evolution_tracking(self, tracking: Dict, positions: Dict[str, NodePosition]) -> List[Dict]:
        """创建演进追踪信息"""
        elements = []
        
        # 找到最右侧节点的x坐标
        max_x = max(pos.x + pos.width for pos in positions.values()) if positions else 1000
        tracking_x = max_x + 50
        tracking_y = 200
        
        # 已解决问题
        if tracking.get("solved_issues"):
            solved_title = {
                "id": self._generate_id(),
                "type": "text",
                "x": tracking_x,
                "y": tracking_y,
                "width": 300,
                "height": 25,
                "text": "✅ 已解决问题:",
                "fontSize": 14,
                "fontFamily": 1,
                "textAlign": "left",
                "verticalAlign": "top",
                "baseline": 20,
                "strokeColor": "#2f9e44",
                "fontStyle": "bold",
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "angle": 0,
                "seed": 1,
                "groupIds": [],
                "frameId": None,
                "roundness": None,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "lineHeight": 1.25
            }
            elements.append(solved_title)
            
            y_offset = tracking_y + 30
            for issue in tracking["solved_issues"]:
                issue_elem = {
                    "id": self._generate_id(),
                    "type": "text",
                    "x": tracking_x + 20,
                    "y": y_offset,
                    "width": 280,
                    "height": 20,
                    "text": f"• {issue}",
                    "fontSize": 12,
                    "fontFamily": 1,
                    "textAlign": "left",
                    "verticalAlign": "top",
                    "baseline": 15,
                    "strokeColor": "#495057",
                    "fillStyle": "solid",
                    "strokeWidth": 2,
                    "strokeStyle": "solid",
                    "roughness": 1,
                    "opacity": 100,
                    "angle": 0,
                    "seed": 1,
                    "groupIds": [],
                    "frameId": None,
                    "roundness": None,
                    "boundElements": [],
                    "updated": 1,
                    "link": None,
                    "locked": False,
                    "lineHeight": 1.25
                }
                elements.append(issue_elem)
                y_offset += 25
        
        # 新问题
        if tracking.get("new_backlog"):
            backlog_y = tracking_y + 150 if tracking.get("solved_issues") else tracking_y
            backlog_title = {
                "id": self._generate_id(),
                "type": "text",
                "x": tracking_x,
                "y": backlog_y,
                "width": 300,
                "height": 25,
                "text": "⚠️ 新发现问题:",
                "fontSize": 14,
                "fontFamily": 1,
                "textAlign": "left",
                "verticalAlign": "top",
                "baseline": 20,
                "strokeColor": "#f59f00",
                "fontStyle": "bold",
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "angle": 0,
                "seed": 1,
                "groupIds": [],
                "frameId": None,
                "roundness": None,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "lineHeight": 1.25
            }
            elements.append(backlog_title)
            
            y_offset = backlog_y + 30
            for issue in tracking["new_backlog"]:
                issue_elem = {
                    "id": self._generate_id(),
                    "type": "text",
                    "x": tracking_x + 20,
                    "y": y_offset,
                    "width": 280,
                    "height": 20,
                    "text": f"• {issue}",
                    "fontSize": 12,
                    "fontFamily": 1,
                    "textAlign": "left",
                    "verticalAlign": "top",
                    "baseline": 15,
                    "strokeColor": "#c92a2a",
                    "fillStyle": "solid",
                    "strokeWidth": 2,
                    "strokeStyle": "solid",
                    "roughness": 1,
                    "opacity": 100,
                    "angle": 0,
                    "seed": 1,
                    "groupIds": [],
                    "frameId": None,
                    "roundness": None,
                    "boundElements": [],
                    "updated": 1,
                    "link": None,
                    "locked": False,
                    "lineHeight": 1.25
                }
                elements.append(issue_elem)
                y_offset += 25
        
        return elements


# ==================== 使用示例 ====================

def convert_architecture_to_excalidraw(architecture_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    便捷函数：将架构数据转换为 Excalidraw JSON
    
    Usage:
        with open('architecture.json', 'r') as f:
            arch_data = json.load(f)
        
        excalidraw_json = convert_architecture_to_excalidraw(arch_data)
        
        with open('output.excalidraw.json', 'w') as f:
            json.dump(excalidraw_json, f, indent=2, ensure_ascii=False)
    """
    converter = ArchitectureToExcalidraw()
    return converter.convert(architecture_data)


if __name__ == "__main__":
    # 示例数据
    example_architecture = {
        "round_id": 1,
        "round_title": "引入缓存层",
        "decision_rationale": "为了缓解数据库读压力，引入 Redis 缓存层",
        "architecture": {
            "nodes": [
                {
                    "id": "client",
                    "label": "Web Client",
                    "tech_stack": "React/TypeScript",
                    "type": "client",
                    "status": "stable",
                    "description": "前端应用",
                    "alerts": []
                },
                {
                    "id": "api_server",
                    "label": "API Server",
                    "tech_stack": "Python/FastAPI",
                    "type": "service",
                    "status": "modified",
                    "description": "业务逻辑处理",
                    "alerts": ["QPS 可能达到瓶颈"]
                },
                {
                    "id": "redis",
                    "label": "Redis Cache",
                    "tech_stack": "Redis 6.0",
                    "type": "cache",
                    "status": "new",
                    "description": "缓存层",
                    "alerts": []
                },
                {
                    "id": "database",
                    "label": "PostgreSQL",
                    "tech_stack": "PostgreSQL 14",
                    "type": "database",
                    "status": "stable",
                    "description": "主数据库",
                    "alerts": []
                }
            ],
            "edges": [
                {
                    "source": "client",
                    "target": "api_server",
                    "label": "HTTP Request",
                    "interaction": "sync"
                },
                {
                    "source": "api_server",
                    "target": "redis",
                    "label": "Cache Read",
                    "interaction": "sync"
                },
                {
                    "source": "api_server",
                    "target": "database",
                    "label": "DB Query",
                    "interaction": "sync"
                }
            ]
        },
        "evolution_tracking": {
            "solved_issues": ["数据库读压力过大"],
            "new_backlog": ["Redis 单点故障风险", "缓存一致性需要处理"]
        }
    }
    
    # 转换
    result = convert_architecture_to_excalidraw(example_architecture)
    
    # 输出
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # 输出到文件
    with open('output.excalidraw.json', 'w') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)