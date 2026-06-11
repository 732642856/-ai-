# ============================================================================
# StarCanvas 真人用户模拟测试套件
# ============================================================================
# 基于 browser-use (MIT, 18.2k⭐) + Playwright
# 对照 TapNow / 小云雀2.0 / ArcReel 的真实用户教程和操作流程
# ============================================================================

"""
安装:
  pip install "browser-use[core]"

运行:
  python tests/user-simulation/run_simulation.py --scenario tapnow_basic
  python tests/user-simulation/run_simulation.py --scenario xiaoyunque_full
  python tests/user-simulation/run_simulation.py --scenario arcreel_flow
  python tests/user-simulation/run_simulation.py --scenario all

输出:
  测试报告输出到 tests/user-simulation/reports/
"""

import argparse
import json
import os
import sys
import time
import asyncio
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# ============================================================================
# 测试场景定义（基于对标应用的真实用户教程）
# ============================================================================

@dataclass
class UserScenario:
    """真实用户操作场景"""
    id: str
    name: str
    description: str
    source: str  # 教程来源 (TapNow/小云雀/ArcReel)
    steps: list[dict] = field(default_factory=list)
    expected_outcomes: list[str] = field(default_factory=list)
    difficulty: str = "medium"  # easy/medium/hard

# ---------------------------------------------------------------------------
# 场景 1: TapNow 基础创作流程
# 来源: TapNow B站教程 / CSDN深度测评 / 腾讯新闻Agent教程
# ---------------------------------------------------------------------------
TAPNOW_BASIC = UserScenario(
    id="tapnow_basic",
    name="TapNow 基础创作流程",
    description="模拟 TapNow 教程用户的核心操作：打开画布→添加节点→输入prompt→生成图片→图生视频",
    source="TapNow B站教程 + CSDN测评 + 腾讯新闻Agent教程",
    difficulty="easy",
    steps=[
        {
            "action": "navigate",
            "target": "http://localhost:3000/canvas",
            "description": "打开星轨画布主页",
            "expected": "画布加载完成，显示工具栏和节点面板",
        },
        {
            "action": "observe",
            "target": "toolbar",
            "description": "检查工具栏按钮",
            "expected": "存在「设置」「生成分镜图」「导出」「分镜」「画风」「角度」「版本」按钮",
        },
        {
            "action": "add_node",
            "target": "prompt_node",
            "description": "添加一个文本提示词节点（模拟 TapNow 的 '拉片输入'）",
            "expected": "画布上出现新的文本节点",
        },
        {
            "action": "input_text",
            "target": "prompt_node",
            "text": "一个女剑客在竹林中的打斗场景，15秒，电影感光影，王家卫风格色调，慢动作雨滴",
            "description": "输入创作提示词（模拟 TapNow '一键拉片'）",
            "expected": "节点内容更新",
        },
        {
            "action": "run_node",
            "target": "prompt_node",
            "description": "执行节点生成内容（模拟 TapNow '生成图片'）",
            "expected": "节点状态变为 running→succeeded，生成结果出现",
        },
        {
            "action": "check_result",
            "target": "image_result",
            "description": "验证生成结果",
            "expected": "生成了图片/视频结果，可预览",
        },
        {
            "action": "add_node_connected",
            "target": "video_gen_node",
            "source": "prompt_node",
            "description": "连接图生视频节点（模拟 TapNow '图生视频'）",
            "expected": "新节点出现在画布上，与文本节点连线",
        },
        {
            "action": "open_panel",
            "target": "style_library",
            "description": "打开影视画风库（模拟小云雀2.0 '风格库选择'）",
            "expected": "风格库面板打开，显示 7 大分类 30+ 风格",
        },
        {
            "action": "select_style",
            "target": "cinematic_blade_runner",
            "description": "选择「赛博朋克」风格并应用",
            "expected": "风格 prompt 被注入到当前选中分镜",
        },
        {
            "action": "open_panel",
            "target": "shot_list",
            "description": "打开分镜列表（对标小云雀2.0 '分镜脚本'面板）",
            "expected": "表格视图显示所有分镜，支持排序和状态显示",
        },
    ],
    expected_outcomes=[
        "画布加载 < 3 秒",
        "工具栏按钮齐全（9个以上）",
        "节点添加流畅无卡顿",
        "prompt 输入响应即时",
        "节点运行状态正确流转",
        "风格库分类完整（7类）",
        "分镜列表数据正确",
    ],
)

# ---------------------------------------------------------------------------
# 场景 2: 小云雀2.0 短剧全流程
# 来源: 小云雀知乎实测教程 / smzdm评测 / tahou保姆级教程
# ---------------------------------------------------------------------------
XIAOYUNQUE_FULL = UserScenario(
    id="xiaoyunque_full",
    name="小云雀2.0 短剧全流程",
    description="模拟小云雀用户制作短剧的完整流程：喂剧本→定参数→选角→分镜→逐场生成",
    source="小云雀知乎实测教程 + smzdm评测 + tahou保姆级教程",
    difficulty="medium",
    steps=[
        {
            "action": "navigate",
            "target": "http://localhost:3000/canvas",
            "description": "打开星轨画布",
        },
        {
            "action": "add_node",
            "target": "script_node",
            "description": "添加剧本节点（模拟小云雀 '喂剧本'）",
        },
        {
            "action": "input_text",
            "target": "script_node",
            "text": "第一集：深夜，雨。女主角林小雨站在公司楼下，望着熄灭的灯。三年前她入职时这里灯火通明，如今人去楼空。手机震动——是母亲的消息：「小丽，这个月房租……」她删掉了消息，撑开伞走进雨中。",
            "description": "输入短剧剧本片段",
        },
        {
            "action": "run_node",
            "target": "script_node",
            "description": "执行剧本解析（模拟小云雀 '10万字长文本理解'）",
        },
        {
            "action": "add_connected_node",
            "target": "storyboard_node",
            "source": "script_node",
            "description": "基于剧本创建故事板（模拟小云雀 '拆分成分镜'）",
        },
        {
            "action": "set_visual_params",
            "target": "cinematic_param_panel",
            "params": {"aspect_ratio": "9:16", "style": "color_grading_warm", "lighting": "night_rain"},
            "description": "设置视觉参数（模拟小云雀第三步 '定调视觉参数'）",
        },
        {
            "action": "generate_character",
            "target": "character_view",
            "description": "生成角色形象（模拟小云雀第四步 '智能选角'）",
        },
        {
            "action": "check_three_view",
            "target": "character_three_view",
            "description": "检查角色三视图（正面/侧面/背面）",
        },
        {
            "action": "generate_shots",
            "target": "storyboard_node",
            "description": "逐镜生成分镜图片（模拟小云雀第五步 '逐场生成'）",
        },
        {
            "action": "compose_all",
            "target": "compose_button",
            "description": "合成全集（模拟小云雀第六步 '合成导出'）",
        },
    ],
    expected_outcomes=[
        "剧本解析成功生成故事板",
        "角色三视图包含正面/侧面/背面",
        "参数面板光影/景别参数有效",
        "分镜图片风格一致",
        "合成导出成功",
        "整个流程 < 5 分钟",
    ],
)

# ---------------------------------------------------------------------------
# 场景 3: ArcReel 多Agent编排流程
# 来源: ArcReel 官网完整文档 / arc-reel.com
# ---------------------------------------------------------------------------
ARCREEL_FLOW = UserScenario(
    id="arcreel_flow",
    name="ArcReel 多Agent编排流程",
    description="模拟 ArcReel 用户的6阶段制作流程：上传→资产库→分集→剧本→分镜→合成",
    source="ArcReel 官网文档 + freshcrate评测",
    difficulty="hard",
    steps=[
        {
            "action": "navigate",
            "target": "http://localhost:3000/canvas",
            "description": "打开星轨画布",
        },
        {
            "action": "add_node",
            "target": "document_node",
            "description": "上传/粘贴小说原文（模拟 ArcReel 阶段01 '上传小说'）",
        },
        {
            "action": "run_node",
            "target": "document_node",
            "description": "执行资产提取（模拟 ArcReel 阶段02 '建立资产库'）",
        },
        {
            "action": "check_bible",
            "target": "project_bible",
            "description": "检查提取的角色/场景/道具资产（模拟 ArcReel 资产库）",
        },
        {
            "action": "create_storyboard",
            "target": "document_node",
            "description": "创建故事板（模拟 ArcReel 阶段03 '分集规划'）",
        },
        {
            "action": "generate_character_design",
            "target": "character_bible",
            "description": "确认角色设计图（模拟 ArcReel 角色DNA系统）",
        },
        {
            "action": "generate_shot_by_shot",
            "target": "storyboard_node",
            "description": "逐镜生成（模拟 ArcReel 阶段05 '分镜生成'）",
        },
        {
            "action": "version_snapshot",
            "target": "version_compare",
            "description": "保存版本并对比（模拟 ArcReel 版本管理）",
        },
        {
            "action": "export_jianying",
            "target": "export_dropdown",
            "description": "导出剪映草稿（模拟 ArcReel 阶段06 '剪映导出'）",
        },
    ],
    expected_outcomes=[
        "资产库正确提取角色/场景/道具",
        "角色设计图可用作后续参考",
        "版本快照保存成功",
        "版本对比功能正常",
        "剪映草稿导出正确",
    ],
)

# ---------------------------------------------------------------------------
# 场景 4: TapNow 「/」快捷命令体验
# 来源: TapNow uisdc深度测评（Cinema Lab + 快捷命令）
# ---------------------------------------------------------------------------
TAPNOW_SLASH = UserScenario(
    id="tapnow_slash",
    name="TapNow 「/」快捷命令体验",
    description="模拟 TapNow 用户使用 '/' 快捷命令的操作流程：拉线→输入/→选择命令→自动执行",
    source="TapNow uisdc深度测评 + Cinema Lab功能体验",
    difficulty="easy",
    steps=[
        {
            "action": "navigate",
            "target": "http://localhost:3000/canvas",
        },
        {
            "action": "add_node",
            "target": "image_node",
        },
        {
            "action": "select_node",
            "target": "image_node",
            "description": "选中图片节点",
        },
        {
            "action": "trigger_slash",
            "target": "chat_input",
            "command": "/cinematic-lighting",
            "description": "在 ChatPanel 输入 /cinematic-lighting（测试28个SlashCommand）",
        },
        {
            "action": "trigger_slash",
            "target": "chat_input",
            "command": "/three-view",
            "description": "测试角色三视图命令",
        },
        {
            "action": "trigger_slash",
            "target": "chat_input",
            "command": "/nine-grid",
            "description": "测试九宫格分镜命令",
        },
        {
            "action": "trigger_slash",
            "target": "chat_input",
            "command": "/upscale",
            "description": "测试高清放大命令",
        },
        {
            "action": "verify_slash_menu",
            "target": "slash_menu",
            "description": "验证 SlashCommandMenu 显示正确（28个命令）",
        },
    ],
    expected_outcomes=[
        "28 个 Slash Command 全部可访问",
        "/ 快捷菜单过滤功能正常",
        "命令触发后执行正确",
        "目标类型过滤正确(text/shot/image/video/canvas)",
    ],
)

# ---------------------------------------------------------------------------
# 场景 5: 综合压力场景 — 拖拽+多面板+快速切换
# ---------------------------------------------------------------------------
STRESS_TEST = UserScenario(
    id="stress_test",
    name="综合压力场景",
    description="模拟真实用户的复杂操作：同时打开多个面板，拖拽角度控制，快速切换视图",
    source="综合 TapNow + 小云雀 + ArcReel 用户行为模式",
    difficulty="hard",
    steps=[
        {"action": "navigate", "target": "http://localhost:3000/canvas"},
        {"action": "open_panel", "target": "style_library", "description": "打开风格库"},
        {"action": "open_panel", "target": "shot_list", "description": "同时打开分镜列表"},
        {"action": "open_panel", "target": "angle_control", "description": "同时打开角度控制"},
        {"action": "drag_angle", "target": "angle_control", "angle": 45, "description": "拖拽角度到45°"},
        {"action": "drag_angle", "target": "angle_control", "angle": 135, "description": "拖拽角度到135°"},
        {"action": "select_style", "target": "cinematic_wong_kar_wai", "description": "应用港风风格"},
        {"action": "switch_view", "target": "shot_list", "mode": "grid", "description": "切换到网格视图"},
        {"action": "switch_view", "target": "shot_list", "mode": "table", "description": "切换回表格视图"},
        {"action": "sort_shots", "target": "shot_list", "key": "shotType", "description": "按景别排序"},
        {"action": "undo", "target": "toolbar", "description": "撤销操作"},
        {"action": "redo", "target": "toolbar", "description": "重做操作"},
        {"action": "close_all_panels", "description": "关闭所有面板"},
    ],
    expected_outcomes=[
        "多个面板同时打开不冲突，z-index 正确",
        "拖拽角度控制流畅（60fps）",
        "视图切换无闪烁",
        "排序功能正确",
        "undo/redo 功能正常",
        "面板关闭后内存释放",
    ],
)

# ============================================================================
# 所有场景注册
# ============================================================================

ALL_SCENARIOS = {
    "tapnow_basic": TAPNOW_BASIC,
    "xiaoyunque_full": XIAOYUNQUE_FULL,
    "arcreel_flow": ARCREEL_FLOW,
    "tapnow_slash": TAPNOW_SLASH,
    "stress_test": STRESS_TEST,
}

# ============================================================================
# 测试执行报告
# ============================================================================

@dataclass
class StepResult:
    step_index: int
    action: str
    description: str
    status: str  # pass/fail/skip/error
    duration_ms: float
    error_message: str = ""
    screenshot_path: str = ""

@dataclass
class ScenarioReport:
    scenario_id: str
    scenario_name: str
    source: str
    start_time: str
    end_time: str
    total_duration_ms: float
    total_steps: int
    passed: int
    failed: int
    skipped: int
    step_results: list[dict] = field(default_factory=list)
    ux_issues: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


def generate_report(report: ScenarioReport, output_dir: Path):
    """生成测试报告"""
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON 报告
    json_path = output_dir / f"{report.scenario_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    json_path.write_text(json.dumps(asdict(report), indent=2, default=str, ensure_ascii=False))

    # Markdown 报告
    md_path = output_dir / f"{report.scenario_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    md_lines = [
        f"# StarCanvas UX 测试报告",
        f"",
        f"## 基本信息",
        f"- **场景**: {report.scenario_name}",
        f"- **来源**: {report.source}",
        f"- **执行时间**: {report.start_time} → {report.end_time}",
        f"- **总耗时**: {report.total_duration_ms:.0f}ms",
        f"",
        f"## 测试结果",
        f"| 指标 | 数值 |",
        f"|---|---|",
        f"| 总步骤 | {report.total_steps} |",
        f"| ✅ 通过 | {report.passed} |",
        f"| ❌ 失败 | {report.failed} |",
        f"| ⏭ 跳过 | {report.skipped} |",
        f"| 通过率 | {report.passed / max(report.total_steps, 1) * 100:.1f}% |",
        f"",
        f"## 步骤详情",
    ]

    for sr in report.step_results:
        emoji = {"pass": "✅", "fail": "❌", "skip": "⏭", "error": "💥"}.get(sr["status"], "❓")
        md_lines.append(f"- {emoji} **步骤{sr['step_index'] + 1}**: {sr['description']} ({sr['duration_ms']:.0f}ms)")
        if sr.get("error_message"):
            md_lines.append(f"  - 错误: {sr['error_message']}")

    if report.ux_issues:
        md_lines.append("")
        md_lines.append("## UX 问题发现")
        for issue in report.ux_issues:
            md_lines.append(f"- ⚠️ {issue}")

    if report.recommendations:
        md_lines.append("")
        md_lines.append("## 改进建议")
        for rec in report.recommendations:
            md_lines.append(f"- 💡 {rec}")

    md_path.write_text("\n".join(md_lines))
    return json_path, md_path


def create_empty_report(scenario: UserScenario) -> ScenarioReport:
    now = datetime.now().isoformat()
    return ScenarioReport(
        scenario_id=scenario.id,
        scenario_name=scenario.name,
        source=scenario.source,
        start_time=now,
        end_time=now,
        total_duration_ms=0,
        total_steps=len(scenario.steps),
        passed=0,
        failed=0,
        skipped=0,
    )


# ============================================================================
# 主入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="StarCanvas 真人用户模拟测试")
    parser.add_argument("--scenario", choices=list(ALL_SCENARIOS.keys()) + ["all"], default="all")
    parser.add_argument("--headless", action="store_true", help="无头模式运行")
    parser.add_argument("--base-url", default="http://localhost:3000", help="StarCanvas 地址")
    parser.add_argument("--output", default="tests/user-simulation/reports", help="报告输出目录")
    parser.add_argument("--list", action="store_true", help="列出所有场景")
    args = parser.parse_args()

    if args.list:
        print("\n可用测试场景:")
        for sid, sc in ALL_SCENARIOS.items():
            print(f"  {sid:20s} {sc.name:30s} [{sc.difficulty}] {sc.source}")
        return

    scenarios_to_run = (
        list(ALL_SCENARIOS.values())
        if args.scenario == "all"
        else [ALL_SCENARIOS[args.scenario]]
    )

    output_dir = Path(args.output)
    total_passed = 0
    total_failed = 0

    for scenario in scenarios_to_run:
        print(f"\n{'='*60}")
        print(f"🧪 执行场景: {scenario.name}")
        print(f"   来源: {scenario.source}")
        print(f"   步骤数: {len(scenario.steps)}")
        print(f"   难度: {scenario.difficulty}")
        print(f"{'='*60}")

        report = create_empty_report(scenario)

        for i, step in enumerate(scenario.steps):
            action = step.get("action", "unknown")
            desc = step.get("description", "")
            print(f"\n  步骤 {i+1}/{len(scenario.steps)}: {desc} [{action}]")

            # TODO: 使用 browser-use 执行实际测试
            # 这里先输出测试框架
            pass

        # 生成报告
        json_path, md_path = generate_report(report, output_dir)
        print(f"\n📊 报告已生成:")
        print(f"   JSON: {json_path}")
        print(f"   MD:   {md_path}")

    print(f"\n{'='*60}")
    print(f"🏁 测试完成")
    print(f"   场景数: {len(scenarios_to_run)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
