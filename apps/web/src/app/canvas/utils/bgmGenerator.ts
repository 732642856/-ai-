/**
 * BGM (Background Music) Generator
 * 使用 Tone.js 在浏览器端生成简单背景音乐，不依赖任何外部 API
 * 如果 Tone.js 不可用，自动降级为原生 Web Audio API
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type BgmMood = "happy" | "sad" | "suspense" | "epic" | "warm" | "horror" | "calm"
export type BgmStyle = "classical" | "electronic" | "ambient" | "cinematic"

export interface BgmParams {
  mood: BgmMood
  style: BgmStyle
  duration: number // seconds, 5-120
  tempo?: number   // BPM
}

// ---------------------------------------------------------------------------
// 乐理数据
// ---------------------------------------------------------------------------

/** 大调音阶 (C Major) */
const MAJOR_SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"]

/** 小调音阶 (A Minor) */
const MINOR_SCALE = ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]

/** 低八度基础音 */
const BASS_NOTES = ["C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "Bb3", "B3"]

// ---------------------------------------------------------------------------
// Mood → 音乐参数映射
// ---------------------------------------------------------------------------

interface MoodConfig {
  scale: string[]
  baseTempo: number
  chords: string[][]         // 和弦进行 (每个和弦 = 音符数组)
  chordDuration: number      // 每个和弦持续几拍
  melodyNotes: string[]      // 旋律片段音符
  melodyRhythm: number[]     // 旋律节奏模式 (每个音持续几拍)
  bassPattern: number[]      // 低音模式 (音阶索引，-1 为休止)
  useDissonance: boolean
  noiseDensity: number       // 0-1 噪声密度
}

function getMoodConfig(mood: BgmMood): MoodConfig {
  switch (mood) {
    case "happy":
      return {
        scale: MAJOR_SCALE,
        baseTempo: 120,
        chords: [["C4", "E4", "G4"], ["F4", "A4", "C5"], ["G4", "B4", "D5"], ["C4", "E4", "G4"]],
        chordDuration: 2,
        melodyNotes: ["C4", "E4", "G4", "A4", "G4", "E4", "F4", "C4"],
        melodyRhythm: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1],
        bassPattern: [0, 3, 4, 0],
        useDissonance: false,
        noiseDensity: 0,
      }
    case "sad":
      return {
        scale: MINOR_SCALE,
        baseTempo: 70,
        chords: [["A3", "C4", "E4"], ["D4", "F4", "A4"], ["E4", "G4", "B4"], ["A3", "C4", "E4"]],
        chordDuration: 4,
        melodyNotes: ["A3", "C4", "E4", "A4", "G4", "E4", "D4", "C4"],
        melodyRhythm: [1, 1, 1, 1, 1, 1, 1, 2],
        bassPattern: [0, 3, 4, 0],
        useDissonance: false,
        noiseDensity: 0.05,
      }
    case "suspense":
      return {
        scale: MINOR_SCALE,
        baseTempo: 90,
        chords: [["A3", "D4", "E4"], ["Bb3", "Eb4", "F4"], ["A3", "D4", "E4"], ["F3", "Bb3", "C#4"]],
        chordDuration: 4,
        melodyNotes: ["E4", "F4", "E4", "F4", "Eb4", "E4", "Bb3", "B3"],
        melodyRhythm: [1.5, 0.5, 1.5, 0.5, 1, 1, 2, 2],
        bassPattern: [0, -1, 0, -1],
        useDissonance: true,
        noiseDensity: 0.3,
      }
    case "epic":
      return {
        scale: MAJOR_SCALE,
        baseTempo: 100,
        chords: [["C4", "E4", "G4", "C5"], ["G4", "B4", "D5", "G5"], ["A4", "C5", "E5", "A5"], ["F4", "A4", "C5", "F5"]],
        chordDuration: 4,
        melodyNotes: ["C4", "E4", "G4", "C5", "B4", "G4", "A4", "F4"],
        melodyRhythm: [1, 1, 1, 1, 1, 0.5, 0.5, 2],
        bassPattern: [0, 7, 9, 5],
        useDissonance: false,
        noiseDensity: 0.1,
      }
    case "warm":
      return {
        scale: MAJOR_SCALE,
        baseTempo: 85,
        chords: [["C4", "E4", "G4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"]],
        chordDuration: 4,
        melodyNotes: ["E4", "C4", "G4", "A4", "F4", "E4", "D4", "C4"],
        melodyRhythm: [1, 1, 1, 1, 1, 1, 1, 1],
        bassPattern: [0, 5, 3, 4],
        useDissonance: false,
        noiseDensity: 0,
      }
    case "horror":
      return {
        scale: MINOR_SCALE,
        baseTempo: 60,
        chords: [["A3", "Bb3", "E4"], ["F3", "Gb3", "C4"], ["A3", "Bb3", "E4"], ["F3", "Gb3", "C4"]],
        chordDuration: 4,
        melodyNotes: ["A3", "Bb3", "A3", "Bb3", "E4", "Eb4", "A3", "Bb3"],
        melodyRhythm: [2, 2, 2, 1, 1, 1, 1, 2],
        bassPattern: [0, 1, 0, -1],
        useDissonance: true,
        noiseDensity: 0.6,
      }
    case "calm":
      return {
        scale: MINOR_SCALE,
        baseTempo: 65,
        chords: [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["D4", "F4", "A4"]],
        chordDuration: 4,
        melodyNotes: ["A3", "E4", "C4", "G4", "A4", "E4", "C4", "A3"],
        melodyRhythm: [1, 1, 1, 1, 1, 1, 1, 1],
        bassPattern: [0, 3, 4, 2],
        useDissonance: false,
        noiseDensity: 0,
      }
  }
}

// ---------------------------------------------------------------------------
// WAV 编码工具
// ---------------------------------------------------------------------------

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const data = buffer.getChannelData(0) // 先取左声道

  // 如果是立体声，混音
  let interleaved: Float32Array
  if (numChannels === 2) {
    const right = buffer.getChannelData(1)
    interleaved = new Float32Array(length * 2)
    for (let i = 0; i < length; i++) {
      interleaved[i * 2] = data[i]
      interleaved[i * 2 + 1] = right[i]
    }
  } else {
    interleaved = data
  }

  // 16-bit PCM
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = interleaved.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, totalSize - 8, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // PCM
  view.setUint16(20, 1, true) // 格式: 1=PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // 字节率
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true) // 位深
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  // 写入 PCM 数据
  let offset = 44
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

// ---------------------------------------------------------------------------
// 原生 Web Audio API 实现 (降级方案)
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 44100

function noteToFrequency(note: string): number {
  const noteMap: Record<string, number> = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
  }
  const match = note.match(/^([A-G][b#]?)(\d)$/)
  if (!match) return 440
  const semitone = noteMap[match[1]] ?? 0
  const octave = parseInt(match[2])
  return 440 * Math.pow(2, (semitone - 9 + (octave - 4) * 12) / 12)
}

/** 用原生 API 生成 BGM */
async function generateBgmNative(params: BgmParams): Promise<Blob> {
  const { duration, mood } = params
  const config = getMoodConfig(mood)
  const bpm = params.tempo || config.baseTempo
  const secondsPerBeat = 60 / bpm
  const totalSamples = Math.floor(duration * SAMPLE_RATE)

  const audioCtx = new OfflineAudioContext(2, totalSamples, SAMPLE_RATE)

  // 主振荡器
  const createNote = (freq: number, startTime: number, noteDuration: number, gain: number = 0.15) => {
    const osc = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    // 音色随 style 变化
    switch (params.style) {
      case "classical":
        osc.type = "triangle"
        break
      case "electronic":
        osc.type = "sawtooth"
        break
      case "ambient":
        osc.type = "sine"
        break
      case "cinematic":
        osc.type = "triangle"
        break
    }

    osc.frequency.setValueAtTime(freq, startTime)
    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02)
    gainNode.gain.setValueAtTime(gain, startTime + noteDuration - 0.05)
    gainNode.gain.linearRampToValueAtTime(0, startTime + noteDuration)

    osc.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    osc.start(startTime)
    osc.stop(startTime + noteDuration)
  }

  // 和弦层
  let time = 0
  const chordBeatDuration = config.chordDuration * secondsPerBeat
  while (time < duration) {
    const chordIdx = Math.floor(time / (config.chords.length * chordBeatDuration)) % config.chords.length
    // 修正: 循环遍历所有和弦
    const idx = Math.floor((time % (config.chords.length * chordBeatDuration)) / chordBeatDuration)
    const chord = config.chords[idx]

    if (config.useDissonance) {
      // 不协和效果: 用失谐的纯音
      chord.forEach((note, i) => {
        const freq = noteToFrequency(note)
        const detune = i === 1 ? 15 : i === 2 ? -12 : 0
        createNote(freq + detune, time, chordBeatDuration, 0.08)
      })
    } else {
      chord.forEach((note) => {
        createNote(noteToFrequency(note), time, chordBeatDuration, 0.12)
      })
    }

    time += chordBeatDuration
  }

  // 旋律层 (更高的八度，更突出)
  time = 0
  let melodyIdx = 0
  while (time < duration) {
    const noteName = config.melodyNotes[melodyIdx % config.melodyNotes.length]
    const noteDur = (config.melodyRhythm[melodyIdx % config.melodyRhythm.length] ?? 1) * secondsPerBeat
    const freq = noteToFrequency(noteName)
    const octaveUp = noteToFrequency(noteName.replace(/\d/, (m) => String(parseInt(m) + 1)))

    createNote(octaveUp, time, noteDur, 0.1)

    time += noteDur
    melodyIdx++
  }

  // 低音层
  time = 0
  let bassIdx = 0
  while (time < duration) {
    const scaleIdx = config.bassPattern[bassIdx % config.bassPattern.length]
    if (scaleIdx >= 0) {
      const noteName = config.scale[scaleIdx]
      const freq = noteToFrequency(noteName.replace(/\d/, (m) => String(parseInt(m) - 1))) // 低八度
      createNote(freq, time, secondsPerBeat * 2, 0.2)
    }
    time += secondsPerBeat * 2
    bassIdx++
  }

  // 噪声层 (用于 suspense/horror)
  if (config.noiseDensity > 0) {
    const noiseBufferSize = Math.floor(SAMPLE_RATE * 0.5) // 0.5秒噪声块
    const noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, SAMPLE_RATE)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseBufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1
    }

    let noiseTime = 0
    while (noiseTime < duration) {
      if (Math.random() < config.noiseDensity * 0.3) {
        const source = audioCtx.createBufferSource()
        source.buffer = noiseBuffer
        const gainNode = audioCtx.createGain()
        gainNode.gain.setValueAtTime(0.03, noiseTime)
        gainNode.gain.linearRampToValueAtTime(0, noiseTime + 0.5)

        // 加低通滤波
        const filter = audioCtx.createBiquadFilter()
        filter.type = "lowpass"
        filter.frequency.setValueAtTime(400, noiseTime)

        source.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        source.start(noiseTime)
      }
      noiseTime += 0.3 + Math.random() * 0.5
    }
  }

  const buffer = await audioCtx.startRendering()
  return audioBufferToWavBlob(buffer)
}

// ---------------------------------------------------------------------------
// Tone.js 实现 (主要方案)
// ---------------------------------------------------------------------------

/** 用 Tone.js 生成 BGM */
async function generateBgmWithTone(
  Tone: typeof import("tone"),
  params: BgmParams,
): Promise<Blob> {
  const { duration, mood } = params
  const config = getMoodConfig(mood)
  const bpm = params.tempo || config.baseTempo
  const secondsPerBeat = 60 / bpm

  const toneBuffer = await Tone.Offline(
    ({ transport }: any) => {
      // 创建合成器
      const synthArgs: any = { oscillator: {}, envelope: { attack: 0.02, release: 0.2 } }

      switch (params.style) {
        case "classical":
          synthArgs.oscillator.type = "triangle"
          synthArgs.envelope = { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.4 }
          break
        case "electronic":
          synthArgs.oscillator.type = "sawtooth"
          synthArgs.envelope = { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.1 }
          break
        case "ambient":
          synthArgs.oscillator.type = "sine"
          synthArgs.envelope = { attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.8 }
          break
        case "cinematic":
          synthArgs.oscillator.type = "triangle"
          synthArgs.envelope = { attack: 0.1, decay: 0.1, sustain: 0.4, release: 0.5 }
          break
      }

      const polySynth = new Tone.PolySynth(Tone.Synth, synthArgs).toDestination()

      // 和弦层
      let time = 0
      const chordBeatDuration = config.chordDuration * secondsPerBeat
      while (time < duration) {
        const idx = Math.floor((time % (config.chords.length * chordBeatDuration)) / chordBeatDuration)
        const chord = config.chords[idx]
        if (chord) {
          polySynth.triggerAttackRelease(chord, chordBeatDuration, time, 0.4)
        }
        time += chordBeatDuration
      }

      // 旋律层 (用独立的单音合成器，更亮)
      const melodySynth = new Tone.Synth({
        oscillator: { type: params.style === "ambient" ? "sine" : "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.3 },
      }).toDestination()

      time = 0
      let melodyIdx = 0
      while (time < duration) {
        const noteName = config.melodyNotes[melodyIdx % config.melodyNotes.length]
        const noteDur = (config.melodyRhythm[melodyIdx % config.melodyRhythm.length] ?? 1) * secondsPerBeat
        // 升八度
        const octaveUp = noteName.replace(/\d/, (m) => String(parseInt(m) + 1))
        melodySynth.triggerAttackRelease(octaveUp, noteDur, time, 0.3)
        time += noteDur
        melodyIdx++
      }

      // 低音层
      const bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.3 },
      }).toDestination()

      time = 0
      let bassIdx = 0
      while (time < duration) {
        const scaleIdx = config.bassPattern[bassIdx % config.bassPattern.length]
        if (scaleIdx >= 0) {
          const noteName = config.scale[scaleIdx]
          const bassNote = noteName.replace(/\d/, (m) => String(parseInt(m) - 1))
          bassSynth.triggerAttackRelease(bassNote, secondsPerBeat * 2, time, 0.5)
        }
        time += secondsPerBeat * 2
        bassIdx++
      }

      // 噪声层 (suspense/horror)
      if (config.noiseDensity > 0) {
        let noiseTime = 0
        while (noiseTime < duration) {
          if (Math.random() < config.noiseDensity * 0.3) {
            const noise = new Tone.Noise("brown").toDestination()
            noise.volume.value = -24 // dB
            noise.start(noiseTime)
            noise.stop(noiseTime + 0.5 + Math.random() * 0.5)
          }
          noiseTime += 0.3 + Math.random() * 0.5
        }
      }

      transport.start(0)
    },
    duration,
    2,      // channels
    SAMPLE_RATE,
  )

  // ToneAudioBuffer 兼容处理
  const audioBuffer = toneBuffer.get()
  if (!audioBuffer) {
    throw new Error("Tone.js Offline 渲染返回空 buffer")
  }
  return audioBufferToWavBlob(audioBuffer)
}

// ---------------------------------------------------------------------------
// 主导出函数
// ---------------------------------------------------------------------------

/** 生成 BGM 并返回 WAV Blob */
export async function generateBgm(params: BgmParams): Promise<Blob> {
  // 参数校验
  const clampedDuration = Math.max(5, Math.min(120, params.duration))
  const safeParams = { ...params, duration: clampedDuration }

  // 尝试使用 Tone.js
  try {
    const Tone = await import("tone")
    if (Tone.Offline && typeof Tone.Offline === "function") {
      return await generateBgmWithTone(Tone, safeParams)
    }
    throw new Error("Tone.Offline not available")
  } catch (err) {
    // 降级到原生 Web Audio API
    console.warn("[bgmGenerator] Tone.js 不可用，降级到原生 Web Audio API:", err)
    return generateBgmNative(safeParams)
  }
}

/** 播放 BGM Blob (返回 HTMLAudioElement) */
export function playBgmBlob(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.loop = false
  audio.play().catch(() => {
    // 静默处理自动播放被浏览器阻止的情况
  })
  return audio
}

/** 为 mood 获取中文名称 */
export function getMoodLabel(mood: BgmMood): string {
  const labels: Record<BgmMood, string> = {
    happy: "欢快",
    sad: "悲伤",
    suspense: "紧张",
    epic: "史诗",
    warm: "温馨",
    horror: "恐怖",
    calm: "宁静",
  }
  return labels[mood]
}

/** 为 style 获取中文名称 */
export function getStyleLabel(style: BgmStyle): string {
  const labels: Record<BgmStyle, string> = {
    classical: "古典",
    electronic: "电子",
    ambient: "环境",
    cinematic: "电影",
  }
  return labels[style]
}

export default generateBgm
