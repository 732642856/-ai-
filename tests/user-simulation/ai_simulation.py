# ============================================================================
# StarCanvas browser-use AI 模拟引擎
# ============================================================================
# 使用 AI Agent 操控真实浏览器模拟真人用户操作
# 基于 browser-use (MIT, 18.2k⭐) + Playwright
#
# 运行:
#   python tests/user-simulation/ai_simulation.py --scenario tapnow_basic
# ============================================================================

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# ============================================================================
# AI 驱动的用户模拟任务定义
# ============================================================================

# 注意: 这些任务描述直接给 AI Agent 执行，Agent 会自主决策如何操作浏览器
# 任务描述越详细自然语言越好

TASKS = {
    # -----------------------------------------------------------------------
    # 任务 1: TapNow 风格的新用户上手流程
    # -----------------------------------------------------------------------
    "tapnow_onboarding": """
你是一个第一次使用 AI 影视创作工具的用户。请按照以下步骤操作星轨画布（StarCanvas）：

1. 打开浏览器访问 http://localhost:3000/canvas
2. 观察页面加载完成后的工具栏，确认你能看到：设置、生成分镜图、导出、分镜、画风、角度、版本等按钮
3. 在 ChatPanel（右下角聊天面板）中输入以下内容并按回车：
   「帮我创建一个武侠短片的第一个镜头：雨夜，竹林，女刺客从上方跃下」
4. 观察 AI 的回复和画布上的变化
5. 如果画布上出现了新的节点，点击查看节点内容
6. 找到工具栏中的「画风」按钮并点击，查看是否能打开风格库面板
7. 选择「王家卫港风」风格
8. 如果能找到「分镜」按钮，点击打开分镜列表

执行过程中如果遇到任何按钮找不到或点击无反应的情况，请记录下来。
""",

    # -----------------------------------------------------------------------
    # 任务 2: 小云雀2.0 风格短剧制作流程
    # -----------------------------------------------------------------------
    "xiaoyunque_workflow": """
你是一个短剧创作者，正在使用星轨画布制作一集竖屏短剧。请执行以下操作：

1. 打开 http://localhost:3000/canvas
2. 尝试添加一个文本节点（可能是「添加节点」按钮或画布空白处右键菜单）
3. 在节点中输入短剧剧本：
   「第1集：深夜，雨。林小雨站在公司楼下，望着已熄灯的大楼。手机震动——母亲催房租。她删掉消息，撑伞走入雨中。」
4. 尝试运行这个节点（寻找播放/运行按钮）
5. 观察运行状态变化（idle → running → succeeded）
6. 打开「画风」面板，选择「竖屏霸总」或「雨夜虐恋」风格
7. 打开「分镜」面板查看分镜列表
8. 尝试导出功能（「导出」按钮 → 剪映草稿）

记录所有操作的结果和遇到的任何问题。
""",

    # -----------------------------------------------------------------------
    # 任务 3: ArcReel 风格资产管理流程
    # -----------------------------------------------------------------------
    "arcreel_asset_flow": """
你是一个使用星轨画布管理影视项目的制片人。请执行以下操作：

1. 打开 http://localhost:3000/canvas
2. 找到并点击「Bible」按钮（项目圣经面板）
3. 观察是否显示角色库、场景库、视觉风格库
4. 点击「角色」按钮查看角色圣经编辑器
5. 点击「场景」按钮查看场景圣经编辑器
6. 尝试「版本」按钮，查看版本对比功能
7. 验证是否能查看历史快照并恢复到旧版本

记录每个面板的功能完整性和可用性。
""",

    # -----------------------------------------------------------------------
    # 任务 4: 暴力压力测试
    # -----------------------------------------------------------------------
    "stress_test": """
你是一个测试工程师，需要对星轨画布进行压力测试。请执行以下操作：

1. 打开 http://localhost:3000/canvas
2. 快速连续点击以下按钮（每个点击间隔 0.5 秒）：
   - 分镜 → 画风 → 角度 → 版本 → Bible → 角色 → 场景
3. 观察是否出现以下问题：
   - 面板闪烁或闪烁
   - z-index 叠放错误（后面的面板盖住前面的）
   - 页面卡顿或无响应
   - 内存泄漏迹象（页面越来越慢）
4. 尝试同时打开所有面板，然后逐个关闭
5. 在角度控制面板中快速连续拖拽角度（从0°到360°循环）

记录所有发现的问题。
""",

    # -----------------------------------------------------------------------
    # 任务 5: SlashCommand 功能测试
    # -----------------------------------------------------------------------
    "slash_command_test": """
你是一个高级用户，想测试星轨画布的「/」快捷命令系统。请执行以下操作：

1. 打开 http://localhost:3000/canvas
2. 找到 ChatPanel（右下角），打开聊天输入框
3. 输入「/」触发快捷命令菜单
4. 观察弹出的命令列表，记录你看到的命令数量
5. 测试以下命令（逐个输入并查看是否被识别）：
   - /three-view
   - /nine-grid
   - /cinematic-lighting
   - /multi-angle
   - /upscale
   - /image-to-video
   - /compose-all
   - /export-jianying
6. 测试搜索过滤：输入「/视频」查看是否过滤出视频相关命令

记录命令弹出速度、过滤准确性、命令数量。
""",
}


# ============================================================================
# 简易执行器（无需 browser-use 依赖时的降级方案）
# ============================================================================

class SimpleSimulationRunner:
    """使用 Playwright 直接执行的降级模拟器"""

    def __init__(self, headless: bool = False, base_url: str = "http://localhost:3000"):
        self.headless = headless
        self.base_url = base_url
        self.results = []

    async def run(self, task_name: str, task_description: str):
        """运行单个任务"""
        print(f"\n{'='*60}")
        print(f"🤖 执行任务: {task_name}")
        print(f"{'='*60}")

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            print("⚠️  playwright 未安装，请运行: pip install playwright && playwright install")
            return None

        start_time = time.time()
        issues = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                viewport={"width": 1440, "height": 900},
                record_video_dir="tests/user-simulation/videos/" if not self.headless else None,
            )
            page = await context.new_page()

            try:
                # 记录 console 错误
                console_errors = []
                page.on("console", lambda msg: (
                    console_errors.append(f"[{msg.type}] {msg.text}")
                    if msg.type == "error" else None
                ))

                # 导航到画布
                await page.goto(f"{self.base_url}/canvas", wait_until="networkidle")
                await page.wait_for_timeout(3000)

                # 截图
                os.makedirs("tests/user-simulation/screenshots", exist_ok=True)
                await page.screenshot(
                    path=f"tests/user-simulation/screenshots/{task_name}_loaded.png"
                )

                # ── 基础检查 ──
                # 1. 检查页面标题
                title = await page.title()
                print(f"  📄 页面标题: {title}")

                # 2. 检查工具栏按钮
                button_tests = [
                    ("settings-toggle", "设置"),
                    ("shot-list-toggle", "分镜"),
                    ("style-library-toggle", "画风"),
                    ("angle-control-toggle", "角度"),
                    ("version-compare-toggle", "版本"),
                    ("project-bible-toggle", "Bible"),
                ]

                found_buttons = 0
                for test_id, label in button_tests:
                    try:
                        btn = page.locator(f'[data-testid="{test_id}"]')
                        if await btn.is_visible(timeout=3000):
                            found_buttons += 1
                            print(f"  ✅ 找到按钮: {label} ({test_id})")
                        else:
                            issues.append(f"按钮不可见: {label} ({test_id})")
                            print(f"  ⚠️  按钮不可见: {label}")
                    except Exception as e:
                        issues.append(f"按钮未找到: {label} - {e}")

                print(f"  📊 工具栏: {found_buttons}/{len(button_tests)} 个按钮可用")

                # 3. 尝试打开 ChatPanel
                try:
                    chat_btn = page.locator('[data-testid="chat-toggle"]')
                    if await chat_btn.is_visible(timeout=3000):
                        await chat_btn.click()
                        await page.wait_for_timeout(500)

                        chat_input = page.locator('[data-testid="chat-input"]')
                        if await chat_input.is_visible(timeout=3000):
                            await chat_input.fill("/")
                            await page.wait_for_timeout(500)

                            # 检查 SlashCommandMenu
                            slash_menu = page.locator('[data-testid="slash-command-menu"]')
                            if await slash_menu.is_visible(timeout=3000):
                                menu_items = await page.locator('[data-testid="slash-command-item"]').count()
                                print(f"  ✅ SlashCommand 菜单: {menu_items} 个命令")
                            else:
                                issues.append("SlashCommandMenu 未弹出")
                                print(f"  ⚠️  SlashCommandMenu 未弹出")
                    else:
                        issues.append("Chat toggle 按钮未找到")
                except Exception as e:
                    issues.append(f"ChatPanel 测试失败: {e}")

                # 4. 页面性能
                performance = await page.evaluate("""
                    () => {
                        const nav = performance.getEntriesByType('navigation')[0];
                        return {
                            domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
                            loadComplete: nav ? nav.loadEventEnd - nav.startTime : 0,
                        };
                    }
                """)
                print(f"  ⏱  DOMContentLoaded: {performance.get('domContentLoaded', 0):.0f}ms")
                print(f"  ⏱  完全加载: {performance.get('loadComplete', 0):.0f}ms")

                if console_errors:
                    print(f"  💥 Console 错误 ({len(console_errors)}):")
                    for err in console_errors[:5]:
                        print(f"     {err[:120]}")
                    issues.append(f"Console 错误: {len(console_errors)} 个")

            except Exception as e:
                issues.append(f"测试异常: {e}")
                print(f"  💥 异常: {e}")

            finally:
                await browser.close()

        duration = time.time() - start_time
        result = {
            "task": task_name,
            "duration_seconds": round(duration, 2),
            "issues_count": len(issues),
            "issues": issues,
            "timestamp": datetime.now().isoformat(),
        }

        print(f"\n  ⏱  总耗时: {duration:.1f}s")
        print(f"  🐛 发现 {len(issues)} 个问题")
        return result


# ============================================================================
# 主入口
# ============================================================================

async def main():
    import argparse

    parser = argparse.ArgumentParser(description="StarCanvas AI 模拟真人用户测试")
    parser.add_argument("--scenario", choices=list(TASKS.keys()) + ["all"], default="all")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--mode", choices=["simple", "ai"], default="simple",
                       help="simple=Playwright直接执行, ai=browser-use AI驱动")
    parser.add_argument("--list", action="store_true", help="列出所有任务")
    args = parser.parse_args()

    if args.list:
        print("\n可用测试任务:")
        for tid, tdesc in TASKS.items():
            preview = tdesc.strip().split("\n")[1] if "\n" in tdesc else tdesc[:60]
            print(f"  {tid:25s} {preview.strip()}")
        return

    # 创建输出目录
    os.makedirs("tests/user-simulation/reports", exist_ok=True)
    os.makedirs("tests/user-simulation/screenshots", exist_ok=True)

    tasks_to_run = list(TASKS.items()) if args.scenario == "all" else [(args.scenario, TASKS[args.scenario])]

    all_results = []

    if args.mode == "ai":
        # browser-use AI 驱动模式
        print("🤖 使用 browser-use AI 驱动模式")
        try:
            from browser_use.beta import Agent, BrowserProfile, ChatBrowserUse

            for task_name, task_desc in tasks_to_run:
                print(f"\n🚀 启动 AI Agent: {task_name}")
                agent = Agent(
                    task=task_desc,
                    llm=ChatBrowserUse(model='bu-3-max'),
                    browser_profile=BrowserProfile(
                        headless=args.headless,
                        allowed_domains=["localhost:3000", "*.starcanvas.local"],
                    ),
                )
                history = await agent.run()
                result = history.final_result()
                all_results.append({"task": task_name, "result": result})
                print(f"  ✅ {task_name}: {result[:200]}...")

        except ImportError:
            print("❌ browser-use 未安装，请运行: pip install browser-use[core]")
            print("   降级到 simple 模式...")
            args.mode = "simple"

    if args.mode == "simple":
        runner = SimpleSimulationRunner(headless=args.headless, base_url=args.base_url)

        for task_name, task_desc in tasks_to_run:
            result = await runner.run(task_name, task_desc)
            if result:
                all_results.append(result)

    # 生成汇总报告
    report_path = f"tests/user-simulation/reports/summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    json.dump(all_results, open(report_path, "w"), indent=2, ensure_ascii=False, default=str)

    total_issues = sum(r.get("issues_count", 0) for r in all_results)
    print(f"\n{'='*60}")
    print(f"🏁 测试完成")
    print(f"   任务数: {len(all_results)}")
    print(f"   问题数: {total_issues}")
    print(f"   报告: {report_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
