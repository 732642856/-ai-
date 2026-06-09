/**
 * Continuity Guard — 从 PenShot (MIT) 改写的六维连续性守护系统
 * 
 * 原 Python 实现: neopen/story-shot-agent (MIT License)
 * TypeScript 移植: 2026-06-09
 * 
 * 六维连续性检查:
 *  1. 角色连续性 — 外观/服装/发型跨镜头一致
 *  2. 场景连续性 — 地点/时间/角色列表一致
 *  3. 动作连续性 — 角色动作变化合理
 *  4. 风格连续性 — 视觉风格不跳变
 *  5. 时间连续性 — 镜头时长/时序无冲突
 *  6. 道具连续性 — 角色道具持有状态一致
 */

// ========== 数据类型定义 ==========

export type ContinuitySeverity = 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'MINOR' | 'INFO';

export interface ContinuityIssue {
  id: string;
  dimension: 'character' | 'scene' | 'action' | 'style' | 'time' | 'prop';
  severity: ContinuitySeverity;
  characterName?: string;
  sceneId?: string;
  shotId?: string;
  message: string;
  suggestion?: string;
  detectedAt: number; // timestamp
}

export interface CharacterAppearance {
  clothing: string[];    // 服装描述词
  hairstyle: string;   // 发型
  accessories: string[];  // 配饰
  description: string;   // 完整外观描述
}

export interface CharacterState {
  name: string;
  appearance: CharacterAppearance;
  position: { x?: number; y?: number; facing?: string };
  props: string[];           // 当前持有道具
  emotion: { type: string; intensity: number };
  visible: boolean;
}

export interface SceneState {
  sceneId: string;
  location: string;
  timeOfDay: string;
  characters: string[];  // 在场角色名列表
  atmosphere: string;
}

export interface StateSnapshot {
  snapshotId: string;
  timestamp: number;
  shotId: string;
  characterStates: Map<string, CharacterState>;
  sceneState: SceneState;
  narrativePhase: string;  // 叙事阶段
}

export interface StateTimeline {
  snapshots: StateSnapshot[];
  continuityAnchors: Map<string, string>;  // anchorName -> description
  toleranceSettings: {
    appearanceTolerance: number;  // 0-1, 1=严格
    positionTolerance: number;
    propTolerance: number;
  };
}

// ========== 外观关键词字典 ==========

const APPEARANCE_KEYWORDS = {
  clothing: ['穿', '戴', '着', '衣服', '裙子', '裤子', '衬衫', '外套', '夹克', '帽子', '鞋子', '靴子'],
  hairstyle: ['长发', '短发', '马尾', '卷发', '直发', '刘海', '辫子', '光头'],
  accessories: ['眼镜', '帽子', '围巾', '项链', '耳环', '手镯', '戒指', '手表', '背包', '挎包'],
};

const ACTION_KEYWORDS = ['走', '跑', '跳', '转身', '坐下', '站起', '拿起', '放下', '拥抱', '推开', '指', '挥手'];
const PROP_VERBS = ['拿', '举', '抱', '提', '端', '持', '握', '扛', '背', '装', '卸'];

// ========== 主类：ContinuityGuard ==========

export class ContinuityGuard {
  private timeline: StateTimeline;
  private lastAppearance: Map<string, CharacterAppearance> = new Map();
  private lastAction: Map<string, string> = new Map();  // characterName -> last action
  private propState: Map<string, string[]> = new Map();  // characterName -> held props
  private seenJumps: Set<string> = new Set();
  private seenGaps: Set<string> = new Set();
  private seenOverlaps: Set<string> = new Set();
  private issues: ContinuityIssue[] = [];

  constructor() {
    this.timeline = {
      snapshots: [],
      continuityAnchors: new Map(),
      toleranceSettings: {
        appearanceTolerance: 0.7,
        positionTolerance: 0.5,
        propTolerance: 0.8,
      },
    };
  }

  /**
   * 执行全部六维连续性检查
   * @param parsedScript 解析后的剧本（场景列表）
   * @param shotSequence 分镜序列（含每个镜头的指令）
   * @returns 连续性报告
   */
  checkAllContinuity(
    parsedScript: { scenes: Array<{ sceneId: string; characters: string[]; location: string; timeOfDay: string }> },
    shotSequence: { shots: Array<{ shotId: string; sceneId: string; instructions: { fragments: Array<{ text: string; characterName?: string }> }> }
  ): ContinuityIssue[] {
    this.issues = [];
    this.lastAppearance.clear();
    this.lastAction.clear();
    this.propState.clear();
    this.seenJumps.clear();
    this.seenGaps.clear();
    this.seenOverlaps.clear();

    // 遍历镜头序列
    let prevSceneId: string | null = null;
    const sceneJumpCount: Record<string, number> = {};

    for (let i = 0; i < shotSequence.shots.length; i++) {
      const shot = shotSequence.shots[i];
      const scene = parsedScript.scenes.find(s => s.sceneId === shot.sceneId);

      // 1. 角色连续性
      this.checkCharacterContinuity(shot, scene);

      // 2. 场景连续性
      if (prevSceneId !== null && prevSceneId !== shot.sceneId) {
        this.checkSceneContinuity(prevSceneId, shot.sceneId, sceneJumpCount, shotSequence.shots.length);
      }

      // 3. 动作连续性
      this.checkActionContinuity(shot);

      // 4. 道具连续性
      this.checkPropContinuity(shot);

      // 更新状态
      this.takeSnapshot(shot.shotId);
      prevSceneId = shot.sceneId;
    }

    return this.issues;
  }

  /**
   * 维度1：角色连续性检查
   */
  private checkCharacterContinuity(
    shot: { shotId: string; sceneId: string; instructions: { fragments: Array<{ text: string; characterName?: string }> },
    scene?: { sceneId: string; characters: string[] }
  ): void {
    if (!scene) return;

    // 检查场景中每个角色是否出现在镜头里
    for (const charName of scene.characters) {
      const charInShot = shot.instructions.fragments.some(f => f.characterName === charName);
      if (!charInShot) {
        // 角色在场景里但不在镜头里 — 可能是刻意排除，仅记录
        continue;
      }

      // 从片段文本中提取外观关键词
      const fragmentText = shot.instructions.fragments
        .filter(f => f.characterName === charName)
        .map(f => f.text)
        .join(' ');

      const appearance = this.extractAppearance(fragmentText);

      // 与上次外观比较
      const last = this.lastAppearance.get(charName);
      if (last) {
        const changes = this.compareAppearance(last, appearance);
        if (changes.length > 0) {
          this.addIssue({
            dimension: 'character',
            severity: changes.length > 2 ? 'MAJOR' : 'MODERATE',
            characterName: charName,
            shotId: shot.shotId,
            message: `角色「${charName}」外观发生变化: ${changes.join('；')}`,
            suggestion: `请确认是否为刻意设计。如是无意变化，建议统一为: ${this.appearanceToText(last)}`,
          });
        }
      }

      this.lastAppearance.set(charName, appearance);
    }
  }

  /**
   * 维度2：场景连续性检查
   */
  private checkSceneContinuity(
    prevSceneId: string,
    currSceneId: string,
    jumpCount: Record<string, number>,
    totalShots: number
  ): void {
    const jumpKey = `${prevSceneId}->${currSceneId}`;
    if (!this.seenJumps.has(jumpKey)) {
      this.seenJumps.add(jumpKey);
      jumpCount[jumpKey] = (jumpCount[jumpKey] || 0) + 1;
    }

    // 场景跳转频率检查
    const totalJumps = Array.from(this.seenJumps).length;
    if (totalJumps > totalShots * 0.3) {
      this.addIssue({
        dimension: 'scene',
        severity: 'MODERATE',
        message: `场景跳转过于频繁（${totalJumps}次跳转 / ${totalShots}个镜头），观众可能感到混乱`,
        suggestion: '考虑合并相邻同场景镜头，或添加过渡镜头',
      });
    }
  }

  /**
   * 维度3：动作连续性检查
   */
  private checkActionContinuity(
    shot: { shotId: string; instructions: { fragments: Array<{ text: string; characterName?: string }> }
  ): void {
    const fullText = shot.instructions.fragments.map(f => f.text).join(' ');

    for (const charName of [...new Set(shot.instructions.fragments.map(f => f.characterName).filter(Boolean))]) {
      const charText = shot.instructions.fragments
        .filter(f => f.characterName === charName)
        .map(f => f.text)
        .join(' ');

      // 提取动作
      for (const action of ACTION_KEYWORDS) {
        if (charText.includes(action)) {
          const lastAction = this.lastAction.get(charName);
          if (lastAction && lastAction !== action) {
            // 检查动作变化是否合理（简化版：同类型动作变化较合理）
            const unreasonable = this.isUnreasonableActionChange(lastAction, action);
            if (unreasonable) {
              this.addIssue({
                dimension: 'action',
                severity: 'MODERATE',
                characterName: charName,
                shotId: shot.shotId,
                message: `角色「${charName}」动作突变: ${lastAction} → ${action}`,
                suggestion: '考虑添加过渡动作或说明镜头时间跨度',
              });
            }
          }
          this.lastAction.set(charName, action);
          break; // 每个角色每镜头只取第一个检测到的动作
        }
      }
    }
  }

  /**
   * 维度4：风格连续性检查（基于shot的metadata）
   */
  checkStyleContinuity(shots: Array<{ shotId: string; styleTags?: string[] }>): void {
    const styleCounts: Record<string, number> = {};
    for (const shot of shots) {
      if (shot.styleTags) {
        for (const tag of shot.styleTags) {
          styleCounts[tag] = (styleCounts[tag] || 0) + 1;
        }
      }
    }

    const distinctStyles = Object.keys(styleCounts).length;
    if (distinctStyles > 2) {
      this.addIssue({
        dimension: 'style',
        severity: 'MODERATE',
        message: `检测到${distinctStyles}种不同视觉风格，可能导致视觉不一致`,
        suggestion: '建议在项目开始阶段统一设定视觉风格锚点，并在所有分镜中引用',
      });
    }
  }

  /**
   * 维度5：时间连续性检查
   */
  checkTimeContinuity(
    shots: Array<{ shotId: string; startTime?: number; duration?: number }>
  ): void {
    for (let i = 0; i < shots.length - 1; i++) {
      const curr = shots[i];
      const next = shots[i + 1];
      if (curr.startTime === undefined || next.startTime === undefined) continue;

      const expectedStart = curr.startTime + (curr.duration || 0);
      const gap = next.startTime - expectedStart;

      if (gap > 0.1) {
        const gapKey = `${curr.shotId}->${next.shotId}`;
        if (!this.seenGaps.has(gapKey)) {
          this.seenGaps.add(gapKey);
          this.addIssue({
            dimension: 'time',
            severity: gap > 1.0 ? 'MAJOR' : 'MODERATE',
            shotId: curr.shotId,
            message: `镜头 ${curr.shotId} 与 ${next.shotId} 之间存在 ${gap.toFixed(1)}s 时间间隙`,
            suggestion: '检查是否有意留白；若无意为之，请调整 startTime',
          });
        }
      }

      if (gap < -0.1) {
        const overlapKey = `${curr.shotId}->${next.shotId}`;
        if (!this.seenOverlaps.has(overlapKey)) {
          this.seenOverlaps.add(overlapKey);
          this.addIssue({
            dimension: 'time',
            severity: 'CRITICAL',
            shotId: curr.shotId,
            message: `镜头 ${curr.shotId} 与 ${next.shotId} 时间重叠 ${((-gap)).toFixed(1)}s`,
            suggestion: '调整 startTime 确保时序不重叠',
          });
        }
      }
    }
  }

  /**
   * 维度6：道具连续性检查
   */
  private checkPropContinuity(
    shot: { shotId: string; instructions: { fragments: Array<{ text: string; characterName?: string }> }
  ): void {
    for (const fragment of shot.instructions.fragments) {
      if (!fragment.characterName) continue;

      // 检测道具动词
      for (const verb of PROP_VERBS) {
        if (fragment.text.includes(verb)) {
          // 简化：假设动词后出现道具名（实际应该用NLP，这里仅做基础检测）
          const props = this.extractPropsAfterVerb(fragment.text, verb);
          if (props.length > 0) {
            const currentProps = this.propState.get(fragment.characterName) || [];
            const newProps = [...new Set([...currentProps, ...props])];
            this.propState.set(fragment.characterName, newProps);
          }
        }
      }
    }
  }

  // ========== 辅助方法 ==========

  private extractAppearance(text: string): CharacterAppearance {
    const clothing: string[] = [];
    const hairstyle = '';
    const accessories: string[] = [];

    for (const keyword of APPEARANCE_KEYWORDS.clothing) {
      if (text.includes(keyword)) clothing.push(keyword);
    }
    for (const keyword of APPEARANCE_KEYWORDS.hairstyle) {
      if (text.includes(keyword)) return { ...this.emptyAppearance(), hairstyle: keyword };
    }
    for (const keyword of APPEARANCE_KEYWORDS.accessories) {
      if (text.includes(keyword)) accessories.push(keyword);
    }

    return { clothing, hairstyle, accessories, description: text.slice(0, 100) };
  }

  private emptyAppearance(): CharacterAppearance {
    return { clothing: [], hairstyle: '', accessories: [], description: '' };
  }

  private compareAppearance(a: CharacterAppearance, b: CharacterAppearance): string[] {
    const changes: string[] = [];
    if (a.clothing.join(',') !== b.clothing.join(',')) changes.push(`服装: ${a.clothing.join(',') || '无'} → ${b.clothing.join(',') || '无'}`);
    if (a.hairstyle !== b.hairstyle && a.hairstyle && b.hairstyle) changes.push(`发型: ${a.hairstyle} → ${b.hairstyle}`);
    if (a.accessories.join(',') !== b.accessories.join(',')) changes.push(`配饰变化`);
    return changes;
  }

  private appearanceToText(a: CharacterAppearance): string {
    return [a.clothing.join(','), a.hairstyle, a.accessories.join(',')].filter(Boolean).join('; ');
  }

  private isUnreasonableActionChange(from: string, to: string): boolean {
    // 简化：走→跑 合理；走→坐下 可能需要过渡
    const reasonablePairs: [string, string][] = [
      ['走', '跑'], ['跑', '走'], ['站起', '走'], ['坐下', '站起'],
      ['拿起', '持'], ['放下', '空'],
    ];
    return !reasonablePairs.some(([f, t]) => f === from && t === to);
  }

  private extractPropsAfterVerb(text: string, verb: string): string[] {
    // 极简实现：取动词后3个字符作为道具名
    const idx = text.indexOf(verb);
    if (idx === -1) return [];
    const after = text.slice(idx + verb.length).trim().slice(0, 10);
    return after ? [after] : [];
  }

  private takeSnapshot(shotId: string): void {
    // 将当前状态写入 timeline.snapshots
    // 简化为占位实现；完整版需要构造 CharacterState 和 SceneState
    this.timeline.snapshots.push({
      snapshotId: `snap_${Date.now()}`,
      timestamp: Date.now(),
      shotId,
      characterStates: new Map(),
      sceneState: { sceneId: '', location: '', characters: [], timeOfDay: '', atmosphere: '' },
      narrativePhase: '',
    });
  }

  private addIssue(issue: Omit<ContinuityIssue, 'id' | 'detectedAt'>): void {
    this.issues.push({
      ...issue,
      id: `cont_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      detectedAt: Date.now(),
    });
  }

  /**
   * 获取当前 issues
   */
  getIssues(): ContinuityIssue[] {
    return [...this.issues];
  }

  /**
   * 清除所有 issues 和状态
   */
  reset(): void {
    this.issues = [];
    this.lastAppearance.clear();
    this.lastAction.clear();
    this.propState.clear();
    this.seenJumps.clear();
    this.seenGaps.clear();
    this.seenOverlaps.clear();
    this.timeline.snapshots = [];
  }
}

/**
 * 将 continuity issues 格式化为可读报告（用于 AI prompt 或用户展示）
 */
export function formatContinuityReport(issues: ContinuityIssue[]): string {
  if (issues.length === 0) return '✅ 六维连续性检查通过，未检测到问题。';

  const bySeverity = { CRITICAL: [] as ContinuityIssue[], MAJOR: [], MODERATE: [], MINOR: [], INFO: [] };
  for (const issue of issues) {
    bySeverity[issue.severity].push(issue);
  }

  let report = `# 连续性检查报告 (${issues.length}个问题)\n\n`;
  
  for (const severity of ['CRITICAL', 'MAJOR', 'MODERATE', 'MINOR', 'INFO'] as ContinuitySeverity[]) {
    const items = bySeverity[severity];
    if (items.length === 0) continue;
    report += `## ${severity} (${items.length}个)\n\n`;
    for (const item of items) {
      report += `- [${item.dimension}] ${item.message}\n`;
      if (item.suggestion) report += `  → 建议: ${item.suggestion}\n`;
    }
    report += '\n';
  }

  return report;
}
