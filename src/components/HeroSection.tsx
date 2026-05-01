'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CANVAS_W, CANVAS_H, CELL, SQUARE, SVG_W, SVG_H, SVG_FLASK_PATH } from '@/src/flask'
import WaitlistForm from '@/src/components/WaitlistForm'

const BG_V: number = 22
const ON_V: number = 224

function toColor(b: number): string {
  const v: number = Math.round(BG_V + Math.max(0, Math.min(1, b)) * (ON_V - BG_V))
  return `rgb(${v},${v},${v})`
}

// ── Types ────────────────────────────────────────────────────────────────────

interface FlaskCell {
  readonly isFlask: boolean
  brightness: number
  target: number
  speed: number
  readonly flipProb: number
}

interface BgCell {
  col: number
  row: number
  brightness: number
  target: number
  speed: number
}

interface SavedState {
  bgCols: number
  bgRows: number
  flask: [number, number][][]
  bg: [number, number, number, number][]
}

// ── Flask ────────────────────────────────────────────────────────────────────

const FCOLS: number = Math.floor(CANVAS_W / CELL)
const FROWS: number = Math.floor(CANVAS_H / CELL)

function buildFlaskPath(): Path2D {
  const scale: number = Math.min(CANVAS_W / SVG_W, CANVAS_H / SVG_H) * 0.88
  const ox: number = (CANVAS_W - SVG_W * scale) / 2
  const oy: number = (CANVAS_H - SVG_H * scale) / 2
  const out: Path2D = new Path2D()
  out.addPath(new Path2D(SVG_FLASK_PATH), new DOMMatrix([scale, 0, 0, scale, ox, oy]))
  return out
}

function createFlaskCells(ctx: CanvasRenderingContext2D, path: Path2D): FlaskCell[][] {
  return Array.from({ length: FROWS }, (_: unknown, r: number): FlaskCell[] =>
    Array.from({ length: FCOLS }, (_: unknown, c: number): FlaskCell => {
      ctx.lineWidth = 28
      const isFlask: boolean = ctx.isPointInStroke(path, c * CELL + SQUARE / 2, r * CELL + SQUARE / 2)
      const initB: number = isFlask ? 0.6 + Math.random() * 0.4 : 0
      return {
        isFlask,
        brightness: initB,
        target: initB,
        speed: 0.02 + Math.random() * 0.03,
        flipProb: 0.02 + Math.random() * 0.03,
      }
    })
  )
}

function tickFlask(cells: FlaskCell[][]): void {
  for (let r: number = 0; r < FROWS; r++) {
    for (let c: number = 0; c < FCOLS; c++) {
      const cell: FlaskCell = cells[r][c]
      if (!cell.isFlask) continue
      if (Math.random() < cell.flipProb) {
        cell.target = 0.4 + Math.random() * 0.6
        cell.speed = 0.03 + Math.random() * 0.06
      }
      cell.brightness += (cell.target - cell.brightness) * cell.speed
    }
  }
}

function drawFlask(ctx: CanvasRenderingContext2D, cells: FlaskCell[][], ox: number, oy: number): void {
  for (let r: number = 0; r < FROWS; r++) {
    for (let c: number = 0; c < FCOLS; c++) {
      const cell: FlaskCell = cells[r][c]
      if (!cell.isFlask) continue
      ctx.fillStyle = toColor(cell.brightness)
      ctx.fillRect(ox + c * CELL, oy + r * CELL, SQUARE, SQUARE)
    }
  }
}

// ── Background ───────────────────────────────────────────────────────────────

function buildBaseGrid(w: number, h: number, bgCols: number, bgRows: number): HTMLCanvasElement {
  const c: HTMLCanvasElement = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx: CanvasRenderingContext2D = c.getContext('2d')!
  ctx.fillStyle = toColor(0)
  for (let r: number = 0; r < bgRows; r++)
    for (let c2: number = 0; c2 < bgCols; c2++)
      ctx.fillRect(c2 * CELL, r * CELL, SQUARE, SQUARE)
  return c
}

function createBgCells(count: number, bgCols: number, bgRows: number): BgCell[] {
  return Array.from({ length: count }, (): BgCell => ({
    col: Math.floor(Math.random() * bgCols),
    row: Math.floor(Math.random() * bgRows),
    brightness: Math.random() * 0.15,
    target: Math.random() * 0.15,
    speed: 0.003 + Math.random() * 0.007,
  }))
}

function tickBg(cells: BgCell[], bgCols: number, bgRows: number): void {
  for (const cell of cells) {
    if (Math.random() < 0.003) {
      if (cell.target > 0.02) {
        cell.target = 0
      } else {
        cell.col = Math.floor(Math.random() * bgCols)
        cell.row = Math.floor(Math.random() * bgRows)
        cell.target = 0.08 + Math.random() * 0.10
      }
      cell.speed = 0.004 + Math.random() * 0.006
    }
    cell.brightness += (cell.target - cell.brightness) * cell.speed
  }
}

function drawBg(
  ctx: CanvasRenderingContext2D,
  baseGrid: HTMLCanvasElement,
  cells: BgCell[],
): void {
  ctx.drawImage(baseGrid, 0, 0)
  for (const cell of cells) {
    if (cell.brightness < 0.01) continue
    ctx.fillStyle = toColor(cell.brightness)
    ctx.fillRect(cell.col * CELL, cell.row * CELL, SQUARE, SQUARE)
  }
}

// ── State persistence ────────────────────────────────────────────────────────

const STATE_KEY: string = 'al-anim-state'

function saveState(
  flaskCells: FlaskCell[][],
  bgCells: BgCell[],
  bgCols: number,
  bgRows: number,
): void {
  if (!flaskCells.length || !bgCells.length) return
  try {
    const state: SavedState = {
      bgCols,
      bgRows,
      flask: flaskCells.map((row: FlaskCell[]): [number, number][] =>
        row.map((c: FlaskCell): [number, number] => [+c.brightness.toFixed(3), +c.target.toFixed(3)])
      ),
      bg: bgCells.map((c: BgCell): [number, number, number, number] =>
        [c.col, c.row, +c.brightness.toFixed(3), +c.target.toFixed(3)]
      ),
    }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch { /* quota exceeded */ }
}

function restoreState(
  flaskCells: FlaskCell[][],
  bgCells: BgCell[],
  bgCols: number,
  bgRows: number,
): boolean {
  const raw: string | null = sessionStorage.getItem(STATE_KEY)
  if (!raw) return false
  try {
    const s: SavedState = JSON.parse(raw) as SavedState
    if (s.bgCols !== bgCols || s.bgRows !== bgRows) return false
    s.flask.forEach((row: [number, number][], r: number): void =>
      row.forEach(([b, t]: [number, number], c: number): void => {
        if (flaskCells[r]?.[c]) {
          flaskCells[r][c].brightness = b
          flaskCells[r][c].target = t
        }
      })
    )
    s.bg.forEach(([col, row, b, t]: [number, number, number, number], i: number): void => {
      if (bgCells[i]) {
        bgCells[i].col = col
        bgCells[i].row = row
        bgCells[i].brightness = b
        bgCells[i].target = t
      }
    })
    return true
  } catch { return false }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HeroSection(): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect((): void => { setMounted(true) }, [])

  useEffect((): (() => void) => {
    if (!canvasRef.current) return (): void => {}
    const canvas: HTMLCanvasElement = canvasRef.current
    const placeholder: HTMLDivElement = placeholderRef.current!

    const w: number = window.innerWidth
    const h: number = window.innerHeight
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const bgCols: number = Math.floor(w / CELL)
    const bgRows: number = Math.floor(h / CELL)
    const baseGrid: HTMLCanvasElement = buildBaseGrid(w, h, bgCols, bgRows)
    const bgCtx: CanvasRenderingContext2D = canvas.getContext('2d')!

    const bgCellCount: number = Math.round(bgCols * bgRows * 0.04)
    const bgCells: BgCell[] = createBgCells(bgCellCount, bgCols, bgRows)

    const hitCanvas: HTMLCanvasElement = document.createElement('canvas')
    hitCanvas.width = CANVAS_W
    hitCanvas.height = CANVAS_H
    const flaskCells: FlaskCell[][] = createFlaskCells(hitCanvas.getContext('2d')!, buildFlaskPath())

    restoreState(flaskCells, bgCells, bgCols, bgRows)

    const rect: DOMRect = placeholder.getBoundingClientRect()
    const flaskOX: number = Math.round(rect.left / CELL) * CELL
    const flaskOY: number = Math.round(rect.top / CELL) * CELL

    let rafId: number = 0

    function loop(): void {
      tickBg(bgCells, bgCols, bgRows)
      drawBg(bgCtx, baseGrid, bgCells)
      tickFlask(flaskCells)
      drawFlask(bgCtx, flaskCells, flaskOX, flaskOY)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    const onSave = (): void => saveState(flaskCells, bgCells, bgCols, bgRows)
    const onVisibility = (): void => { if (document.hidden) onSave() }

    window.addEventListener('pagehide', onSave)
    document.addEventListener('visibilitychange', onVisibility)

    return (): void => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('pagehide', onSave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mounted])

  return (
    <>
      {mounted && createPortal(
        <canvas ref={canvasRef} id="bg-canvas" />,
        document.body,
      )}
      <main className="hero">
        <section className="flask-col">
          <div
            ref={placeholderRef}
            id="flask-placeholder"
            style={{ width: CANVAS_W, height: CANVAS_H }}
          />
        </section>
        <section className="info-col">
          <h1 className="wordmark">alkera ai</h1>
          <p className="description">
            <strong>building the next-generation ide for data</strong>
          </p>
          <WaitlistForm />
          <p className="contact">
            contact us at{' '}
            <a href="mailto:contact@alkera.ai">contact@alkera.ai</a>
          </p>
        </section>
      </main>
    </>
  )
}
