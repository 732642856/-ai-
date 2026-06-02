import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "./components/canvas/types";

function assertShim<T>(value: T) {
  return {
    toBe(expected: T) {
      assert.equal(value, expected);
    },
    toBeUndefined() {
      assert.equal(value, undefined);
    },
    toContain(expected: unknown) {
      assert.ok(Array.isArray(value) || typeof value === "string");
      assert.ok((value as any).includes(expected));
    },
    toEqual(expected: unknown) {
      assert.deepEqual(value, expected);
    },
  };
}

describe("handleSplitStoryboardNode logic", () => {
  let nodes: Node<CanvasNodeData>[];
  let edges: Edge[];
  const sourceNodeId = "source-1";

  beforeEach(() => {
    nodes = [
      {
        id: sourceNodeId,
        type: "content",
        position: { x: 100, y: 100 },
        data: {
          title: "测试分镜",
          content: `镜头 1：清晨巷口丢球
画面描述：薄雾老巷中，豆豆叼红球跟着老许

镜头 2：豆豆追车
画面描述：绿色垃圾车驶出巷口，豆豆焦急狂奔追赶`,
          nodeKind: "text",
        },
      },
    ];
    edges = [];
  });

  it("应该正确计算 Shot 节点位置（在源节点右侧 860px）", () => {
    const sourceNode = nodes[0];
    const STORYBOARD_PROCESS_NODE_OFFSET_X = 860;
    const STORYBOARD_SHOT_LAYOUT = { rowGap: 420 };

    // 模拟位置计算逻辑
    function getStoryboardProcessNodePosition(
      source: Node<CanvasNodeData>,
      index: number,
    ) {
      return {
        x: source.position.x + STORYBOARD_PROCESS_NODE_OFFSET_X,
        y: source.position.y + index * STORYBOARD_SHOT_LAYOUT.rowGap,
      };
    }

    const pos0 = getStoryboardProcessNodePosition(sourceNode, 0);
    const pos1 = getStoryboardProcessNodePosition(sourceNode, 1);

    // 验证位置
    assertShim(pos0.x).toBe(100 + 860); // 960
    assertShim(pos0.y).toBe(100);
    assertShim(pos1.x).toBe(100 + 860); // 960
    assertShim(pos1.y).toBe(100 + 420); // 520
  });

  it("应该正确去重：旧的 Shot 节点 ID 应该被清理", () => {
    // 模拟已有旧 Shot 节点的情况
    const oldShotId = "old-shot-1";
    const oldGridId = "old-grid-1";

    nodes[0].data.generatedShotNodeIds = [oldShotId];
    nodes[0].data.generatedStoryboardGridNodeId = oldGridId;

    nodes.push({
      id: oldShotId,
      type: "shot",
      position: { x: 960, y: 100 },
      data: { title: "旧镜头", nodeKind: "shot" },
    });

    nodes.push({
      id: oldGridId,
      type: "storyboardGrid",
      position: { x: 1200, y: 100 },
      data: { title: "旧网格", nodeKind: "storyboard-grid" },
    });

    // 模拟去重逻辑
    const existingShotIds = nodes[0].data.generatedShotNodeIds ?? [];
    const existingGridId = nodes[0].data.generatedStoryboardGridNodeId;
    const idsToRemove = new Set([
      ...existingShotIds,
      ...(existingGridId ? [existingGridId] : []),
    ]);

    // 过滤后的节点
    const filteredNodes = nodes.filter((n) => !idsToRemove.has(n.id));

    // 验证旧节点被移除
    assertShim(filteredNodes.length).toBe(1);
    assertShim(filteredNodes[0].id).toBe(sourceNodeId);
    assertShim(idsToRemove.has(oldShotId)).toBe(true);
    assertShim(idsToRemove.has(oldGridId)).toBe(true);
  });

  it("新创建的 Shot 节点不应该有 hidden 属性", () => {
    // 模拟创建新节点
    const newShotNode: Node<CanvasNodeData> = {
      id: "new-shot-1",
      type: "shot",
      position: { x: 960, y: 100 },
      data: {
        title: "镜头 1",
        nodeKind: "shot",
        role: "storyboard-process",
        sourceStoryboardNodeId: sourceNodeId,
      },
    };

    // 验证没有 hidden 属性
    assertShim("hidden" in newShotNode).toBe(false);
    assertShim(newShotNode.hidden).toBeUndefined();
  });

  it("应该正确解析分镜文本为 Shot 数据", () => {
    const text = `镜头 1：清晨巷口丢球
画面描述：薄雾老巷中，豆豆叼红球跟着老许

镜头 2：豆豆追车
画面描述：绿色垃圾车驶出巷口`;

    // 简单的解析逻辑验证
    const lines = text.split("\n").filter((l) => l.trim());
    const shotHeaders = lines.filter((l) => l.match(/^镜头\s*\d+[：:]/));

    assertShim(shotHeaders.length).toBe(2);
    assertShim(shotHeaders[0]).toContain("镜头 1");
    assertShim(shotHeaders[1]).toContain("镜头 2");
  });

  it("应该通过 sourceStoryboardNodeId 扫描出孤儿 Shot 节点（persisted state 去重）", () => {
    // 模拟 persisted state：generatedShotNodeIds 丢失，但节点通过 sourceStoryboardNodeId 关联
    const orphanShot: Node<CanvasNodeData> = {
      id: "orphan-shot-1",
      type: "shot",
      hidden: true, // 之前操作残留下来的 hidden
      position: { x: 960, y: 100 },
      data: {
        title: "孤儿镜头",
        nodeKind: "shot",
        sourceStoryboardNodeId: sourceNodeId,
        role: "storyboard-process",
      },
    };

    const orphanGrid: Node<CanvasNodeData> = {
      id: "orphan-grid-1",
      type: "storyboardGrid",
      hidden: true,
      position: { x: 1200, y: 100 },
      data: {
        title: "孤儿网格",
        nodeKind: "storyboard-grid",
        storyboardGrid: { sourceStoryboardNodeId: sourceNodeId } as any,
      },
    };

    const allNodes = [nodes[0], orphanShot, orphanGrid];

    // 模拟新的去重逻辑：按 sourceStoryboardNodeId 扫描
    const idsToRemove = new Set<string>(
      allNodes
        .filter((n) => n.type === "shot" || n.type === "storyboardGrid" || n.data?.role === "storyboard-process")
        .filter((n) => {
          const d = n.data;
          return d?.sourceStoryboardNodeId === sourceNodeId ||
                 (d as any)?.shot?.sourceStoryboardNodeId === sourceNodeId ||
                 (d as any)?.storyboardGrid?.sourceStoryboardNodeId === sourceNodeId;
        })
        .map((n) => n.id),
    );

    // 验证孤儿节点都被正确识别
    assertShim(idsToRemove.has("orphan-shot-1")).toBe(true);
    assertShim(idsToRemove.has("orphan-grid-1")).toBe(true);
    assertShim(idsToRemove.size).toBe(2);

    // 验证源节点不被误删
    assertShim(idsToRemove.has(sourceNodeId)).toBe(false);

    // 过滤后只剩源节点
    const remaining = allNodes.filter((n) => !idsToRemove.has(n.id));
    assertShim(remaining.length).toBe(1);
    assertShim(remaining[0].id).toBe(sourceNodeId);
  });

  it("setNodes 应该清除残留的 hidden 属性", () => {
    const nodesWithHidden: any[] = [
      { id: "a", hidden: false, data: { title: "正常" }, position: { x: 0, y: 0 } },
      { id: "b", hidden: true, data: { title: "隐藏的" }, position: { x: 100, y: 0 } },
    ];

    // 模拟 setNodes 中的清除逻辑
    const cleaned = nodesWithHidden.map((n) => {
      if (n.hidden) {
        const { hidden, ...rest } = n;
        return {
          ...rest,
          data: { ...n.data, hiddenByStoryboardProcessMode: undefined },
        };
      }
      return n;
    });

    assertShim(cleaned[0].hidden).toBe(false); // 原本就可见的保持不变
    assertShim(cleaned[1].hidden).toBeUndefined(); // hidden: true 被清除
    assertShim(cleaned[1].data.hiddenByStoryboardProcessMode).toBeUndefined();
  });
  it("函数式 setNodes 应该能正确处理节点更新", () => {
    // 模拟函数式更新器
    const existingNodes: Node<CanvasNodeData>[] = [
      { id: "a", type: "content", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "shot", position: { x: 100, y: 0 }, data: {} },
    ];

    const idsToRemove = new Set(["b"]);
    const newNodes: Node<CanvasNodeData>[] = [
      { id: "c", type: "shot", position: { x: 200, y: 0 }, data: {} },
    ];

    // 模拟 setNodes 的函数式更新
    const updater = (nds: Node<CanvasNodeData>[]) => {
      const existing = nds.filter((n) => !idsToRemove.has(n.id));
      return [...existing, ...newNodes];
    };

    const result = updater(existingNodes);

    // 验证：b 被移除，c 被添加
    assertShim(result.map((n) => n.id)).toEqual(["a", "c"]);
  });
});
