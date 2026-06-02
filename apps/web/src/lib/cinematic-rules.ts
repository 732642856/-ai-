import type {
  CameraAngle,
  CameraMovement,
  CinematicShot,
  ContinuityWarning,
  EmotionalState,
  ShotSize,
} from "@/types/cinematic"

export const shotSizeRank: Record<ShotSize, number> = {
  "extreme-wide": 1,
  wide: 2,
  medium: 3,
  "close-up": 4,
  "extreme-close-up": 5,
}

export function getShotSizeDiff(a: ShotSize, b: ShotSize): number {
  return Math.abs(shotSizeRank[a] - shotSizeRank[b])
}

export function createCinematicShotId(sceneId: string, order: number): string {
  return `${sceneId}-shot-${order}`
}

export const EMOTION_SHOT_STRATEGY: Record<EmotionalState, {
  preferredSizes: ShotSize[]
  preferredAngle: CameraAngle
  preferredMovement: CameraMovement
  lens: string
  composition: string
}> = {
  calm: {
    preferredSizes: ["wide", "medium"],
    preferredAngle: "eye-level",
    preferredMovement: "static",
    lens: "standard",
    composition: "balanced, centered, stable geography",
  },
  tense: {
    preferredSizes: ["close-up", "medium"],
    preferredAngle: "dutch-angle",
    preferredMovement: "push-in",
    lens: "telephoto",
    composition: "tight framing, negative space, withheld information",
  },
  fear: {
    preferredSizes: ["close-up", "extreme-close-up"],
    preferredAngle: "low-angle",
    preferredMovement: "handheld",
    lens: "wide",
    composition: "shallow depth of field, obscured foreground, unstable edges",
  },
  anger: {
    preferredSizes: ["close-up", "extreme-close-up"],
    preferredAngle: "low-angle",
    preferredMovement: "push-in",
    lens: "standard",
    composition: "tight frame, no breathing room, direct confrontation",
  },
  joy: {
    preferredSizes: ["wide", "medium"],
    preferredAngle: "eye-level",
    preferredMovement: "tracking",
    lens: "standard",
    composition: "open space, warm tones, readable movement",
  },
  sadness: {
    preferredSizes: ["wide", "medium"],
    preferredAngle: "high-angle",
    preferredMovement: "static",
    lens: "telephoto",
    composition: "character small in frame, empty space, compressed distance",
  },
  intimacy: {
    preferredSizes: ["close-up", "extreme-close-up"],
    preferredAngle: "eye-level",
    preferredMovement: "static",
    lens: "standard",
    composition: "shallow depth of field, soft light, faces fill frame",
  },
  isolation: {
    preferredSizes: ["extreme-wide", "wide"],
    preferredAngle: "high-angle",
    preferredMovement: "static",
    lens: "wide",
    composition: "character at edge, vast negative space, environmental pressure",
  },
  suspense: {
    preferredSizes: ["medium", "close-up"],
    preferredAngle: "eye-level",
    preferredMovement: "push-in",
    lens: "telephoto",
    composition: "partial information, shadows, off-screen space implied",
  },
  revelation: {
    preferredSizes: ["close-up", "extreme-close-up"],
    preferredAngle: "eye-level",
    preferredMovement: "push-in",
    lens: "standard",
    composition: "sudden clarity, detail reveal, visual answer to previous question",
  },
  confusion: {
    preferredSizes: ["medium", "close-up"],
    preferredAngle: "dutch-angle",
    preferredMovement: "handheld",
    lens: "wide",
    composition: "disorienting frame, tilted horizon, unstable perspective",
  },
  hope: {
    preferredSizes: ["wide", "extreme-wide"],
    preferredAngle: "low-angle",
    preferredMovement: "crane",
    lens: "wide",
    composition: "looking up, light source visible, expansive sky or opening space",
  },
  despair: {
    preferredSizes: ["extreme-close-up", "close-up"],
    preferredAngle: "high-angle",
    preferredMovement: "static",
    lens: "telephoto",
    composition: "subject compressed by frame, collapsed posture, heavy stillness",
  },
  power: {
    preferredSizes: ["medium", "close-up"],
    preferredAngle: "low-angle",
    preferredMovement: "static",
    lens: "wide",
    composition: "character dominates frame, architecture supports authority",
  },
  vulnerability: {
    preferredSizes: ["close-up", "extreme-close-up"],
    preferredAngle: "high-angle",
    preferredMovement: "static",
    lens: "telephoto",
    composition: "looking down at subject, soft focus, exposed silence",
  },
}

export function suggestShotSizeJump(current: ShotSize): string {
  const rank = shotSizeRank[current]
  const suggestions: ShotSize[] = []
  const entries = Object.entries(shotSizeRank) as Array<[ShotSize, number]>

  const smaller = entries.find(([, value]) => value === rank - 2)?.[0]
  const larger = entries.find(([, value]) => value === rank + 2)?.[0]
  if (smaller) suggestions.push(smaller)
  if (larger) suggestions.push(larger)

  return suggestions.join(" 或 ") || "相邻但不同的景别"
}

export function checkShotRhythm(shots: CinematicShot[]): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = []
  const sorted = [...shots].sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.order - b.order)

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (prev.sceneId !== curr.sceneId) continue

    const diff = getShotSizeDiff(prev.shotSize, curr.shotSize)
    if (diff === 0) {
      warnings.push({
        type: "shot-rhythm",
        severity: "warning",
        shotIds: [prev.shotId, curr.shotId],
        message: `镜头${curr.order}与前一镜头景别相同（${curr.shotSize}），缺少节奏变化`,
        suggestion: `建议将镜头${curr.order}调整为 ${suggestShotSizeJump(curr.shotSize)}`,
      })
    }

    if (diff >= 4) {
      warnings.push({
        type: "shot-rhythm",
        severity: "info",
        shotIds: [prev.shotId, curr.shotId],
        message: `镜头${curr.order}景别跳变过大（${prev.shotSize} → ${curr.shotSize}），可能让观众迷失`,
        suggestion: "如果是有意制造冲击可以保留，否则建议增加一个过渡景别",
      })
    }
  }

  return warnings
}

export function checkSceneBoundaries(shots: CinematicShot[]): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = []
  const byScene = groupShotsByScene(shots)

  for (const [sceneId, sceneShots] of byScene) {
    const sorted = [...sceneShots].sort((a, b) => a.order - b.order)
    if (sorted.length < 2) continue

    const first = sorted[0]
    if (shotSizeRank[first.shotSize] > 2) {
      warnings.push({
        type: "shot-rhythm",
        severity: "warning",
        shotIds: [first.shotId, first.shotId],
        message: `场景 ${sceneId} 以 ${first.shotSize} 开场，缺少空间建立`,
        suggestion: "建议场景开场使用远景或全景建立空间关系，除非有意从局部悬念进入",
      })
    }
  }

  return warnings
}

export function checkAxis(shots: CinematicShot[]): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = []
  const sorted = [...shots].sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.order - b.order)

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (prev.sceneId !== curr.sceneId) continue
    if (!prev.screenDirection || !curr.screenDirection) continue

    const bothOts = prev.cameraAngle === "over-shoulder" && curr.cameraAngle === "over-shoulder"
    const sameDirection = prev.screenDirection === curr.screenDirection
    if (bothOts && sameDirection) {
      warnings.push({
        type: "axis",
        severity: "critical",
        shotIds: [prev.shotId, curr.shotId],
        message: "过肩反打镜头方向一致，可能跳轴",
        suggestion: "反打镜头应使用相反的 screenDirection，或补一个中性镜头重建轴线",
      })
    }
  }

  return warnings
}

export function checkEmotionalProgression(shots: CinematicShot[]): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = []
  const byScene = groupShotsByScene(shots)

  for (const [, sceneShots] of byScene) {
    const sorted = [...sceneShots].sort((a, b) => a.order - b.order)
    if (sorted.length < 4) continue

    let flatCount = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].emotionalState === sorted[i - 1].emotionalState) {
        flatCount++
      } else {
        flatCount = 1
      }

      if (flatCount >= 3) {
        warnings.push({
          type: "emotional-flat",
          severity: "info",
          shotIds: [sorted[i - 2].shotId, sorted[i].shotId],
          message: `连续 ${flatCount} 个镜头情绪为 ${sorted[i].emotionalState}，缺少情绪推进`,
          suggestion: "建议在场景中增加情绪转折点，或改变景别/运镜来制造层次",
        })
        break
      }
    }
  }

  return warnings
}

export function runAllChecks(shots: CinematicShot[]): ContinuityWarning[] {
  return [
    ...checkShotRhythm(shots),
    ...checkSceneBoundaries(shots),
    ...checkAxis(shots),
    ...checkEmotionalProgression(shots),
  ].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function groupShotsByScene(shots: CinematicShot[]): Map<string, CinematicShot[]> {
  const byScene = new Map<string, CinematicShot[]>()
  for (const shot of shots) {
    const current = byScene.get(shot.sceneId) ?? []
    current.push(shot)
    byScene.set(shot.sceneId, current)
  }
  return byScene
}
