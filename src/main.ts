import { CANVAS_W, CANVAS_H, CELL, SQUARE, SVG_W, SVG_H, SVG_FLASK_PATH } from './flask'

const BG_V: number = 22
const ON_V: number = 224

function toColor(b: number): string {
  const v: number = Math.round(BG_V + Math.max(0, Math.min(1, b)) * (ON_V - BG_V))
  return `rgb(${v},${v},${v})`
}

// ── Flask cells ───────────────────────────────────────────────────────────────

const FCOLS: number = Math.floor(CANVAS_W / CELL)
const FROWS: number = Math.floor(CANVAS_H / CELL)

interface FlaskCell {
  readonly isFlask: boolean
  brightness: number
  target: number
  speed: number
  readonly flipProb: number
}

let flaskCells: FlaskCell[][] = []

function buildFlaskPath(): Path2D {
  const scale: number = Math.min(CANVAS_W / SVG_W, CANVAS_H / SVG_H) * 0.88
  const ox: number = (CANVAS_W - SVG_W * scale) / 2
  const oy: number = (CANVAS_H - SVG_H * scale) / 2
  const out: Path2D = new Path2D()
  out.addPath(new Path2D(SVG_FLASK_PATH), new DOMMatrix([scale, 0, 0, scale, ox, oy]))
  return out
}

function initFlaskCells(ctx: CanvasRenderingContext2D, path: Path2D): void {
  flaskCells = Array.from({ length: FROWS }, (_: unknown, r: number): FlaskCell[] =>
    Array.from({ length: FCOLS }, (_: unknown, c: number): FlaskCell => {
      ctx.lineWidth = 28
      const isFlask: boolean = ctx.isPointInStroke(path, c * CELL + SQUARE / 2, r * CELL + SQUARE / 2)
      const initB: number = isFlask ? 0.6 + Math.random() * 0.4 : 0
      return {
        isFlask,
        brightness: initB,
        target: initB,
        speed: 0.02 + Math.random() * 0.03,
        flipProb: 0.005 + Math.random() * 0.01,
      }
    })
  )
}

function tickFlask(): void {
  for (let r: number = 0; r < FROWS; r++) {
    for (let c: number = 0; c < FCOLS; c++) {
      const cell: FlaskCell = flaskCells[r][c]
      if (!cell.isFlask) continue
      if (Math.random() < cell.flipProb) {
        cell.target = 0.4 + Math.random() * 0.6
        cell.speed = 0.015 + Math.random() * 0.035
      }
      cell.brightness += (cell.target - cell.brightness) * cell.speed
    }
  }
}

function drawFlask(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  for (let r: number = 0; r < FROWS; r++) {
    for (let c: number = 0; c < FCOLS; c++) {
      const cell: FlaskCell = flaskCells[r][c]
      if (!cell.isFlask) continue
      ctx.fillStyle = toColor(cell.brightness)
      ctx.fillRect(ox + c * CELL, oy + r * CELL, SQUARE, SQUARE)
    }
  }
}

// ── Background canvas ─────────────────────────────────────────────────────────

interface BgCell {
  col: number
  row: number
  brightness: number
  target: number
  speed: number
}

let bgCells: BgCell[] = []
let bgCols: number = 0
let bgRows: number = 0
let bgCtx: CanvasRenderingContext2D | null = null
let baseCanvas: HTMLCanvasElement | null = null

function buildBaseGrid(w: number, h: number): HTMLCanvasElement {
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

function initBg(w: number, h: number): void {
  bgCols = Math.floor(w / CELL)
  bgRows = Math.floor(h / CELL)
  baseCanvas = buildBaseGrid(w, h)

  const count: number = Math.round(bgCols * bgRows * 0.04)
  bgCells = Array.from({ length: count }, (): BgCell => ({
    col: Math.floor(Math.random() * bgCols),
    row: Math.floor(Math.random() * bgRows),
    brightness: Math.random() * 0.15,
    target: Math.random() * 0.15,
    speed: 0.003 + Math.random() * 0.007,
  }))
}

function tickBg(): void {
  for (const cell of bgCells) {
    if (Math.random() < 0.002) {
      if (cell.target > 0.02) {
        cell.target = 0
      } else {
        cell.col = Math.floor(Math.random() * bgCols)
        cell.row = Math.floor(Math.random() * bgRows)
        cell.target = 0.08 + Math.random() * 0.10
      }
      cell.speed = 0.003 + Math.random() * 0.007
    }
    cell.brightness += (cell.target - cell.brightness) * cell.speed
  }
}

function drawBg(): void {
  if (!bgCtx || !baseCanvas) return
  bgCtx.drawImage(baseCanvas, 0, 0)
  for (const cell of bgCells) {
    if (cell.brightness < 0.01) continue
    bgCtx.fillStyle = toColor(cell.brightness)
    bgCtx.fillRect(cell.col * CELL, cell.row * CELL, SQUARE, SQUARE)
  }
}

function setupBgCanvas(): void {
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.id = 'bg-canvas'
  document.body.insertBefore(canvas, document.getElementById('app'))

  const w: number = window.innerWidth
  const h: number = window.innerHeight
  canvas.width = w
  canvas.height = h
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  bgCtx = canvas.getContext('2d')!
  initBg(w, h)
}

// ── State persistence ─────────────────────────────────────────────────────────

const STATE_KEY: string = 'al-anim-state'

interface SavedState {
  bgCols: number
  bgRows: number
  flask: [number, number][][]
  bg: [number, number, number, number][]
}

function saveState(): void {
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

function restoreState(): boolean {
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

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
  const app: HTMLElement | null = document.getElementById('app')
  if (!app) return
  app.innerHTML = `
    <main class="hero">
      <section class="flask-col">
        <div id="flask-placeholder"></div>
      </section>
      <section class="info-col">
        <h1 class="wordmark">alkera ai</h1>
        <p class="description"><strong>manifold</strong>: the next generation ide for data.</p>
        <p class="contact">contact us at <a href="mailto:contact@alkera.ai">contact@alkera.ai</a></p>
      </section>
    </main>
  `

  const placeholder: HTMLElement = document.getElementById('flask-placeholder') as HTMLElement
  placeholder.style.width = `${CANVAS_W}px`
  placeholder.style.height = `${CANVAS_H}px`

  const hitCanvas: HTMLCanvasElement = document.createElement('canvas')
  hitCanvas.width = CANVAS_W
  hitCanvas.height = CANVAS_H
  initFlaskCells(hitCanvas.getContext('2d')!, buildFlaskPath())

  setupBgCanvas()
  restoreState()

  window.addEventListener('pagehide', saveState)
  document.addEventListener('visibilitychange', (): void => {
    if (document.hidden) saveState()
  })

  const rect: DOMRect = placeholder.getBoundingClientRect()
  const flaskOriginX: number = Math.round(rect.left / CELL) * CELL
  const flaskOriginY: number = Math.round(rect.top / CELL) * CELL

  ;(function loop(): void {
    tickBg()
    drawBg()
    tickFlask()
    drawFlask(bgCtx!, flaskOriginX, flaskOriginY)
    requestAnimationFrame(loop)
  })()
}

render()
