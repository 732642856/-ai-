// ============================================================================
// ContinuityGuard — 六维连续性检查引擎
// 对标 PenShot (MIT) 的 continuity checking 设计
// ============================================================================

// ---- 类型定义 ----

export type ContinuityDimension = "character" | "scene" | "action" | "style" | "time" | "prop";
export type ContinuitySeverity = "error" | "warning" | "info";

export interface ContinuityIssue {
  dimension: ContinuityDimension;
  severity: ContinuitySeverity;
  message: string;
  shotId?: string;
  sceneId?: string;
}

export interface ScriptScene {
  sceneId: string;
  characters: string[];
  location: string;
  timeOfDay: string;
}

export interface ScriptData {
  scenes: ScriptScene[];
}

export interface ShotFragment {
  text: string;
  characterName?: string;
}

export interface ShotInstructions {
  fragments: ShotFragment[];
}

export interface ShotEntry {
  shotId: string;
  sceneId: string;
  instructions: ShotInstructions;
}

export interface ShotSequenceData {
  shots: ShotEntry[];
}

// ---- ContinuityGuard 类 ----

export class ContinuityGuard {
  private issues: ContinuityIssue[] = [];

  /**
   * 执行全部六维连续性检查
   */
  checkAllContinuity(scriptData: ScriptData, shotSequence: ShotSequenceData): ContinuityIssue[] {
    this.issues = [];

    this.checkCharacterContinuity(scriptData, shotSequence);
    this.checkSceneContinuity(scriptData, shotSequence);
    this.checkActionContinuity(shotSequence);
    this.checkStyleContinuity(scriptData, shotSequence);
    this.checkTimeContinuity(scriptData, shotSequence);
    this.checkPropContinuity(shotSequence);

    return this.issues;
  }

  // ========== 一维：角色连续性 ==========
  private checkCharacterContinuity(scriptData: ScriptData, shotSequence: ShotSequenceData): void {
    // 收集脚本中所有声明的角色
    const allScriptCharacters = new Set<string>();
    for (const scene of scriptData.scenes) {
      for (const ch of scene.characters) {
        allScriptCharacters.add(ch.trim().toLowerCase());
      }
    }

    // 检查每个镜头中是否引用了未在脚本中声明的角色
    for (const shot of shotSequence.shots) {
      for (const fragment of shot.instructions?.fragments || []) {
        if (fragment.characterName) {
          const normalized = fragment.characterName.trim().toLowerCase();
          if (!allScriptCharacters.has(normalized) && allScriptCharacters.size > 0) {
            this.issues.push({
              dimension: "character",
              severity: "warning",
              message: `镜头 "${shot.shotId}" 中出现了脚本未声明的角色 "${fragment.characterName}"`,
              shotId: shot.shotId,
              sceneId: shot.sceneId,
            });
          }
        }
      }
    }

    // 检查脚本中声明的角色是否在镜头序列中出现
    if (allScriptCharacters.size > 0 && shotSequence.shots.length > 0) {
      const shotCharacters = new Set<string>();
      for (const shot of shotSequence.shots) {
        const shotText = this.collectShotText(shot).toLowerCase();
        for (const ch of allScriptCharacters) {
          if (shotText.includes(ch)) {
            shotCharacters.add(ch);
          }
        }
      }

      for (const ch of allScriptCharacters) {
        if (!shotCharacters.has(ch)) {
          this.issues.push({
            dimension: "character",
            severity: "info",
            message: `角色 "${ch}" 在脚本中声明但未在镜头序列中出现`,
          });
        }
      }
    }
  }

  // ========== 二维：场景连续性 ==========
  private checkSceneContinuity(scriptData: ScriptData, shotSequence: ShotSequenceData): void {
    // 按 sceneId 分组镜头
    const sceneShots = new Map<string, ShotEntry[]>();
    for (const shot of shotSequence.shots) {
      const sid = shot.sceneId || "unknown";
      const list = sceneShots.get(sid) || [];
      list.push(shot);
      sceneShots.set(sid, list);
    }

    for (const [sceneId, shots] of sceneShots) {
      // 查找对应脚本场景的位置信息
      const scriptScene = scriptData.scenes.find(
        (s) => s.sceneId === sceneId || s.sceneId === sceneId.replace(/[_-]?\d+$/, "")
      );

      if (!scriptScene && sceneId !== "unknown") {
        this.issues.push({
          dimension: "scene",
          severity: "warning",
          message: `场景 "${sceneId}" 在脚本数据中未找到对应定义`,
          sceneId,
        });
        continue;
      }

      if (scriptScene?.location) {
        // 检查镜头文本中是否提及该场景
        const location = scriptScene.location.trim();
        const hasLocationMention = shots.some((shot) =>
          this.collectShotText(shot).includes(location)
        );
        if (!hasLocationMention && shots.length > 0) {
          this.issues.push({
            dimension: "scene",
            severity: "info",
            message: `场景 "${sceneId}" 的镜头中未明确提及位置 "${location}"`,
            sceneId,
          });
        }
      }
    }
  }

  // ========== 三维：动作连续性 ==========
  private checkActionContinuity(shotSequence: ShotSequenceData): void {
    if (shotSequence.shots.length < 2) return;

    // 检查连续镜头之间的动作文本是否有断裂
    const actionKeywords = ["走", "跑", "跳", "站", "坐", "拿", "放", "打", "看", "说", "笑", "哭", "转身", "靠近", "离开"];
    let prevActions = new Set<string>();

    for (let i = 0; i < shotSequence.shots.length; i++) {
      const shot = shotSequence.shots[i];
      const shotText = this.collectShotText(shot);
      const currentActions = new Set<string>();

      for (const kw of actionKeywords) {
        if (shotText.includes(kw)) {
          currentActions.add(kw);
        }
      }

      // 检查与前一个镜头的动作衔接
      if (i > 0 && currentActions.size === 0 && prevActions.size > 0) {
        this.issues.push({
          dimension: "action",
          severity: "info",
          message: `镜头 "${shot.shotId}" 没有动作描述，可能影响与前一个镜头的动作衔接`,
          shotId: shot.shotId,
          sceneId: shot.sceneId,
        });
      }

      prevActions = currentActions;
    }
  }

  // ========== 四维：风格连续性 ==========
  private checkStyleContinuity(_scriptData: ScriptData, shotSequence: ShotSequenceData): void {
    if (shotSequence.shots.length < 2) return;

    const styleIndicators = [
      { keyword: "特写", label: "特写镜头" },
      { keyword: "全景", label: "全景镜头" },
      { keyword: "中景", label: "中景镜头" },
      { keyword: "远景", label: "远景镜头" },
      { keyword: "近景", label: "近景镜头" },
      { keyword: "俯拍", label: "俯拍" },
      { keyword: "仰拍", label: "仰拍" },
    ];

    const shotStyles: string[] = [];
    for (const shot of shotSequence.shots) {
      const text = this.collectShotText(shot);
      const found = styleIndicators.filter((si) => text.includes(si.keyword)).map((si) => si.label).join("+");
      shotStyles.push(found || "未指定");
    }

    // 检查是否存在剧烈的风格跳跃（连续3个镜头都完全不同的风格）
    if (shotStyles.length >= 3) {
      for (let i = 2; i < shotStyles.length; i++) {
        const a = shotStyles[i - 2];
        const b = shotStyles[i - 1];
        const c = shotStyles[i];
        if (a !== "未指定" && b !== "未指定" && c !== "未指定" && a !== b && b !== c && a !== c) {
          this.issues.push({
            dimension: "style",
            severity: "warning",
            message: `镜头 ${i - 1} 到 ${i + 1} 连续三个镜头的景别/视角变化剧烈（${a} → ${b} → ${c}），可能影响视觉连贯性`,
            shotId: shotSequence.shots[i].shotId,
            sceneId: shotSequence.shots[i].sceneId,
          });
        }
      }
    }
  }

  // ========== 五维：时间连续性 ==========
  private checkTimeContinuity(scriptData: ScriptData, shotSequence: ShotSequenceData): void {
    const timeOrder: Record<string, number> = {
      dawn: 1, morning: 2, noon: 3, afternoon: 4, evening: 5, dusk: 6, night: 7,
    };

    const chineseTimeOrder: Record<string, string> = {
      "清晨": "dawn", "早晨": "morning", "上午": "morning", "中午": "noon",
      "下午": "afternoon", "傍晚": "evening", "黄昏": "dusk",
      "晚上": "night", "夜晚": "night", "深夜": "night",
    };

    // 收集各场景的时间设定
    const sceneTimeMap = new Map<string, string>();
    for (const scene of scriptData.scenes) {
      const rawTime = scene.timeOfDay?.trim().toLowerCase() || "";
      const englishTime = timeOrder[rawTime] ? rawTime : (chineseTimeOrder[rawTime] || rawTime);
      sceneTimeMap.set(scene.sceneId, englishTime);
    }

    // 按场景分组镜头，检查时间是否一致
    const sceneShotTimes = new Map<string, string[]>();
    for (const shot of shotSequence.shots) {
      const sid = shot.sceneId;
      const text = this.collectShotText(shot).toLowerCase();
      const expectedTime = sceneTimeMap.get(sid);

      // 尝试从镜头文本中检测时间
      const detectedTimes: string[] = [];
      for (const [chinese, english] of Object.entries(chineseTimeOrder)) {
        if (text.includes(chinese) || text.includes(english)) {
          detectedTimes.push(english);
        }
      }

      const times = sceneShotTimes.get(sid) || [];
      times.push(...detectedTimes);
      sceneShotTimes.set(sid, times);

      // 如果镜头时间与剧本设定的时间冲突
      if (expectedTime && detectedTimes.length > 0) {
        const expectedOrder = timeOrder[expectedTime] || 0;
        for (const dt of detectedTimes) {
          const detectedOrder = timeOrder[dt] || 0;
          if (detectedOrder > 0 && expectedOrder > 0 && Math.abs(detectedOrder - expectedOrder) > 2) {
            this.issues.push({
              dimension: "time",
              severity: "warning",
              message: `场景 "${sid}" 脚本设定时间为 "${expectedTime}"，但镜头 "${shot.shotId}" 中检测到 "${dt}"，时间跳跃过大`,
              shotId: shot.shotId,
              sceneId: sid,
            });
          }
        }
      }
    }
  }

  // ========== 六维：道具连续性 ==========
  private checkPropContinuity(shotSequence: ShotSequenceData): void {
    if (shotSequence.shots.length < 2) return;

    // 简单道具检测——从镜头文本中提取常见名词作为道具候选
    const propPattern = /([\u4e00-\u9fff]{1,3})(剑|刀|枪|棍|杖|笔|书|信|包|袋|杯|碗|瓶|灯|伞|镜|盒|箱|琴|棋|画)/g;
    const shotProps: Array<{ shotId: string; props: Set<string> }> = [];

    for (const shot of shotSequence.shots) {
      const text = this.collectShotText(shot);
      const props = new Set<string>();
      let match: RegExpExecArray | null;
      const localPattern = /[\u4e00-\u9fff]{1,3}(剑|刀|枪|棍|杖|笔|书|信|包|袋|杯|碗|瓶|灯|伞|镜|盒|箱|琴|棋|画)/g;
      while ((match = localPattern.exec(text)) !== null) {
        props.add(match[0]);
      }
      shotProps.push({ shotId: shot.shotId, props });
    }

    // 检查是否有道具在某个镜头消失后不再出现（简单启发式）
    const allProps = new Map<string, { firstAppear: number; lastAppear: number }>();
    for (let i = 0; i < shotProps.length; i++) {
      for (const prop of shotProps[i].props) {
        const entry = allProps.get(prop);
        if (entry) {
          entry.lastAppear = i;
        } else {
          allProps.set(prop, { firstAppear: i, lastAppear: i });
        }
      }
    }

    for (const [prop, { firstAppear, lastAppear }] of allProps) {
      if (lastAppear < shotProps.length - 1 && firstAppear >= 0) {
        this.issues.push({
          dimension: "prop",
          severity: "info",
          message: `道具 "${prop}" 在镜头 ${shotProps[lastAppear].shotId} 后不再出现，确认是否有意为之`,
          shotId: shotProps[lastAppear].shotId,
        });
      }
    }
  }

  // ---- 辅助方法 ----

  private collectShotText(shot: ShotEntry): string {
    return (shot.instructions?.fragments || []).map((f) => f.text).join(" ");
  }
}

// ---- 格式化连续性报告 ----

export function formatContinuityReport(issues: ContinuityIssue[]): string {
  if (issues.length === 0) return "✅ 六维连续性检查全部通过";

  const bySeverity = {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };

  const lines: string[] = [];

  lines.push(`🔍 六维连续性检查报告 — ${issues.length} 项发现`);
  lines.push("");

  const dimLabels: Record<string, string> = {
    character: "角色连续性",
    scene: "场景连续性",
    action: "动作连续性",
    style: "风格连续性",
    time: "时间连续性",
    prop: "道具连续性",
  };

  if (bySeverity.error.length > 0) {
    lines.push(`❌ 错误 (${bySeverity.error.length})：`);
    for (const issue of bySeverity.error) {
      lines.push(`  - [${dimLabels[issue.dimension] || issue.dimension}] ${issue.message}`);
    }
    lines.push("");
  }

  if (bySeverity.warning.length > 0) {
    lines.push(`⚠️ 警告 (${bySeverity.warning.length})：`);
    for (const issue of bySeverity.warning) {
      lines.push(`  - [${dimLabels[issue.dimension] || issue.dimension}] ${issue.message}`);
    }
    lines.push("");
  }

  if (bySeverity.info.length > 0) {
    lines.push(`ℹ️ 提示 (${bySeverity.info.length})：`);
    for (const issue of bySeverity.info) {
      lines.push(`  - [${dimLabels[issue.dimension] || issue.dimension}] ${issue.message}`);
    }
  }

  return lines.join("\n");
}
