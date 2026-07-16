// SVG illustrations – one per game. viewBox="0 0 160 108"

interface IllProps { className?: string }

// ── helpers ────────────────────────────────────────────────────────────────
const BG = '#16130E'
const G  = '#D4A843'   // gold
const GB = '#E8C84A'   // gold-bright
const DIM = '#6B6047'  // muted
const S  = '#2D2820'   // surface border

function HexPath({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill?: string; stroke?: string }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return <polygon points={pts} fill={fill ?? 'none'} stroke={stroke} strokeWidth="1" />
}

// ── BRAIN TRAINING ─────────────────────────────────────────────────────────
function MemoryMatrix({ className }: IllProps) {
  const R = 11
  const W = R * Math.sqrt(3)
  const cols = 5, rows = 4
  const offsetX = (160 - (cols * W + W / 2)) / 2
  const offsetY = (108 - (rows * R * 1.5 + R * 0.5)) / 2
  const lit = new Set([1, 4, 7, 11, 14])
  const tapped = new Set([1, 7])

  const hexPts = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6
      return `${(cx + (R - 1) * Math.cos(a)).toFixed(1)},${(cy + (R - 1) * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  const positions = Array.from({ length: cols * rows }, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols
    return {
      cx: offsetX + col * W + (row % 2 ? W / 2 : 0) + W / 2,
      cy: offsetY + row * R * 1.5 + R,
    }
  })

  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="mm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0F7FF" />
          <stop offset="100%" stopColor="#CEEAFF" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#mm-bg)" />
      {positions.map((pos, i) => {
        const isLit = lit.has(i)
        const isTapped = tapped.has(i)
        const fill = isTapped ? '#E9B213' : isLit ? '#4DA8FF' : '#FFFFFF'
        const stroke = isTapped ? '#C8940E' : isLit ? '#2A88DF' : 'rgba(77,168,255,0.25)'
        const opacity = isLit && !isTapped ? 0.92 : 1
        return (
          <polygon key={i} points={hexPts(pos.cx, pos.cy)}
            fill={fill} stroke={stroke} strokeWidth="1.2" opacity={opacity}
            filter={isLit && !isTapped ? 'drop-shadow(0 0 3px #8FD3FF)' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.07))'} />
        )
      })}
    </svg>
  )
}

function ColorStroop({ className }: IllProps) {
  const swatches = ['#FF6B6B', '#4CC9F0', '#34D399', '#F5B942']
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="cs-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF9E8" />
          <stop offset="100%" stopColor="#FFF4E0" />
        </linearGradient>
        <filter id="cs-glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#cs-bg)" />
      <text x="80" y="46" textAnchor="middle" fontSize="26" fontWeight="900" fill="#4CC9F0" fontFamily="system-ui,sans-serif" filter="url(#cs-glow)">RED</text>
      {swatches.map((c, i) => (
        <rect key={i} x={26 + i * 30} y="68" width="22" height="22" rx="6" fill={c} opacity={i === 1 ? 1 : 0.85} />
      ))}
      <rect x="53" y="66" width="28" height="28" rx="8" fill="none" stroke="#4CC9F0" strokeWidth="2" opacity="0.7" />
    </svg>
  )
}

function DualNBack({ className }: IllProps) {
  const lit = new Set([1, 4])
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="dnb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFDF5" />
          <stop offset="100%" stopColor="#F3ECFF" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#dnb-bg)" />
      {Array.from({ length: 9 }, (_, i) => {
        const col = i % 3, row = Math.floor(i / 3)
        const isLit = lit.has(i)
        return (
          <rect key={i} x={45 + col * 24} y={12 + row * 24} width="20" height="20" rx="5"
            fill={isLit ? '#C4B5FD' : '#FFFFFF'}
            stroke={isLit ? '#A78BFA' : 'rgba(0,0,0,0.06)'} strokeWidth={isLit ? 1.5 : 1}
            filter={isLit ? 'drop-shadow(0 0 5px rgba(196,181,253,0.7))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.05))'} />
        )
      })}
      <rect x="66" y="86" width="28" height="20" rx="6" fill="#1A1A2E" />
      <text x="80" y="100" textAnchor="middle" fontSize="12" fontWeight="900" fill="#FFF9E8" fontFamily="system-ui,sans-serif">K</text>
    </svg>
  )
}

function NumberFlow({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="nf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF9E8" />
          <stop offset="100%" stopColor="#FFF4E0" />
        </linearGradient>
        <filter id="nf-sh"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.08)" /></filter>
      </defs>
      <rect width="160" height="108" fill="url(#nf-bg)" />
      <text x="80" y="42" textAnchor="middle" fontSize="24" fontWeight="900" fontFamily="system-ui,sans-serif">
        <tspan fill="#1A1A2E">4 </tspan><tspan fill="#93DCFF">+</tspan><tspan fill="#1A1A2E"> 4 </tspan><tspan fill="#CCC">= ?</tspan>
      </text>
      <rect x="20" y="56" width="120" height="4" rx="2" fill="rgba(0,0,0,0.08)" />
      <rect x="20" y="56" width="82" height="4" rx="2" fill="#86EFAC" />
      {[6, 8, 5, 10].map((v, i) => (
        <g key={i} filter="url(#nf-sh)">
          <rect x={18 + i * 32} y="70" width="26" height="20" rx="6" fill={i === 0 ? '#86EFAC' : 'white'} />
          <text x={31 + i * 32} y="83.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#1A1A2E" fontFamily="system-ui,sans-serif">{v}</text>
        </g>
      ))}
    </svg>
  )
}

function PatternSync({ className }: IllProps) {
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`}).join(' ')
  const items = [
    {shape:'circle', color:'#9BF6FF', cx:36,  cy:32, r:16},
    {shape:'hex',    color:'#C4B5FD', cx:124, cy:28, r:15},
    {shape:'square', color:'#86EFAC', cx:32,  cy:76, r:14},
    {shape:'tri',    color:'#FDBA74', cx:80,  cy:54, r:16},
    {shape:'?',      color:'',        cx:124, cy:76, r:15},
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="ps-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0FFFE"/>
          <stop offset="100%" stopColor="#FFF9E8"/>
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#ps-bg)"/>
      <rect x={4} y={4} width={152} height={100} rx={12} fill="rgba(255,255,255,0.65)"/>
      {items.map((it,i) => (
        <g key={i} filter={it.shape!=='?'?'drop-shadow(0 2px 6px rgba(0,0,0,0.08))':''}>
          {it.shape==='circle' && <circle cx={it.cx} cy={it.cy} r={it.r} fill={it.color} opacity={0.92}/>}
          {it.shape==='square' && <rect x={it.cx-it.r} y={it.cy-it.r} width={it.r*2} height={it.r*2} rx={5} fill={it.color} opacity={0.92}/>}
          {it.shape==='hex'    && <polygon points={hexPts(it.cx,it.cy,it.r)} fill={it.color} opacity={0.92}/>}
          {it.shape==='tri'    && <polygon points={`${it.cx},${it.cy-it.r} ${it.cx+it.r*0.87},${it.cy+it.r*0.5} ${it.cx-it.r*0.87},${it.cy+it.r*0.5}`} fill={it.color} opacity={0.92}/>}
          {it.shape==='?' && <>
            <rect x={it.cx-it.r} y={it.cy-it.r} width={it.r*2} height={it.r*2} rx={5}
              fill="rgba(155,246,255,0.12)" stroke="#9BF6FF" strokeWidth={1.8} strokeDasharray="3,2.5"/>
            <text x={it.cx} y={it.cy+5} textAnchor="middle" fontSize="16" fontWeight="900"
              fill="rgba(0,0,0,0.2)" fontFamily="system-ui,sans-serif">?</text>
          </>}
        </g>
      ))}
    </svg>
  )
}

function PerilousPathIll({ className }: IllProps) {
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`}).join(' ')
  const R = 13, COLS = 4, ROWS = 4
  const sqrt3 = Math.sqrt(3)
  const ox = (160 - ((COLS-1)*sqrt3*R + sqrt3/2*R + R*2)) / 2 + 2
  const oy = (108 - ((ROWS-1)*1.5*R + R*2)) / 2 - 2
  // Path: start(0,0) → (1,0) → (1,1) → (2,1) → (3,1) → end(3,3) ish
  const pathSet = new Set(['0-0','1-0','1-1','2-1','3-1','3-2','3-3'])
  const mineSet = new Set(['0-2','2-0','2-2','0-3'])
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="pp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0FFF8"/>
          <stop offset="100%" stopColor="#E8F8FF"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="160" height="108" fill="url(#pp-bg)"/>
      {Array.from({length:ROWS},(_,row) => Array.from({length:COLS},(__,col) => {
        const cx = ox + col*sqrt3*R + (row%2)*sqrt3/2*R + R
        const cy = oy + row*1.5*R + R
        const key = `${row}-${col}`
        const onPath = pathSet.has(key)
        const isMine = mineSet.has(key)
        const isStart = row===0 && col===0
        const isEnd   = row===3 && col===3
        return (
          <g key={key}>
            <polygon points={hexPts(cx,cy,R-1)}
              fill={isStart?'#86EFAC' : isEnd?'#93DCFF' : onPath?'#A8E6CF' : isMine?'rgba(255,107,107,0.15)' : 'rgba(255,255,255,0.7)'}
              stroke={onPath||isStart||isEnd ? '#A8E6CF' : isMine?'rgba(255,107,107,0.3)' : 'rgba(0,0,0,0.07)'}
              strokeWidth={onPath||isStart||isEnd ? 1.5 : 1}
              filter={onPath&&!isStart&&!isEnd ? 'url(#glow)' : ''}
              opacity={0.95}
            />
            {isMine && <text x={cx} y={cy+4} textAnchor="middle" fontSize="8" fill="rgba(255,107,107,0.5)"
              fontFamily="system-ui,sans-serif">×</text>}
            {isStart && <text x={cx} y={cy+4} textAnchor="middle" fontSize="7" fontWeight="900" fill="#1A1A2E"
              fontFamily="system-ui,sans-serif">A</text>}
            {isEnd && <text x={cx} y={cy+4} textAnchor="middle" fontSize="7" fontWeight="900" fill="#1A1A2E"
              fontFamily="system-ui,sans-serif">B</text>}
          </g>
        )
      }))}
    </svg>
  )
}

function FocusGrid({ className }: IllProps) {
  const cells = Array.from({ length: 25 }, (_, i) => i === 12)
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="fcg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EAF4FF" />
          <stop offset="100%" stopColor="#FFF9E8" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#fcg-bg)" />
      {cells.map((odd, i) => {
        const col = i % 5, row = Math.floor(i / 5)
        return (
          <rect key={i} x={22+col*24} y={12+row*18} width="16" height="12" rx="3"
            fill={odd ? 'hsl(210,70%,50%)' : 'hsl(210,55%,72%)'}
            stroke={odd ? 'white' : 'none'} strokeWidth={odd ? 1.5 : 0} />
        )
      })}
    </svg>
  )
}

function SpeedSort({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="spso-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF9E8" />
          <stop offset="100%" stopColor="#FFF0F0" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#spso-bg)" />
      <circle cx="80" cy="30" r="15" fill="#FF6B6B" opacity="0.92" />
      <rect x="14" y="60" width="58" height="32" rx="9" fill="rgba(255,107,107,0.14)" stroke="#FF6B6B" strokeWidth="1.5" />
      <rect x="88" y="60" width="58" height="32" rx="9" fill="rgba(76,201,240,0.14)" stroke="#4CC9F0" strokeWidth="1.5" />
      <rect x="26" y="74" width="14" height="14" rx="3" fill="#4CC9F0" opacity="0.9" />
      <circle cx="118" cy="81" r="7" fill="#86EFAC" opacity="0.9" />
    </svg>
  )
}

function WordFlux({ className }: IllProps) {
  const letters = ['N','I','M','A','R','C','A','D','E']
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {letters.map((l, i) => {
        const col = i % 3, row = Math.floor(i / 3)
        const active = [0,1,3].includes(i)
        return (
          <g key={i}>
            <rect x={20+col*44} y={12+row*26} width="34" height="22" rx="4"
              fill={active ? '#201C15' : S} stroke={active ? G : DIM} strokeWidth={active ? 1.5 : 0.5} />
            <text x={37+col*44} y={27+row*26} textAnchor="middle"
              fill={active ? GB : DIM} fontSize="12" fontWeight="bold" fontFamily="monospace">{l}</text>
          </g>
        )
      })}
      <text x="80" y="102" textAnchor="middle" fill={G} fontSize="8" fontFamily="monospace">NIM</text>
    </svg>
  )
}

// ── CLASSIC ARCADE ─────────────────────────────────────────────────────────
function Nimtris({ className }: IllProps) {
  const pastels = ['#93DCFF','#C4B5FD','#86EFAC','#FDBA74','#FCD34D','#F9A8D4']
  const stack = [
    [0,1,2,3,4,5],
    [5,0,1,2,3,4],
    [null,4,5,0,1,null],
    [null,null,1,2,null,null],
  ]
  const BS = 13, ox = 26, oy = 6
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="nt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4895EF" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="#FFF8E8"/>
      <rect width="160" height="108" fill="url(#nt-bg)"/>
      {/* game board outline */}
      <rect x={ox-3} y={oy-3} width={6*BS+6} height={4*BS+46} rx={6}
        fill="rgba(255,255,255,0.6)" stroke="rgba(72,149,239,0.15)" strokeWidth="1.5"/>
      {/* stacked blocks */}
      {stack.map((row, ri) => row.map((ci, col) => ci !== null ? (
        <rect key={`${ri}-${col}`}
          x={ox+col*BS+1} y={oy+(stack.length-1-ri)*BS+44}
          width={BS-2} height={BS-2} rx={2.5}
          fill={pastels[ci % pastels.length]} opacity={0.92}
        />
      ) : null))}
      {/* falling I-piece (4 wide, cyan) */}
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x={ox+i*BS+1} y={oy+6} width={BS-2} height={BS-2} rx={2.5} fill="#4895EF" opacity={0.95}/>
          {/* highlight */}
          <rect x={ox+i*BS+2} y={oy+7} width={BS-4} height={4} rx={1} fill="rgba(255,255,255,0.35)"/>
        </g>
      ))}
      {/* speed lines above piece */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={ox+i*BS+BS/2} y1={oy} x2={ox+i*BS+BS/2} y2={oy+4}
          stroke="#4895EF" strokeWidth={1.5} opacity={0.4}/>
      ))}
    </svg>
  )
}

function HexFallIll({ className }: IllProps) {
  const PASTELS = ['#86EFAC','#C4B5FD','#93DCFF','#FCA5A5','#FDBA74']
  const R = 12, COLS = 5, ROWS = 4
  const sqrt3 = Math.sqrt(3)
  const pxW = (COLS - 1) * sqrt3 * R + sqrt3/2 * R + R*2
  const pxH = (ROWS - 1) * 1.5 * R + R * 2
  const ox = (160 - pxW) / 2 + 4, oy = (108 - pxH) / 2 - 6
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`}).join(' ')
  // Cells to "explode" (removed group)
  const exploding = new Set(['1-2','1-3','2-2','2-3'])
  // Particle positions around exploding group center
  const particles = [{x:95,y:35},{x:108,y:28},{x:112,y:44},{x:88,y:24},{x:100,y:48}]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <radialGradient id="hf-bg" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#F0FFF4"/>
          <stop offset="100%" stopColor="#FFF9E8"/>
        </radialGradient>
      </defs>
      <rect width="160" height="108" fill="url(#hf-bg)"/>
      <rect x={4} y={4} width={152} height={100} rx={12} fill="rgba(255,255,255,0.55)"/>
      {Array.from({length: ROWS}, (_,row) => Array.from({length: COLS}, (__,col) => {
        const cx = ox + col * sqrt3 * R + (row % 2) * sqrt3/2 * R + R
        const cy = oy + row * 1.5 * R + R
        const key = `${row}-${col}`
        const isExploding = exploding.has(key)
        return !isExploding ? (
          <polygon key={key} points={hexPts(cx,cy,R-1.5)}
            fill={PASTELS[(row*COLS+col)%PASTELS.length]} opacity={0.9}/>
        ) : null
      }))}
      {/* explosion particles */}
      {particles.map((p,i) => (
        <polygon key={i} points={hexPts(p.x, p.y, 5+i%3*2)}
          fill={PASTELS[i % PASTELS.length]} opacity={0.7+(i%3)*0.1}/>
      ))}
      {/* COMBO flash text */}
      <text x="80" y="96" textAnchor="middle" fontSize="9" fontWeight="900"
        fill="#80ED99" fontFamily="system-ui,sans-serif" letterSpacing="2" opacity="0.85">COMBO ×3</text>
    </svg>
  )
}

function SnakePath({ className }: IllProps) {
  const segs = [{x:7,y:4},{x:6,y:4},{x:5,y:4},{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:7,y:6},{x:8,y:6}]
  const CELL = 14
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#FFF9E8" />
      <rect x={4} y={4} width={152} height={100} rx={10} fill="white" opacity={0.7}/>
      {segs.map((seg,i) => {
        const t = 1 - i/segs.length
        const isHead = i === 0
        return (
          <rect key={i}
            x={seg.x*CELL+8} y={seg.y*CELL+14}
            width={CELL-2} height={CELL-2} rx={isHead?5:4}
            fill={`rgba(82,214,129,${0.35+t*0.65})`}
          />
        )
      })}
      {/* eyes on head */}
      <circle cx={segs[0].x*CELL+8+CELL-3} cy={segs[0].y*CELL+14+4} r={1.5} fill="#1A1A2E"/>
      <circle cx={segs[0].x*CELL+8+CELL-3} cy={segs[0].y*CELL+14+CELL-5} r={1.5} fill="#1A1A2E"/>
      {/* food */}
      <circle cx={12*CELL+8+CELL/2} cy={4*CELL+14+CELL/2} r={6} fill="#FF6B6B" opacity={0.9}/>
      <circle cx={12*CELL+6+CELL/2} cy={4*CELL+12+CELL/2} r={1.5} fill="rgba(255,255,255,0.6)"/>
    </svg>
  )
}

function SpaceRaid({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#1A0E0A" />
      {/* stars */}
      {[[20,10],[50,25],[100,8],[140,30],[30,50],[130,55],[80,40]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="1" fill="#FFFFFF" opacity=".5" />
      ))}
      {/* enemies */}
      {[[35,20],[80,20],[125,20],[57,38],[103,38]].map(([x,y],i)=>(
        <path key={i} d={`M${x},${y} l-10,12 l20,0 Z`} fill={'#FF6B6B'} opacity=".85" />
      ))}
      {/* player */}
      <path d="M80,88 L68,100 L92,100 Z" fill="#FF9F43" />
      <rect x="78" y="80" width="4" height="12" fill="#FF9F43" />
      {/* bullet */}
      <rect x="79" y="56" width="2" height="18" rx="1" fill="#4CC9F0" />
    </svg>
  )
}

function Breakwall({ className }: IllProps) {
  const bricks = Array.from({ length: 18 }, (_, i) => i)
  const colors = ['#93DCFF', '#C4B5FD', '#86EFAC']
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="bw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B1430" />
          <stop offset="100%" stopColor="#0D0A18" />
        </linearGradient>
        <filter id="bw-glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#bw-bg)" />
      {bricks.map(i => {
        const c = i % 6, r = Math.floor(i / 6)
        const broken = [2, 7, 8, 14].includes(i)
        return !broken ? (
          <rect key={i} x={10 + c * 24} y={10 + r * 14} width="20" height="11" rx="3"
            fill={colors[r]} opacity={0.92} />
        ) : null
      })}
      <circle cx="80" cy="72" r="5" fill="white" filter="url(#bw-glow)" />
      <rect x="52" y="90" width="56" height="8" rx="4" fill="#FFB347" filter="url(#bw-glow)" />
    </svg>
  )
}

function FrogCross({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#14121E" />
      {/* road lanes */}
      {[0,1,2].map(i => (
        <rect key={i} x="0" y={20+i*22} width="160" height="18" fill={i%2===0?'#1B1B2E':'#1a1710'} />
      ))}
      {/* cars */}
      <rect x="10" y="23" width="36" height="14" rx="3" fill={'#FF6B6B'} opacity=".85" />
      <rect x="90" y="45" width="36" height="14" rx="3" fill={'#A78BFA'} opacity=".85" />
      {/* logs in water */}
      <rect x="0" y="84" width="160" height="18" fill="#123048" opacity=".85" />
      <rect x="15" y="87" width="50" height="12" rx="5" fill="#8B5A2B" />
      <rect x="95" y="87" width="50" height="12" rx="5" fill="#8B5A2B" />
      {/* frog */}
      <circle cx="80" cy="78" r="7" fill={'#86EFAC'} />
      <circle cx="77" cy="75" r="2" fill="#14121E" /><circle cx="83" cy="75" r="2" fill="#14121E" />
    </svg>
  )
}

function PongDuel({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="pd-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#171334" />
          <stop offset="100%" stopColor="#0E0B22" />
        </linearGradient>
        <filter id="pd-glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#pd-bg)" />
      <line x1="0" y1="54" x2="160" y2="54" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="6,5" />
      <text x="80" y="38" textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="26" fontWeight="900" fontFamily="system-ui,sans-serif">3</text>
      <text x="80" y="86" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="26" fontWeight="900" fontFamily="system-ui,sans-serif">5</text>
      <rect x="36" y="16" width="34" height="7" rx="3.5" fill="#FF9F43" filter="url(#pd-glow)" />
      <rect x="90" y="88" width="34" height="7" rx="3.5" fill="#4CC9F0" filter="url(#pd-glow)" />
      <rect x="76" y="50" width="8" height="8" rx="2" fill="white" filter="url(#pd-glow)" />
    </svg>
  )
}

// ── ACTION ─────────────────────────────────────────────────────────────────
function HexRunner({ className }: IllProps) {
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`}).join(' ')
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="runner-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF9E0"/>
          <stop offset="100%" stopColor="#FFF3C0"/>
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#runner-sky)"/>
      {/* clouds */}
      <ellipse cx="38" cy="18" rx="18" ry="7" fill="white" opacity="0.85"/>
      <ellipse cx="52" cy="14" rx="12" ry="8" fill="white" opacity="0.85"/>
      <ellipse cx="24" cy="15" rx="10" ry="6" fill="white" opacity="0.85"/>
      <ellipse cx="118" cy="22" rx="14" ry="6" fill="white" opacity="0.7"/>
      <ellipse cx="130" cy="18" rx="10" ry="7" fill="white" opacity="0.7"/>
      {/* rolling hills */}
      <path d="M0,82 Q20,68 45,74 Q70,80 90,70 Q110,60 130,68 Q148,74 160,70 L160,108 L0,108 Z"
        fill="#FDBA74" opacity="0.35"/>
      {/* ground */}
      <rect x="0" y="84" width="160" height="24" fill="#FFD166"/>
      <rect x="0" y="84" width="160" height="2" fill="#FFB830"/>
      {/* speed lines */}
      {[30,40,50,60].map((y,i)=>(
        <line key={i} x1="0" y1={y} x2={18+i*6} y2={y} stroke="rgba(255,193,80,0.4)" strokeWidth="1.2"/>
      ))}
      {/* obstacles */}
      <rect x="96" y="64" width="16" height="20" rx="3" fill="#FF6B6B" opacity="0.9"/>
      <rect x="128" y="56" width="16" height="28" rx="3" fill="#FF6B6B" opacity="0.9"/>
      {/* player hex jumping */}
      <polygon points={hexPts(50,52,13)} fill="#4CC9F0"/>
      <polygon points={hexPts(50,52,13)} fill="rgba(255,255,255,0.2)"
        clipPath="polygon(0 0, 100% 0, 100% 45%, 0 45%)"/>
      {/* jump arc suggestion */}
      <path d="M36,78 Q50,38 64,58" stroke="#4CC9F0" strokeWidth="1.2" fill="none" strokeDasharray="3,3" opacity="0.5"/>
    </svg>
  )
}

function QuickTapIll({ className }: IllProps) {
  const HEX = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`}).join(' ')
  const targets = [
    {cx:38, cy:28, r:16, col:'#FFB347', glow:true },
    {cx:110,cy:38, r:13, col:'#86EFAC', glow:false},
    {cx:65, cy:72, r:18, col:'#C4B5FD', glow:false},
    {cx:130,cy:76, r:11, col:'#FCA5A5', glow:false},
    {cx:92, cy:20, r:9,  col:'#7DD3FC', glow:false},
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="qt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF8E8"/>
          <stop offset="100%" stopColor="#FFF4E0"/>
        </linearGradient>
        <filter id="qt-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#qt-bg)"/>
      {targets.map((t,i)=>(
        <g key={i} filter={t.glow?'url(#qt-glow)':undefined}>
          <polygon points={HEX(t.cx,t.cy,t.r+5)} fill={t.col} opacity={0.18}/>
          <polygon points={HEX(t.cx,t.cy,t.r)} fill={t.col} opacity={0.9}/>
          <polygon points={HEX(t.cx,t.cy,t.r-4)} fill="rgba(255,255,255,0.25)"/>
        </g>
      ))}
      {/* tap ripple on first target */}
      <polygon points={HEX(38,28,26)} fill="none" stroke="#FFB347" strokeWidth="1.5" opacity=".3"/>
      <polygon points={HEX(38,28,34)} fill="none" stroke="#FFB347" strokeWidth="0.8" opacity=".15"/>
      <text x="80" y="102" textAnchor="middle" fill="#C9A060" fontSize="7" fontFamily="system-ui,sans-serif" fontWeight="700" letterSpacing="1.5">TAP · REACT · REPEAT</text>
    </svg>
  )
}

function LowdownIll({ className }: IllProps) {
  const cards = [
    {x:22,  y:16, w:52, h:34, rot:-8,  expr:'14 + 27', col:'#FFF8E8'},
    {x:100, y:12, w:52, h:34, rot:7,   expr:'83 - 19',  col:'#FFF0F5'},
    {x:56,  y:55, w:56, h:36, rot:-2,  expr:'6 × 8',    col:'#F0FFF4'},
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="ld-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF8E8"/><stop offset="100%" stopColor="#FFF4E0"/>
        </linearGradient>
        <filter id="ld-sh"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.10)"/></filter>
      </defs>
      <rect width="160" height="108" fill="url(#ld-bg)"/>
      {cards.map((c,i)=>(
        <g key={i} transform={`rotate(${c.rot},${c.x+c.w/2},${c.y+c.h/2})`} filter="url(#ld-sh)">
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="6" fill={c.col} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"/>
          <text x={c.x+c.w/2} y={c.y+c.h/2+4} textAnchor="middle" fontSize="11" fontWeight="900"
            fill="#1A1A2E" fontFamily="system-ui,sans-serif">{c.expr}</text>
        </g>
      ))}
      {/* HIGHER / LOWER buttons */}
      <rect x="10" y="88" width="62" height="14" rx="7" fill="#80ED99" opacity="0.9"/>
      <text x="41" y="98.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#14532D" fontFamily="system-ui,sans-serif">HIGHER ↑</text>
      <rect x="88" y="88" width="62" height="14" rx="7" fill="#FFB5C2" opacity="0.9"/>
      <text x="119" y="98.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#881337" fontFamily="system-ui,sans-serif">LOWER ↓</text>
    </svg>
  )
}

function GalaxyDefenderIll({ className }: IllProps) {
  const HEX = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`}).join(' ')
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <radialGradient id="gd-bg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#1E1B4B"/>
          <stop offset="100%" stopColor="#0F0E26"/>
        </radialGradient>
        <filter id="gd-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#gd-bg)"/>
      {/* Stars */}
      {[[12,8],[35,15],[55,5],[90,12],[118,8],[142,18],[28,42],[75,35],[132,38],[160,50],[8,65]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={i%3===0?1.2:0.7} fill="white" opacity={0.3+i*0.04}/>
      ))}
      {/* Planet */}
      <circle cx="132" cy="28" r="16" fill="#2A1F5E" opacity="0.9"/>
      <ellipse cx="132" cy="28" rx="22" ry="5" fill="none" stroke="#7C6FCD" strokeWidth="1.5" opacity="0.6"/>
      <circle cx="132" cy="28" r="16" fill="none" stroke="#4B3F9E" strokeWidth="0.5"/>
      {/* Enemies */}
      <polygon points="42,18 34,30 50,30" fill="#FF9F43" opacity="0.9"/>
      <polygon points="80,12 72,24 88,24" fill="#C4B5FD" opacity="0.9"/>
      <rect x="100" y="16" width="18" height="13" rx="3" fill="#FF6B6B" opacity="0.85"/>
      {/* Bullets */}
      <rect x="41" y="31" width="2" height="7" rx="1" fill="#4CC9F0" opacity="0.8"/>
      <rect x="79" y="25" width="2" height="7" rx="1" fill="#4CC9F0" opacity="0.6"/>
      {/* Player hex ship */}
      <polygon points={HEX(80,84,14)} fill="#4CC9F0" filter="url(#gd-glow)"/>
      <polygon points={HEX(80,84,8)} fill="rgba(255,255,255,0.2)"/>
      {/* Engine glow */}
      <ellipse cx="80" cy="97" rx="5" ry="7" fill="#86EFAC" opacity="0.7"/>
      {/* Wings */}
      <polygon points="66,84 56,94 68,90" fill="rgba(76,201,240,0.4)"/>
      <polygon points="94,84 104,94 92,90" fill="rgba(76,201,240,0.4)"/>
    </svg>
  )
}

function GravitySwitch({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="gsw-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B1430" />
          <stop offset="100%" stopColor="#0D0A18" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#gsw-bg)" />
      {/* spikes top */}
      {Array.from({length:8},(_,i)=>(
        <polygon key={i} points={`${10+i*20},0 ${18+i*20},14 ${2+i*20},14`} fill={'#FF6B6B'} opacity=".8" />
      ))}
      {/* spikes bottom */}
      {Array.from({length:8},(_,i)=>(
        <polygon key={i} points={`${10+i*20},108 ${18+i*20},94 ${2+i*20},94`} fill={'#FF6B6B'} opacity=".8" />
      ))}
      {/* corridor blocks */}
      {[[0,24],[40,28],[80,20],[120,26]].map(([x,h],i)=>(
        <rect key={i} x={x} y={16} width="28" height={h} rx="2" fill="#241D3E" />
      ))}
      {/* player */}
      <rect x="72" y="48" width="16" height="16" rx="3" fill="#93DCFF" />
      <polygon points="72,52 64,56 72,60" fill="#93DCFF" opacity=".6" />
    </svg>
  )
}

function NeonBlade({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="nb-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#171334" />
          <stop offset="100%" stopColor="#0B0920" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#nb-bg)" />
      {/* objects */}
      <circle cx="50" cy="45" r="18" fill="#93DCFF" opacity=".9" />
      <rect x="95" y="16" width="28" height="28" rx="3" fill="#C4B5FD" opacity=".9" />
      <polygon points="120,72 135,58 148,78" fill="#FCA5A5" opacity=".9" />
      {/* slash */}
      <path d="M15,90 Q80,20 145,75" stroke="#FDE68A" strokeWidth="2.5" fill="none"
        strokeLinecap="round" opacity=".9" />
      <path d="M15,90 Q80,20 145,75" stroke="#FFFFFF" strokeWidth="1" fill="none"
        strokeLinecap="round" opacity=".4" />
    </svg>
  )
}

function DodgeStorm({ className }: IllProps) {
  const bullets = [[30,20],[80,10],[120,35],[55,50],[140,15],[20,70],[100,60]]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="ds-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#171334" />
          <stop offset="100%" stopColor="#0B0920" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#ds-bg)" />
      {bullets.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="4" fill={'#FF6B6B'} opacity=".85" />
      ))}
      {bullets.map(([x,y],i)=>(
        <line key={`t${i}`} x1={x} y1={y} x2={x-12} y2={y+4} stroke={'#FF6B6B'} strokeWidth="1.5" opacity=".4" />
      ))}
      <circle cx="80" cy="80" r="14" fill="none" stroke="#7DE3FF" strokeWidth="1.5" opacity=".5" />
      <circle cx="80" cy="80" r="7" fill="#7DE3FF" />
    </svg>
  )
}

function TowerStack({ className }: IllProps) {
  const layers = [
    { w: 80, hue: 43 }, { w: 70, hue: 52 }, { w: 65, hue: 61 },
    { w: 55, hue: 70 }, { w: 42, hue: 79 },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="ts-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B2350" />
          <stop offset="100%" stopColor="#120E24" />
        </linearGradient>
        <filter id="ts-glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="160" height="108" fill="url(#ts-bg)" />
      {[[16, 10, 1], [140, 18, 0.7], [30, 24, 1.2], [124, 30, 0.8]].map(([x, y, s], i) => (
        <circle key={i} cx={x} cy={y} r={s} fill="white" opacity={0.4} />
      ))}
      {layers.map(({ w, hue }, i) => (
        <rect key={i} x={(160 - w) / 2} y={90 - i * 15} width={w} height="13" rx="2" fill={`hsl(${hue},55%,55%)`} />
      ))}
      <rect x="20" y="14" width="50" height="13" rx="2" fill="#93DCFF" filter="url(#ts-glow)" />
    </svg>
  )
}

// ── PUZZLE ─────────────────────────────────────────────────────────────────
function MemoryRush({ className }: IllProps) {
  // Floating cards at angles, colorful
  const cards = [
    { x:18,  y:14, rot:-12, color:'#FF6B6B',  sym:'★', matched:true  },
    { x:64,  y:8,  rot:5,   color:'#C4B5FD',  sym:'◆', matched:false },
    { x:108, y:12, rot:-6,  color:'#86EFAC',  sym:'⬡', matched:true  },
    { x:140, y:20, rot:14,  color:'#FCD34D',  sym:'●', matched:false },
    { x:10,  y:58, rot:8,   color:'#C4B5FD',  sym:'◆', matched:true  },
    { x:52,  y:52, rot:-10, color:'#FF6B6B',  sym:'★', matched:true  },
    { x:96,  y:56, rot:7,   color:'#FCA5A5',  sym:'▲', matched:false },
    { x:134, y:60, rot:-8,  color:'#86EFAC',  sym:'⬡', matched:false },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="mr-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8F0FF"/>
          <stop offset="100%" stopColor="#FFF0FF"/>
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#mr-bg)"/>
      {cards.map((c,i) => (
        <g key={i} transform={`rotate(${c.rot},${c.x+14},${c.y+18})`}>
          <rect x={c.x} y={c.y} width="28" height="36" rx="5"
            fill={c.matched ? c.color : 'white'}
            stroke={c.matched ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.1)'}
            strokeWidth="1"
            filter={c.matched ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.1))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.07))'}
            opacity={0.92}
          />
          <text x={c.x+14} y={c.y+23} textAnchor="middle" fontSize="13" fontWeight="900"
            fill={c.matched ? 'white' : 'rgba(0,0,0,0.18)'}
            fontFamily="system-ui,sans-serif">{c.matched ? c.sym : '⬡'}</text>
        </g>
      ))}
      {/* Match glow */}
      <text x="80" y="100" textAnchor="middle" fontSize="8" fontWeight="800"
        fill="#C4B5FD" fontFamily="system-ui,sans-serif" letterSpacing="2" opacity="0.8">MATCH!</text>
    </svg>
  )
}

function MergeHex({ className }: IllProps) {
  const vals = ['2','4','8','16','32','4','8','16','2','4','8','2','4','2']
  const cols  = ['#3D3218','#4A3D1E','#5E4C22','#7A6028','#A07E30',
                 '#4A3D1E','#5E4C22','#7A6028','#3D3218','#4A3D1E','#5E4C22','#3D3218','#4A3D1E','#3D3218']
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {vals.map((v,i)=>{
        const col=i%4,row=Math.floor(i/4)
        const ox=row%2===1?18:0
        return (
          <g key={i}>
            <HexPath cx={26+col*34+ox} cy={24+row*24} r={14} fill={cols[i]} stroke={G} />
            <text x={26+col*34+ox} y={28+row*24} textAnchor="middle"
              fill={G} fontSize="7" fontWeight="bold" fontFamily="monospace">{v}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ColorPath({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#16130E" />
      {/* grid */}
      {Array.from({length:25},(_,i)=>{
        const col=i%5,row=Math.floor(i/5)
        return <rect key={i} x={16+col*28} y={12+row*18} width="22" height="14" rx="2" fill="#211D14" opacity=".8" />
      })}
      {/* paths */}
      <polyline points="27,19 27,37 55,37 55,55 83,55" stroke="#FF6B6B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="111,19 111,37 139,37 139,55 139,73" stroke="#4ECDC4" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* endpoints */}
      {[[27,19,'#FF6B6B'],[83,55,'#FF6B6B'],[111,19,'#4ECDC4'],[139,73,'#4ECDC4']].map(([x,y,c],i)=>(
        <circle key={i} cx={x as number} cy={y as number} r="5" fill={c as string} />
      ))}
    </svg>
  )
}

function ShiftBlocks({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="sfb-goal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE27A" /><stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="#16130E" />
      {/* exit glow */}
      <rect x="140" y="44" width="6" height="20" rx="2" fill="#FFD54A" opacity=".8" />
      {/* blocks */}
      <rect x="12" y="44" width="30" height="30" rx="3" fill="#3A3428" stroke="#655C46" strokeWidth="1.5" />
      <rect x="60" y="20" width="30" height="30" rx="3" fill="#3A3428" stroke="#655C46" strokeWidth="1.5" />
      <rect x="100" y="60" width="30" height="30" rx="3" fill="#3A3428" stroke="#655C46" strokeWidth="1.5" />
      <rect x="55" y="58" width="60" height="26" rx="3" fill="url(#sfb-goal)" />
      {/* arrows */}
      <path d="M46,72 L52,72 M49,68 L54,72 L49,76" stroke="#E8DFC8" strokeWidth="1.5" fill="none" opacity=".8" />
      <path d="M118,72 L124,72 M121,68 L126,72 L121,76" stroke="#FFD54A" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function HexFlow({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#0B1420" />
      {/* pipe segments */}
      {[
        {x:30,y:30,type:'corner'},{x:65,y:30,type:'h'},{x:100,y:30,type:'corner2'},
        {x:30,y:58,type:'v'},{x:100,y:58,type:'v'},
        {x:30,y:86,type:'corner3'},{x:65,y:86,type:'h2'},{x:100,y:86,type:'end'},
      ].map((seg,i)=>(
        <rect key={i} x={seg.x-12} y={seg.y-12} width="24" height="24" rx="4"
          fill={'#17212F'} stroke={i<5?'#22D3EE':'#2A3648'} strokeWidth={i<5?1.5:1} />
      ))}
      {/* flow */}
      <path d="M30,30 H100 V86 H65" stroke="#22D3EE" strokeWidth="4" fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity=".65" />
      {/* source */}
      <circle cx="30" cy="30" r="8" fill="#67E8F9" />
      <circle cx="65" cy="86" r="8" fill="#22D3EE" opacity=".7" />
    </svg>
  )
}

function LightBounce({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* beam */}
      <path d="M20,20 L80,80 L140,30" stroke="#7DD3FC" strokeWidth="2" fill="none" opacity=".85" />
      <path d="M20,20 L80,80 L140,30" stroke="#7DD3FC" strokeWidth="1" fill="none" opacity=".3" />
      {/* mirrors */}
      <line x1="70" y1="90" x2="90" y2="70" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <line x1="125" y1="20" x2="145" y2="40" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      {/* crystals */}
      <polygon points="20,12 26,20 14,20" fill={GB} opacity=".9" />
      <polygon points="140,22 146,30 134,30" fill={G} opacity=".9" />
      <circle cx="80" cy="80" r="5" fill="#7DD3FC" opacity=".6" />
    </svg>
  )
}

function LowPop({ className }: IllProps) {
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({length:6},(_,i)=>{const a=Math.PI/3*i-Math.PI/6;return `${(cx+(r-1)*Math.cos(a)).toFixed(1)},${(cy+(r-1)*Math.sin(a)).toFixed(1)}`}).join(' ')

  const hexes = [
    { cx:34,  cy:30, r:22, color:'#FFB5C2', num:'-12', rot:-8  },
    { cx:120, cy:24, r:20, color:'#BDE0FE', num:'47',  rot:6   },
    { cx:22,  cy:78, r:18, color:'#D4B3FF', num:'3',   rot:-5  },
    { cx:118, cy:78, r:20, color:'#B3F0D4', num:'99',  rot:10  },
    { cx:74,  cy:54, r:24, color:'#FFD4B3', num:'-7',  rot:-3  },
  ]

  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="lp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF5F7"/>
          <stop offset="100%" stopColor="#FFF8E7"/>
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#lp-bg)"/>
      {hexes.map((h,i) => (
        <g key={i} transform={`rotate(${h.rot},${h.cx},${h.cy})`}
          filter="drop-shadow(0 3px 7px rgba(0,0,0,0.10))">
          <polygon points={hexPts(h.cx,h.cy,h.r)} fill={h.color} opacity={0.9}/>
          <text x={h.cx} y={h.cy+4} textAnchor="middle"
            fontSize={h.num.length>3?'8':'11'} fontWeight="900"
            fill="#1A1A2E" fontFamily="system-ui,sans-serif" opacity={0.85}>{h.num}</text>
        </g>
      ))}
    </svg>
  )
}

function SumPath({ className }: IllProps) {
  const nums = [3,7,2,9,4,6,1,8,5,3,7,4,2,6,8,9]
  const path = [0,1,5,6,10,11,15]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {nums.map((n,i)=>{
        const col=i%4,row=Math.floor(i/4)
        const onPath=path.includes(i)
        return (
          <g key={i}>
            <rect x={16+col*36} y={12+row*22} width="28" height="18" rx="3"
              fill={onPath?G:S} stroke={onPath?GB:DIM} strokeWidth={onPath?1.5:0.5} />
            <text x={30+col*36} y={24+row*22} textAnchor="middle"
              fill={onPath?BG:DIM} fontSize="9" fontWeight="bold" fontFamily="monospace">{n}</text>
          </g>
        )
      })}
      <text x="80" y="102" textAnchor="middle" fill={G} fontSize="8" fontFamily="monospace">SUM = 36</text>
    </svg>
  )
}

function WordFreshIll({ className }: IllProps) {
  const tiles = [
    { x: 18, y: 16, l: 'W', rot: -10, col: '#93DCFF' },
    { x: 54, y: 8, l: 'O', rot: 6, col: '#C4B5FD' },
    { x: 92, y: 18, l: 'R', rot: -6, col: '#86EFAC' },
    { x: 128, y: 10, l: 'D', rot: 9, col: '#FDBA74' },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="wf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0FFF6" />
          <stop offset="100%" stopColor="#E8FFF4" />
        </linearGradient>
      </defs>
      <rect width="160" height="108" fill="url(#wf-bg)" />
      {tiles.map((t, i) => (
        <g key={i} transform={`rotate(${t.rot},${t.x + 14},${t.y + 14})`} filter="drop-shadow(0 3px 6px rgba(0,0,0,0.08))">
          <rect x={t.x} y={t.y} width={28} height={28} rx={7} fill={t.col} opacity={0.92} />
          <text x={t.x + 14} y={t.y + 19} textAnchor="middle" fontSize="14" fontWeight="900" fill="#1A1A2E" fontFamily="system-ui,sans-serif">{t.l}</text>
        </g>
      ))}
      <rect x="24" y="72" width="112" height="20" rx="10" fill="white" opacity={0.85} stroke="rgba(0,0,0,0.06)" />
      <text x="80" y="86" textAnchor="middle" fontSize="11" fontWeight="900" fill="#5BAA7E" fontFamily="system-ui,sans-serif" letterSpacing="1">WORD</text>
    </svg>
  )
}

function MiniSudokuIll({ className }: IllProps) {
  const vals = [1, 2, null, 4, 3, 4, 1, null, null, 1, 4, 3, 4, null, 2, 1]
  const selected = 2
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <defs>
        <linearGradient id="ms-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5F3FF" />
          <stop offset="100%" stopColor="#FFF8E8" />
        </linearGradient>
        <filter id="ms-sh"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(0,0,0,0.12)" /></filter>
      </defs>
      <rect width="160" height="108" fill="url(#ms-bg)" />
      <g transform="translate(46,10)" filter="url(#ms-sh)">
        <rect x={-4} y={-4} width={76} height={76} rx={10} fill="#1A1A2E" />
        {vals.map((v, i) => {
          const col = i % 4, row = Math.floor(i / 4)
          const bx = col * 17, by = row * 17
          const isSel = i === selected
          return (
            <g key={i}>
              <rect x={bx} y={by} width={15.5} height={15.5} rx={3}
                fill={isSel ? '#FDE68A' : v !== null ? '#EFEFE8' : 'white'}
                stroke={isSel ? '#E9B213' : 'rgba(0,0,0,0.06)'} strokeWidth={isSel ? 1.5 : 0.5} />
              {v !== null && <text x={bx + 7.75} y={by + 11.5} textAnchor="middle" fontSize="9" fontWeight="900" fill="#1A1A2E" fontFamily="system-ui,sans-serif">{v}</text>}
            </g>
          )
        })}
      </g>
      <text x="80" y="100" textAnchor="middle" fontSize="8" fontWeight="800" fill="#9B7EC4" fontFamily="system-ui,sans-serif" letterSpacing="1.5" opacity={0.85}>4×4 → 6×6</text>
    </svg>
  )
}

// ── registry ────────────────────────────────────────────────────────────────
const ILLUSTRATIONS: Record<string, React.ComponentType<IllProps>> = {
  'memory-matrix':  MemoryMatrix,
  'dual-n-back':    DualNBack,
  'color-stroop':   ColorStroop,
  'number-flow':    NumberFlow,
  'pattern-sync':   PatternSync,
  'perilous-path':  PerilousPathIll,
  'focus-grid':     FocusGrid,
  'speed-sort':     SpeedSort,
  'word-flux':      WordFlux,
  nimtris:          Nimtris,
  hexfall:          HexFallIll,
  'snake-path':     SnakePath,
  'space-raid':     SpaceRaid,
  breakwall:        Breakwall,
  'frog-cross':     FrogCross,
  'pong-duel':      PongDuel,
  runner:           HexRunner,
  quicktap:         QuickTapIll,
  lowdown:          LowdownIll,
  'galaxy-defender': GalaxyDefenderIll,
  'gravity-switch': GravitySwitch,
  'neon-blade':     NeonBlade,
  'dodge-storm':    DodgeStorm,
  'tower-stack':    TowerStack,
  memory:           MemoryRush,
  'merge-hex':      MergeHex,
  'color-path':     ColorPath,
  'shift-blocks':   ShiftBlocks,
  'hex-flow':       HexFlow,
  'light-bounce':   LightBounce,
  'sum-path':       SumPath,
  'low-pop':        LowPop,
  'word-fresh':     WordFreshIll,
  'mini-sudoku':    MiniSudokuIll,
}

export default function GameIllustration({ id, className }: { id: string; className?: string }) {
  const Comp = ILLUSTRATIONS[id]
  if (!Comp) return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#16130E" />
      <text x="80" y="60" textAnchor="middle" fill="#6B6047" fontSize="12" fontFamily="monospace">?</text>
    </svg>
  )
  return <Comp className={className} />
}
