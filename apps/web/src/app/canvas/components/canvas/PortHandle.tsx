// ============================================================================
// PortHandle — Typed Handle with visual port type indicator (TapNow 对标)
// ============================================================================
"use client";

import { Handle, Position, type HandleProps } from "@xyflow/react";
import type { PortType } from "../../types/port-types";
import { PORT_TYPE_COLORS, PORT_TYPE_LABELS } from "../../types/port-types";

interface PortHandleProps extends Omit<HandleProps, "type"> {
  portType?: PortType;
  portLabel?: string;
}

const SIZE_MAP: Record<PortType, number> = {
  image: 12,
  video: 11,
  audio: 9,
  text: 10,
  script: 10,
  storyboard: 10,
  prompt: 10,
  subtitle: 8,
  music: 8,
  metadata: 7,
  any: 10,
};

export function PortHandle({ portType = "any", portLabel, ...props }: PortHandleProps) {
  const colors = PORT_TYPE_COLORS[portType];
  const size = SIZE_MAP[portType];

  // Determine if this is a target (input) or source (output) handle
  const isTarget = props.position === Position.Top || props.position === Position.Left;

  return (
    <div
      className="port-handle-group"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {isTarget && portLabel && (
        <span
          style={{
            fontSize: 9,
            color: "rgba(255, 255, 255, 0.38)",
            whiteSpace: "nowrap",
            maxWidth: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {portLabel}
        </span>
      )}
      <Handle
        {...props}
        style={{
          width: size,
          height: size,
          background: colors.stroke,
          border: `2px solid ${colors.bg}`,
          borderRadius: "50%",
          transition: "transform 0.15s, box-shadow 0.15s",
          ...(props.style ?? {}),
        }}
        className="port-handle"
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = "scale(1.4)";
          el.style.boxShadow = `0 0 6px ${colors.stroke}`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = "scale(1)";
          el.style.boxShadow = "none";
        }}
        title={`${PORT_TYPE_LABELS[portType]}${portLabel ? `: ${portLabel}` : ""}`}
      />
      {!isTarget && portLabel && (
        <span
          style={{
            fontSize: 9,
            color: "rgba(255, 255, 255, 0.38)",
            whiteSpace: "nowrap",
            maxWidth: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {portLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Convenience factory — creates an array of typed port handles for a node.
 */
export function createPortHandles(
  ports: Array<{
    id: string;
    type: PortType;
    position: "top" | "bottom" | "left" | "right";
    label: string;
    isConnectable?: boolean;
  }>,
): React.ReactElement[] {
  const positionMap = {
    top: Position.Top,
    bottom: Position.Bottom,
    left: Position.Left,
    right: Position.Right,
  };

  return ports.map((port) => (
    <PortHandle
      key={port.id}
      id={port.id}
      type={port.type === "image" ? "source" : port.type === "any" ? "source" : "target"}
      position={positionMap[port.position]}
      portType={port.type}
      portLabel={port.label}
      isConnectable={port.isConnectable ?? true}
    />
  ));
}
