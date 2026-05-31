// ============================================================================
// BatchProgressBar — 批量生图全局进度条
// ref 驱动，不依赖 React 状态管理，避免高频 setNodes 导致重渲染
// fixed 定位，画布顶部居中，自动渐隐
// ============================================================================
"use client";

import React, { useEffect, useRef, useCallback } from "react";

export interface BatchProgressHandle {
  /** 重置并启动新一轮进度追踪 */
  start: (total: number) => void;
  /** 推进一步（成功） */
  tick: () => void;
  /** 标记失败（仍推进，但记录失败数） */
  fail: () => void;
  /** 手动完成（渐隐） */
  finish: () => void;
  /** 读取当前进度 */
  getProgress: () => { current: number; total: number; failed: number };
}

interface BatchProgressBarProps {
  ref: React.Ref<BatchProgressHandle>;
}

export default function BatchProgressBar({ ref }: BatchProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  // 数据引用（不触发重渲染）
  const currentRef = useRef(0);
  const totalRef = useRef(0);
  const failedRef = useRef(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track mount state for external calls (start/tick/fail may be invoked after unmount)
  useEffect(() => {
    return () => { isMountedRef.current = false };
  }, []);

  const show = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const updateBar = useCallback(() => {
    const current = currentRef.current;
    const total = totalRef.current;
    const failed = failedRef.current;

    const bar = barRef.current;
    if (bar && total > 0) {
      const pct = Math.min((current / total) * 100, 100);
      bar.style.width = `${pct}%`;
      bar.style.background = failed > 0
        ? "linear-gradient(90deg, #3b82f6, #f59e0b)"
        : "linear-gradient(90deg, #3b82f6, #8b5cf6)";
    }

    const text = textRef.current;
    if (text) {
      const done = current >= total;
      if (done) {
        text.textContent = failed > 0
          ? `✅ ${current}/${total} 完成 · ${failed} 个失败`
          : `✅ ${current}/${total} 全部完成`;
      } else {
        text.textContent = failed > 0
          ? `🖼️ ${current}/${total} · ${failed} 个失败...`
          : `🖼️ ${current}/${total} 生成中...`;
      }
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    start(total: number) {
      if (!isMountedRef.current) return;
      currentRef.current = 0;
      totalRef.current = total;
      failedRef.current = 0;
      show();
      updateBar();
    },
    tick() {
      currentRef.current++;
      updateBar();
      if (currentRef.current >= totalRef.current) {
        fadeTimerRef.current = setTimeout(() => {
          const el = containerRef.current;
          if (el) {
            el.style.opacity = "0";
            el.style.transform = "translateY(-8px)";
          }
        }, 3000);
      }
    },
    fail() {
      failedRef.current++;
      currentRef.current++;
      updateBar();
      if (currentRef.current >= totalRef.current) {
        fadeTimerRef.current = setTimeout(() => {
          const el = containerRef.current;
          if (el) {
            el.style.opacity = "0";
            el.style.transform = "translateY(-8px)";
          }
        }, 5000);
      }
    },
    finish() {
      const el = containerRef.current;
      if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateY(-8px)";
      }
    },
    getProgress() {
      return {
        current: currentRef.current,
        total: totalRef.current,
        failed: failedRef.current,
      };
    },
  }), [show, updateBar]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{
        opacity: 0,
        transform: "translateY(-8px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl px-5 py-3 shadow-2xl border border-gray-700/50 min-w-[280px]">
        <span
          ref={textRef}
          className="text-sm text-gray-200 font-medium block mb-2"
        >
          🖼️ 准备中...
        </span>
        <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
          <div
            ref={barRef}
            className="h-full rounded-full"
            style={{
              width: "0%",
              background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
