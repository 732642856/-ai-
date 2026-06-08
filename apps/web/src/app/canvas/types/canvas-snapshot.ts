import type { Edge, Node, Viewport } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";

export type CanvasSnapshot = {
  id: string;
  title: string;
  summary?: string;
  createdAt: string;
  schemaVersion: 1;
  nodeCount: number;
  edgeCount: number;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  viewport?: Viewport;
};

export type CanvasSnapshotStorage = {
  version: 1;
  snapshots: CanvasSnapshot[];
};
