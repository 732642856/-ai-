// ============================================================================
// Pose Reference Editor Component
// Adapted from LaichuLai/openpose-skeleton-editor (MIT)
// BODY_25 keypoint format, drag-to-edit joints, ControlNet-compatible output
// ============================================================================
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { DESIGN_TOKENS } from "../../styles/designSystem";

// ── BODY_25 Keypoint Definitions ──────────────────────────────────────────────
interface Keypoint {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
}

interface FaceKeypoint {
  id: number;
  name: string;
  x: number;
  y: number;
  color: string;
}

// ── ControlNet OpenPose JSON Format ───────────────────────────────────────────
export interface OpenPosePerson {
  pose_keypoints_2d: number[];
  face_keypoints_2d: number[];
  hand_left_keypoints_2d: number[];
  hand_right_keypoints_2d: number[];
}

export interface OpenPoseData {
  people: OpenPosePerson[];
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PoseEditorProps {
  /** Initial pose data (optional — used when restoring from saved state) */
  initialPoseData?: OpenPoseData | null;
  /** Called whenever the pose changes (real-time) */
  onPoseChange?: (poseData: OpenPoseData) => void;
  /** Called when user clicks "apply" */
  onApply?: (poseData: OpenPoseData, skeletonPng: string) => void;
  /** Called when user cancels/closes */
  onCancel?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BODY_25_KEYPOINTS: Keypoint[] = [
  { id: 0, name: "Nose", x: 0.5, y: 0.3, color: "#ef4444" },
  { id: 1, name: "Neck", x: 0.5, y: 0.4, color: "#3b82f6" },
  { id: 2, name: "RShoulder", x: 0.4, y: 0.4, color: "#10b981" },
  { id: 3, name: "RElbow", x: 0.35, y: 0.5, color: "#10b981" },
  { id: 4, name: "RWrist", x: 0.3, y: 0.6, color: "#10b981" },
  { id: 5, name: "LShoulder", x: 0.6, y: 0.4, color: "#8b5cf6" },
  { id: 6, name: "LElbow", x: 0.65, y: 0.5, color: "#8b5cf6" },
  { id: 7, name: "LWrist", x: 0.7, y: 0.6, color: "#8b5cf6" },
  { id: 8, name: "MidHip", x: 0.5, y: 0.65, color: "#f59e0b" },
  { id: 9, name: "RHip", x: 0.45, y: 0.65, color: "#f59e0b" },
  { id: 10, name: "RKnee", x: 0.45, y: 0.8, color: "#f59e0b" },
  { id: 11, name: "RAnkle", x: 0.45, y: 0.95, color: "#f59e0b" },
  { id: 12, name: "LHip", x: 0.55, y: 0.65, color: "#ec4899" },
  { id: 13, name: "LKnee", x: 0.55, y: 0.8, color: "#ec4899" },
  { id: 14, name: "LAnkle", x: 0.55, y: 0.95, color: "#ec4899" },
  { id: 15, name: "REye", x: 0.48, y: 0.28, color: "#ef4444" },
  { id: 16, name: "LEye", x: 0.52, y: 0.28, color: "#ef4444" },
  { id: 17, name: "REar", x: 0.46, y: 0.29, color: "#ef4444" },
  { id: 18, name: "LEar", x: 0.54, y: 0.29, color: "#ef4444" },
  { id: 19, name: "LBigToe", x: 0.55, y: 0.98, color: "#6b7280" },
  { id: 20, name: "LSmallToe", x: 0.57, y: 0.98, color: "#6b7280" },
  { id: 21, name: "LHeel", x: 0.53, y: 0.98, color: "#6b7280" },
  { id: 22, name: "RBigToe", x: 0.45, y: 0.98, color: "#6b7280" },
  { id: 23, name: "RSmallToe", x: 0.43, y: 0.98, color: "#6b7280" },
  { id: 24, name: "RHeel", x: 0.47, y: 0.98, color: "#6b7280" },
];

const FACE_KEYPOINTS: FaceKeypoint[] = [
  { id: 100, name: "FaceCenter", x: 0.5, y: 0.3, color: "#fbbf24" },
  { id: 101, name: "LeftEyebrow", x: 0.47, y: 0.27, color: "#fbbf24" },
  { id: 102, name: "RightEyebrow", x: 0.53, y: 0.27, color: "#fbbf24" },
  { id: 103, name: "LeftMouth", x: 0.48, y: 0.32, color: "#fbbf24" },
  { id: 104, name: "RightMouth", x: 0.52, y: 0.32, color: "#fbbf24" },
  { id: 105, name: "Chin", x: 0.5, y: 0.35, color: "#fbbf24" },
];

const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [1, 5], [5, 6], [6, 7],
  [1, 8],
  [8, 9], [9, 10], [10, 11],
  [8, 12], [12, 13], [13, 14],
  [0, 15], [0, 16],
  [15, 17], [16, 18],
  [11, 22], [22, 23], [11, 24],
  [14, 19], [19, 20], [14, 21],
];

const FACE_CONNECTIONS: [number, number][] = [
  [101, 102], [103, 104], [100, 105],
];

// ── Pose Templates ────────────────────────────────────────────────────────────
const POSE_TEMPLATES: Record<string, Keypoint[]> = {
  tpose: BODY_25_KEYPOINTS.map((kp) => {
    if (kp.id === 2) return { ...kp, x: 0.35, y: 0.4 };
    if (kp.id === 3) return { ...kp, x: 0.25, y: 0.4 };
    if (kp.id === 4) return { ...kp, x: 0.15, y: 0.4 };
    if (kp.id === 5) return { ...kp, x: 0.65, y: 0.4 };
    if (kp.id === 6) return { ...kp, x: 0.75, y: 0.4 };
    if (kp.id === 7) return { ...kp, x: 0.85, y: 0.4 };
    return { ...kp };
  }),
  walking: BODY_25_KEYPOINTS.map((kp) => {
    if (kp.id === 3) return { ...kp, x: 0.38, y: 0.48 };
    if (kp.id === 4) return { ...kp, x: 0.35, y: 0.55 };
    if (kp.id === 6) return { ...kp, x: 0.62, y: 0.52 };
    if (kp.id === 7) return { ...kp, x: 0.65, y: 0.65 };
    if (kp.id === 10) return { ...kp, x: 0.42, y: 0.78 };
    if (kp.id === 11) return { ...kp, x: 0.4, y: 0.92 };
    if (kp.id === 13) return { ...kp, x: 0.58, y: 0.82 };
    if (kp.id === 14) return { ...kp, x: 0.6, y: 0.98 };
    if (kp.id === 19) return { ...kp, x: 0.6, y: 1.0 };
    if (kp.id === 20) return { ...kp, x: 0.62, y: 1.0 };
    if (kp.id === 21) return { ...kp, x: 0.58, y: 1.0 };
    if (kp.id === 22) return { ...kp, x: 0.4, y: 0.94 };
    if (kp.id === 23) return { ...kp, x: 0.38, y: 0.94 };
    if (kp.id === 24) return { ...kp, x: 0.42, y: 0.94 };
    return { ...kp };
  }),
  running: BODY_25_KEYPOINTS.map((kp) => {
    if (kp.id === 3) return { ...kp, x: 0.32, y: 0.45 };
    if (kp.id === 4) return { ...kp, x: 0.25, y: 0.5 };
    if (kp.id === 6) return { ...kp, x: 0.68, y: 0.55 };
    if (kp.id === 7) return { ...kp, x: 0.75, y: 0.7 };
    if (kp.id === 10) return { ...kp, x: 0.38, y: 0.75 };
    if (kp.id === 11) return { ...kp, x: 0.32, y: 0.85 };
    if (kp.id === 13) return { ...kp, x: 0.62, y: 0.85 };
    if (kp.id === 14) return { ...kp, x: 0.68, y: 1.0 };
    if (kp.id === 19) return { ...kp, x: 0.68, y: 1.02 };
    if (kp.id === 20) return { ...kp, x: 0.7, y: 1.02 };
    if (kp.id === 21) return { ...kp, x: 0.66, y: 1.02 };
    if (kp.id === 22) return { ...kp, x: 0.32, y: 0.87 };
    if (kp.id === 23) return { ...kp, x: 0.3, y: 0.87 };
    if (kp.id === 24) return { ...kp, x: 0.34, y: 0.87 };
    return { ...kp };
  }),
  sitting: BODY_25_KEYPOINTS.map((kp) => {
    if (kp.id === 10) return { ...kp, x: 0.45, y: 0.75 };
    if (kp.id === 11) return { ...kp, x: 0.45, y: 0.85 };
    if (kp.id === 13) return { ...kp, x: 0.55, y: 0.75 };
    if (kp.id === 14) return { ...kp, x: 0.55, y: 0.85 };
    if (kp.id === 19) return { ...kp, x: 0.55, y: 0.87 };
    if (kp.id === 20) return { ...kp, x: 0.57, y: 0.87 };
    if (kp.id === 21) return { ...kp, x: 0.53, y: 0.87 };
    if (kp.id === 22) return { ...kp, x: 0.45, y: 0.87 };
    if (kp.id === 23) return { ...kp, x: 0.43, y: 0.87 };
    if (kp.id === 24) return { ...kp, x: 0.47, y: 0.87 };
    return { ...kp };
  }),
};

const TEMPLATE_LABELS: Record<string, string> = {
  tpose: "T-Pose",
  walking: "走路",
  running: "跑步",
  sitting: "坐姿",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PoseEditor({
  initialPoseData,
  onPoseChange,
  onApply,
  onCancel,
}: PoseEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [keypoints, setKeypoints] = useState<Keypoint[]>(() => {
    // Restore from initialPoseData if provided
    if (initialPoseData?.people?.[0]?.pose_keypoints_2d) {
      const kp = initialPoseData.people[0].pose_keypoints_2d;
      return BODY_25_KEYPOINTS.map((pt, i) => {
        const xi = i * 3;
        if (xi + 1 < kp.length) {
          return {
            ...pt,
            x: kp[xi] / 512,
            y: kp[xi + 1] / 512,
          };
        }
        return { ...pt };
      });
    }
    return BODY_25_KEYPOINTS;
  });
  const [faceKeypoints, setFaceKeypoints] = useState<FaceKeypoint[]>(FACE_KEYPOINTS);
  const [draggedPoint, setDraggedPoint] = useState<(Keypoint | FaceKeypoint) & { type: "body" | "face" } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<(Keypoint | FaceKeypoint) & { type: "body" | "face" } | null>(null);
  const [showFace, setShowFace] = useState(false);
  const [canvasSize] = useState({ width: 512, height: 512 });

  const toCanvasCoords = useCallback(
    (relativeX: number, relativeY: number) => ({
      x: relativeX * canvasSize.width,
      y: relativeY * canvasSize.height,
    }),
    [canvasSize],
  );

  const toRelativeCoords = useCallback(
    (canvasX: number, canvasY: number) => ({
      x: canvasX / canvasSize.width,
      y: canvasY / canvasSize.height,
    }),
    [canvasSize],
  );

  const loadPoseTemplate = useCallback((templateName: string) => {
    if (POSE_TEMPLATES[templateName]) {
      setKeypoints(POSE_TEMPLATES[templateName]);
      setDraggedPoint(null);
      setHoveredPoint(null);
    }
  }, []);

  // Draw skeleton on canvas
  const drawSkeleton = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark background
    ctx.fillStyle = "#15151b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    const gridSize = 32;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Center cross
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Draw skeleton connections
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    SKELETON_CONNECTIONS.forEach(([startId, endId]) => {
      const startPoint = keypoints.find((p) => p.id === startId);
      const endPoint = keypoints.find((p) => p.id === endId);
      if (startPoint && endPoint) {
        const start = toCanvasCoords(startPoint.x, startPoint.y);
        const end = toCanvasCoords(endPoint.x, endPoint.y);

        const lineGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        lineGradient.addColorStop(0, startPoint.color);
        lineGradient.addColorStop(1, endPoint.color);
        ctx.strokeStyle = lineGradient;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    });

    // Draw face connections
    if (showFace) {
      ctx.lineWidth = 2;
      FACE_CONNECTIONS.forEach(([startId, endId]) => {
        const startPoint = faceKeypoints.find((p) => p.id === startId);
        const endPoint = faceKeypoints.find((p) => p.id === endId);
        if (startPoint && endPoint) {
          const start = toCanvasCoords(startPoint.x, startPoint.y);
          const end = toCanvasCoords(endPoint.x, endPoint.y);
          ctx.strokeStyle = "#fbbf24";
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      });
    }

    // Draw body keypoints
    keypoints.forEach((point) => {
      const { x, y } = toCanvasCoords(point.x, point.y);

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.arc(x + 1, y + 1, 7, 0, 2 * Math.PI);
      ctx.fill();

      // Main
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hover effect
      if (hoveredPoint && hoveredPoint.id === point.id) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Drag highlight + label
      if (draggedPoint && draggedPoint.id === point.id) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.font = "11px sans-serif";
        const textWidth = ctx.measureText(point.name).width;
        ctx.fillRect(x - textWidth / 2 - 4, y - 24, textWidth + 8, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(point.name, x - textWidth / 2, y - 12);
      }
    });

    // Draw face keypoints
    if (showFace) {
      faceKeypoints.forEach((point) => {
        const { x, y } = toCanvasCoords(point.x, point.y);
        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }, [keypoints, faceKeypoints, canvasSize, draggedPoint, hoveredPoint, showFace, toCanvasCoords]);

  // Mouse handlers
  const getMousePos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const findNearestKeypoint = useCallback(
    (mouseX: number, mouseY: number) => {
      let nearest: ((Keypoint | FaceKeypoint) & { type: "body" | "face" }) | null = null;
      let minDistance = Infinity;

      keypoints.forEach((point) => {
        const { x, y } = toCanvasCoords(point.x, point.y);
        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
        if (distance < 15 && distance < minDistance) {
          minDistance = distance;
          nearest = { ...point, type: "body" };
        }
      });

      if (showFace) {
        faceKeypoints.forEach((point) => {
          const { x, y } = toCanvasCoords(point.x, point.y);
          const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
          if (distance < 10 && distance < minDistance) {
            minDistance = distance;
            nearest = { ...point, type: "face" };
          }
        });
      }

      return nearest;
    },
    [keypoints, faceKeypoints, showFace, toCanvasCoords],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const nearest = findNearestKeypoint(pos.x, pos.y);
      if (nearest) {
        setDraggedPoint(nearest);
        setMousePos(pos);
      }
    },
    [getMousePos, findNearestKeypoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const currentPos = getMousePos(e);
      setMousePos(currentPos);

      const nearest = findNearestKeypoint(currentPos.x, currentPos.y);
      setHoveredPoint(nearest);

      if (draggedPoint) {
        const relative = toRelativeCoords(currentPos.x, currentPos.y);
        const clampedX = Math.max(0.01, Math.min(0.99, relative.x));
        const clampedY = Math.max(0.01, Math.min(0.99, relative.y));

        if (draggedPoint.type === "body") {
          setKeypoints((prev) =>
            prev.map((point) =>
              point.id === draggedPoint.id
                ? { ...point, x: clampedX, y: clampedY }
                : point,
            ),
          );
        } else if (draggedPoint.type === "face") {
          setFaceKeypoints((prev) =>
            prev.map((point) =>
              point.id === draggedPoint.id
                ? { ...point, x: clampedX, y: clampedY }
                : point,
            ),
          );
        }
      }
    },
    [draggedPoint, getMousePos, toRelativeCoords, findNearestKeypoint],
  );

  const handleMouseUp = useCallback(() => setDraggedPoint(null), []);
  const handleMouseLeave = useCallback(() => {
    setDraggedPoint(null);
    setHoveredPoint(null);
  }, []);

  const resetPose = useCallback(() => {
    setKeypoints(BODY_25_KEYPOINTS);
    setFaceKeypoints(FACE_KEYPOINTS);
    setDraggedPoint(null);
    setHoveredPoint(null);
  }, []);

  // Generate OpenPose JSON data
  const generatePoseData = useCallback((): OpenPoseData => {
    const poseKeypoints2d: number[] = [];
    const faceKeypoints2d: number[] = [];

    keypoints.forEach((point) => {
      const { x, y } = toCanvasCoords(point.x, point.y);
      poseKeypoints2d.push(x, y, 1.0);
    });

    if (showFace) {
      faceKeypoints.forEach((point) => {
        const { x, y } = toCanvasCoords(point.x, point.y);
        faceKeypoints2d.push(x, y, 1.0);
      });
    }

    return {
      people: [
        {
          pose_keypoints_2d: poseKeypoints2d,
          face_keypoints_2d: faceKeypoints2d,
          hand_left_keypoints_2d: [],
          hand_right_keypoints_2d: [],
        },
      ],
    };
  }, [keypoints, faceKeypoints, showFace, toCanvasCoords]);

  // Render skeleton to PNG data URL
  const generateSkeletonPng = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  }, []);

  // Notify parent on pose changes
  useEffect(() => {
    onPoseChange?.(generatePoseData());
  }, [keypoints, faceKeypoints, generatePoseData, onPoseChange]);

  // Redraw canvas
  useEffect(() => {
    drawSkeleton();
  }, [drawSkeleton]);

  // Handle apply
  const handleApply = useCallback(() => {
    const poseData = generatePoseData();
    const skeletonPng = generateSkeletonPng();
    onApply?.(poseData, skeletonPng);
  }, [generatePoseData, generateSkeletonPng, onApply]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          resetPose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetPose]);

  const poseData = generatePoseData();

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: DESIGN_TOKENS.panelSolid }}>
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3 shrink-0"
        style={{ borderColor: DESIGN_TOKENS.border }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium" style={{ color: DESIGN_TOKENS.textPrimary }}>
            姿势参考编辑
          </h3>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
            }}
          >
            BODY_25
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              color: DESIGN_TOKENS.textMuted,
            }}
          >
            {canvasSize.width}x{canvasSize.height}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPose}
            className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
            style={{
              borderColor: DESIGN_TOKENS.border,
              color: DESIGN_TOKENS.textSecondary,
            }}
          >
            重置
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
            style={{
              borderColor: DESIGN_TOKENS.border,
              color: DESIGN_TOKENS.textSecondary,
            }}
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: DESIGN_TOKENS.accent }}
          >
            应用姿势
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: DESIGN_TOKENS.border }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="block cursor-crosshair"
              style={{ width: canvasSize.width, height: canvasSize.height }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            />
          </div>

          {/* Status bar */}
          <div
            className="flex items-center justify-between self-stretch rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                关键点: {keypoints.length + (showFace ? faceKeypoints.length : 0)}
              </span>
              <div className="flex items-center gap-2">
                {[
                  { label: "身体", color: "#3b82f6" },
                  ...(showFace ? [{ label: "面部", color: "#fbbf24" }] : []),
                ].map((badge) => (
                  <span
                    key={badge.label}
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: DESIGN_TOKENS.textMuted }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: badge.color }}
                    />
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {draggedPoint ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                  }}
                >
                  拖拽中: {draggedPoint.name}
                </span>
              ) : hoveredPoint ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    backgroundColor: "rgba(251, 191, 36, 0.15)",
                    color: "#fbbf24",
                  }}
                >
                  悬停: {hoveredPoint.name}
                </span>
              ) : null}
              <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                {mousePos.x.toFixed(0)}, {mousePos.y.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex w-48 shrink-0 flex-col gap-3 overflow-y-auto">
          {/* Pose templates */}
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: DESIGN_TOKENS.border,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <h4 className="mb-2 text-[11px] font-medium" style={{ color: DESIGN_TOKENS.textMuted }}>
              姿势模板
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(POSE_TEMPLATES).map(([key]) => (
                <button
                  key={key}
                  onClick={() => loadPoseTemplate(key)}
                  className="rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-white/5"
                  style={{
                    borderColor: DESIGN_TOKENS.border,
                    color: DESIGN_TOKENS.textSecondary,
                  }}
                >
                  {TEMPLATE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: DESIGN_TOKENS.border,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <h4 className="mb-2 text-[11px] font-medium" style={{ color: DESIGN_TOKENS.textMuted }}>
              显示选项
            </h4>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs" style={{ color: DESIGN_TOKENS.textSecondary }}>
                面部关键点
              </span>
              <div
                className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors"
                style={{
                  backgroundColor: showFace
                    ? DESIGN_TOKENS.accent
                    : "rgba(255, 255, 255, 0.12)",
                }}
                onClick={() => setShowFace((v) => !v)}
              >
                <span
                  className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                  style={{
                    transform: showFace ? "translateX(20px)" : "translateX(3px)",
                  }}
                />
              </div>
            </label>
          </div>

          {/* Export info */}
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: DESIGN_TOKENS.border,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <h4 className="mb-2 text-[11px] font-medium" style={{ color: DESIGN_TOKENS.textMuted }}>
              输出预览 (JSON)
            </h4>
            <pre
              className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg p-2 text-[10px] leading-relaxed"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                color: DESIGN_TOKENS.textMuted,
              }}
            >
              {JSON.stringify(poseData, null, 2).slice(0, 400)}
              {JSON.stringify(poseData, null, 2).length > 400 ? "..." : ""}
            </pre>
            <div className="mt-2 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              格式: OpenPose BODY_25 · ControlNet 兼容
            </div>
            <div className="mt-1 text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
              快捷键: <kbd className="rounded bg-white/10 px-1">R</kbd> 重置
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
