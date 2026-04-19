import { CANVAS_W, CANVAS_H, CELL, SQUARE, SVG_W, SVG_H, SVG_FLASK_PATH } from './flask.js'

const BG_V = 22    // #161616 — dim square
const ON_V = 224   // #e0e0e0 — bright

function toColor(b: number): string {
  const v = Math.round(BG_V + Math.max(0, Math.min(1, b)) * (ON_V - BG_V))
  return `rgb(${v},${v},${v})`
}

// ── Flask cells ───────────────────────────────────────────────────────────────

const FCOLS = Math.floor(CANVAS_W / CELL)
const FROWS = Math.floor(CANVAS_H / CELL)

interface FlaskCell { isFlask: boolean; brightness: number; target: number; speed: number; flipProb: number }

let flaskCells: FlaskCell[][] = []

function buildFlaskPath(): Path2D {
  const scale  = Math.min(CANVAS_W / SVG_W, CANVAS_H / SVG_H) * 0.88
  const ox     = (CANVAS_W - SVG_W * scale) / 2
  const oy     = (CANVAS_H - SVG_H * scale) / 2
  const out    = new Path2D()
  out.addPath(new Path2D(SVG_FLASK_PATH), new DOMMatrix([scale, 0, 0, scale, ox, oy]))
  return out
}

function initFlaskCells(ctx: CanvasRenderingContext2D, path: Path2D): void {
  flaskCells = Array.from({ length: FROWS }, (_, r) =>
    Array.from({ length: FCOLS }, (_, c) => {
      const isFlask = ctx.isPointInPath(path, c * CELL + SQUARE / 2, r * CELL + SQUARE / 2)
      const initB   = isFlask ? 0.6 + Math.random() * 0.4 : 0
      return { isFlask, brightness: initB, target: initB,
               speed: 0.02 + Math.random() * 0.03, flipProb: 0.005 + Math.random() * 0.01 }
    })
  )
}

function tickFlask(): void {
  for (let r = 0; r < FROWS; r++) {
    for (let c = 0; c < FCOLS; c++) {
      const cell = flaskCells[r][c]
      if (!cell.isFlask) continue
      if (Math.random() < cell.flipProb) {
        cell.target = 0.4 + Math.random() * 0.6
        cell.speed  = 0.015 + Math.random() * 0.035
      }
      cell.brightness += (cell.target - cell.brightness) * cell.speed
    }
  }
}

// Draws flask cells onto the shared bg canvas at the given viewport offset.
// No clearRect — drawBg() already redraws the full base grid each frame.
function drawFlask(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  for (let r = 0; r < FROWS; r++) {
    for (let c = 0; c < FCOLS; c++) {
      const cell = flaskCells[r][c]
      if (!cell.isFlask) continue
      ctx.fillStyle = toColor(cell.brightness)
      ctx.fillRect(ox + c * CELL, oy + r * CELL, SQUARE, SQUARE)
    }
  }
}

// ── Background canvas ─────────────────────────────────────────────────────────

interface BgCell { col: number; row: number; brightness: number; target: number; speed: number }

let bgCells:  BgCell[] = []
let bgCols  = 0
let bgRows  = 0
let bgCtx:   CanvasRenderingContext2D | null = null
let baseCanvas: HTMLCanvasElement | null = null

function buildBaseGrid(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width  = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = toColor(0)  // #161616 squares
  for (let r = 0; r < bgRows; r++)
    for (let c2 = 0; c2 < bgCols; c2++)
      ctx.fillRect(c2 * CELL, r * CELL, SQUARE, SQUARE)
  return c
}

function initBg(w: number, h: number): void {
  bgCols = Math.floor(w / CELL)
  bgRows = Math.floor(h / CELL)
  baseCanvas = buildBaseGrid(w, h)

  const count = Math.round(bgCols * bgRows * 0.04)  // 4% of cells animated
  bgCells = Array.from({ length: count }, () => ({
    col:        Math.floor(Math.random() * bgCols),
    row:        Math.floor(Math.random() * bgRows),
    brightness: Math.random() * 0.15,
    target:     Math.random() * 0.15,
    speed:      0.003 + Math.random() * 0.007,
  }))
}

function tickBg(): void {
  for (const cell of bgCells) {
    if (Math.random() < 0.002) {
      if (cell.target > 0.02) {
        cell.target = 0                                    // fade out
      } else {
        cell.col    = Math.floor(Math.random() * bgCols)  // relocate + fade in
        cell.row    = Math.floor(Math.random() * bgRows)
        cell.target = 0.08 + Math.random() * 0.10
      }
      cell.speed = 0.003 + Math.random() * 0.007
    }
    cell.brightness += (cell.target - cell.brightness) * cell.speed
  }
}

function drawBg(): void {
  if (!bgCtx || !baseCanvas) return
  bgCtx.drawImage(baseCanvas, 0, 0)           // blit full grid in one call
  for (const cell of bgCells) {
    if (cell.brightness < 0.01) continue
    bgCtx.fillStyle = toColor(cell.brightness)
    bgCtx.fillRect(cell.col * CELL, cell.row * CELL, SQUARE, SQUARE)
  }
}

function setupBgCanvas(): void {
  const canvas = document.createElement('canvas')
  canvas.id = 'bg-canvas'
  document.body.insertBefore(canvas, document.getElementById('app'))

  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width  = w
  canvas.height = h
  canvas.style.width  = `${w}px`
  canvas.style.height = `${h}px`
  bgCtx = canvas.getContext('2d')!
  initBg(w, h)
}

// ── State persistence ─────────────────────────────────────────────────────────

const STATE_KEY = 'al-anim-state'

function saveState(): void {
  if (!flaskCells.length || !bgCells.length) return
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      bgCols, bgRows,
      flask: flaskCells.map(row => row.map(c => [+c.brightness.toFixed(3), +c.target.toFixed(3)])),
      bg:    bgCells.map(c => [c.col, c.row, +c.brightness.toFixed(3), +c.target.toFixed(3)]),
    }))
  } catch { /* quota exceeded — skip silently */ }
}

function restoreState(): boolean {
  const raw = sessionStorage.getItem(STATE_KEY)
  if (!raw) return false
  try {
    const s = JSON.parse(raw)
    if (s.bgCols !== bgCols || s.bgRows !== bgRows) return false
    s.flask.forEach((row: [number, number][], r: number) =>
      row.forEach(([b, t]: [number, number], c: number) => {
        if (flaskCells[r]?.[c]) { flaskCells[r][c].brightness = b; flaskCells[r][c].target = t }
      })
    )
    s.bg.forEach(([col, row, b, t]: [number, number, number, number], i: number) => {
      if (bgCells[i]) { bgCells[i].col = col; bgCells[i].row = row; bgCells[i].brightness = b; bgCells[i].target = t }
    })
    return true
  } catch { return false }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = `
    <main class="hero">
      <section class="flask-col">
        <div id="flask-placeholder"></div>
      </section>
      <section class="info-col">
        <h1 class="wordmark">alkera ai</h1>
        <p class="description"><strong>manifold</strong>: the next generation ide for data.</p>
<!--        &lt;!&ndash; TODO: replace action="#" with your Mailchimp / Beehiiv / Buttondown endpoint &ndash;&gt;-->
<!--        <form class="waitlist-form" action="#" method="POST">-->
<!--          <input-->
<!--            type="email"-->
<!--            name="email"-->
<!--            class="waitlist-input"-->
<!--            placeholder="your@email.com"-->
<!--            required-->
<!--            autocomplete="email"-->
<!--          />-->
<!--          <button type="submit" class="waitlist-btn">join waitlist →</button>-->
<!--        </form>-->

        <p class="contact">contact us at <a href="mailto:contact@alkera.ai">contact@alkera.ai</a></p>

      </section>
    </main>
  `

  // Waitlist form — prevent navigation until action URL is wired up
  document.querySelector('.waitlist-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    // TODO: remove this handler once the form action is set to a real endpoint
  })

  // Size the placeholder so the hero layout reserves the same space as before
  const placeholder = document.getElementById('flask-placeholder') as HTMLElement
  placeholder.style.width  = `${CANVAS_W}px`
  placeholder.style.height = `${CANVAS_H}px`

  // Flask hit-test: isPointInPath requires a canvas context — use a temp offscreen
  // canvas just for this, then discard it. All actual drawing goes to bgCtx.
  const hitCanvas = document.createElement('canvas')
  hitCanvas.width  = CANVAS_W
  hitCanvas.height = CANVAS_H
  initFlaskCells(hitCanvas.getContext('2d')!, buildFlaskPath())

  // Background canvas (must come after placeholder is sized so getBoundingClientRect is accurate)
  setupBgCanvas()

  restoreState()

  window.addEventListener('pagehide', saveState)
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState() })

  // Snap flask origin to the cell grid so flask cells align with bg cells
  const rect = placeholder.getBoundingClientRect()
  const flaskOriginX = Math.round(rect.left / CELL) * CELL
  const flaskOriginY = Math.round(rect.top  / CELL) * CELL

  ;(function loop() {
    tickBg()
    drawBg()
    tickFlask()
    drawFlask(bgCtx!, flaskOriginX, flaskOriginY)
    requestAnimationFrame(loop)
  })()
}

render()
