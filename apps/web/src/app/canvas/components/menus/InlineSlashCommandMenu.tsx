"use client"

import type { SlashCommand } from "@/lib/slashCommands/slashCommands"
import { DESIGN_TOKENS } from "../../styles/designSystem"

export function InlineSlashCommandMenu(input: {
  commands: SlashCommand[]
  activeIndex: number
  onSelect: (command: SlashCommand) => void
}) {
  if (input.commands.length === 0) return null

  return (
    <div
      className="absolute left-3 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border py-1"
      style={{
        backgroundColor: DESIGN_TOKENS.panelSolid,
        borderColor: DESIGN_TOKENS.border,
        boxShadow: DESIGN_TOKENS.shadowMenu,
      }}
    >
      {input.commands.map((command, index) => (
        <button
          key={command.id}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => input.onSelect(command)}
          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors"
          style={{
            backgroundColor:
              index === input.activeIndex ? "rgba(148,163,184,0.14)" : "transparent",
          }}
        >
          <span className="text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
            {command.label}
          </span>
          <span className="text-[10px]" style={{ color: DESIGN_TOKENS.textMuted }}>
            {command.description}
          </span>
        </button>
      ))}
    </div>
  )
}
