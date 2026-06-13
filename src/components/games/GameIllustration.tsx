// SVG illustrations – one per game. viewBox="0 0 160 108"

interface IllProps { className?: string }

// ── helpers ────────────────────────────────────────────────────────────────
const BG = '#16130E'
const C  = '#EDE0BC'   // cream
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
  const words = [
    { t: 'RED',   fill: G,    x: 40,  y: 34 },
    { t: 'BLUE',  fill: '#6A9BC4', x: 100, y: 34 },
    { t: 'GOLD',  fill: '#C46B5A', x: 40,  y: 62 },
    { t: 'GREEN', fill: '#7DB87A', x: 105, y: 62 },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {words.map(w => (
        <text key={w.t} x={w.x} y={w.y} fill={w.fill} fontSize="13" fontWeight="bold" fontFamily="monospace">{w.t}</text>
      ))}
      <rect x="20" y="74" width="55" height="16" rx="3" fill={S} />
      <rect x="85" y="74" width="55" height="16" rx="3" fill={G} opacity=".35" />
      <text x="47" y="85" fill={DIM} fontSize="8" textAnchor="middle" fontFamily="monospace">WORD</text>
      <text x="112" y="85" fill={G} fontSize="8" textAnchor="middle" fontFamily="monospace">COLOR</text>
    </svg>
  )
}

function DualNBack({ className }: IllProps) {
  const seq = [C, G, DIM, GB, C, G]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {seq.map((col, i) => (
        <g key={i}>
          <circle cx={18 + i * 22} cy="38" r="9" fill={i === 5 ? col : S} stroke={col} strokeWidth="1.5" />
          <rect x={10 + i * 22} y="54" width="16" height="16" rx="2" fill={i === 4 ? G : S} stroke={G} strokeWidth="1" opacity=".7" />
        </g>
      ))}
      <text x="80" y="86" textAnchor="middle" fill={DIM} fontSize="7" fontFamily="monospace">N-BACK SEQUENCE</text>
      <path d="M14 96 L146 96" stroke={S} strokeWidth="1" />
      {[0,1,2].map(i => <rect key={i} x={30+i*32} y="92" width="28" height="6" rx="2" fill={i===1?G:S} />)}
    </svg>
  )
}

function NumberFlow({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      <text x="80" y="42" textAnchor="middle" fill={C} fontSize="28" fontWeight="bold" fontFamily="monospace">47</text>
      <text x="80" y="60" textAnchor="middle" fill={DIM} fontSize="11" fontFamily="monospace">+ 38 = ?</text>
      {[65,85,95,85].map((_v, i) => (
        <rect key={i} x={20+i*32} y="72" width="28" height="18" rx="4" fill={i===0?G:S} stroke={i===0?GB:DIM} strokeWidth="1" />
      ))}
      {['85','75','95','83'].map((v,i)=>(
        <text key={i} x={34+i*32} y="85" textAnchor="middle" fill={i===0?BG:DIM} fontSize="9" fontFamily="monospace">{v}</text>
      ))}
    </svg>
  )
}

function PatternSync({ className }: IllProps) {
  const shapes = [
    { d: 'M50,20 L65,44 L35,44Z', fill: G },
    { d: 'M90,22 L108,22 L108,40 L90,40Z', fill: C },
    { d: 'M130,31 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0', fill: G },
    { d: 'M50,62 L65,62 L58,78Z', fill: DIM },
    { d: 'M90,60 L100,70 L80,70Z', fill: '?' },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {shapes.slice(0,3).map((s,i) => <path key={i} d={s.d} fill={s.fill} opacity=".9" />)}
      <path d="M35,52 L65,52 L65,80 L35,80Z" fill="none" stroke={G} strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="50" y="70" textAnchor="middle" fill={G} fontSize="16" fontWeight="bold">?</text>
      <text x="80" y="102" textAnchor="middle" fill={DIM} fontSize="7" fontFamily="monospace">COMPLETE THE SEQUENCE</text>
    </svg>
  )
}

function FocusGrid({ className }: IllProps) {
  const cells = Array.from({ length: 25 }, (_, i) => i === 12)
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {cells.map((odd, i) => {
        const col = i % 5, row = Math.floor(i / 5)
        return (
          <rect key={i} x={22+col*24} y={12+row*18} width="16" height="12" rx="2"
            fill={odd ? G : S} stroke={odd ? GB : DIM} strokeWidth={odd ? 1.5 : 0.5} />
        )
      })}
      <text x="80" y="103" textAnchor="middle" fill={DIM} fontSize="7" fontFamily="monospace">FIND THE ODD ONE</text>
    </svg>
  )
}

function SpeedSort({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      <HexPath cx={80} cy={38} r={22} fill={G} />
      <text x="80" y="43" textAnchor="middle" fill={BG} fontSize="10" fontWeight="bold" fontFamily="monospace">SORT</text>
      <rect x="16" y="62" width="52" height="28" rx="5" fill={S} stroke={DIM} strokeWidth="1" />
      <rect x="92" y="62" width="52" height="28" rx="5" fill={S} stroke={G} strokeWidth="1.5" />
      <text x="42" y="80" textAnchor="middle" fill={DIM} fontSize="9" fontFamily="monospace">ROUND</text>
      <text x="118" y="80" textAnchor="middle" fill={G} fontSize="9" fontFamily="monospace">SHARP</text>
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
  const pastels = ['#93DCFF','#C4B5FD','#86EFAC','#FDBA74','#FCD34D','#F9A8D4','#67E8F9']
  const stack = [
    [0,1,2,3,4,5],[6,0,1,2,3,4],[null,5,6,0,1,null],[null,null,2,3,null,null],
  ]
  const S = 13, ox = 28, oy = 8
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#FFF8E8" />
      <rect x={ox-2} y={oy-2} width={6*S+4} height={4*S+4+40} rx={4} fill="white" opacity={0.7}/>
      {/* stacked blocks */}
      {stack.map((row, ri) => row.map((ci, col) => ci !== null ? (
        <rect key={`${ri}-${col}`}
          x={ox + col*S + 1} y={oy + (stack.length-1-ri)*S + 42}
          width={S-2} height={S-2} rx={2}
          fill={pastels[ci % pastels.length]} opacity={0.9}
        />
      ) : null))}
      {/* falling I-piece */}
      {[0,1,2,3].map(i => (
        <rect key={i} x={ox+i*S+1} y={oy+4} width={S-2} height={S-2} rx={2} fill="#93DCFF" opacity={0.95}/>
      ))}
      {/* speed lines */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={ox+i*S+(S/2)} y1={oy} x2={ox+i*S+(S/2)} y2={oy+2}
          stroke="#93DCFF" strokeWidth={1.5} opacity={0.5}/>
      ))}
    </svg>
  )
}

function HexFallIll({ className }: IllProps) {
  const colors = [G, C, '#7DB87A', '#9B7EC4', '#6A9BC4', G, C, '#C46B5A', G, C, '#7DB87A', C, G, C, '#6A9BC4', G, C, G, '#9B7EC4', C]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {Array.from({ length: 20 }, (_, i) => {
        const col = i % 5, row = Math.floor(i / 5)
        return (
          <rect key={i} x={18+col*26} y={12+row*22} width="22" height="18" rx="3"
            fill={colors[i]} opacity={row === 0 && [1,3].includes(col) ? 0 : .7} />
        )
      })}
      {/* cleared line flash */}
      <rect x="16" y="55" width="128" height="20" rx="3" fill={GB} opacity=".12" />
      <text x="80" y="100" textAnchor="middle" fill={DIM} fontSize="7" fontFamily="monospace">TAP GROUPS TO CLEAR</text>
    </svg>
  )
}

function SnakePath({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      <path d="M20,54 H80 V20 H130 V54 H100 V80 H50 V60"
        stroke={G} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="60" r="7" fill={GB} />
      <circle cx="50" cy="57" r="2" fill={BG} />
      {/* food */}
      <circle cx="110" cy="90" r="5" fill={C} opacity=".7" />
    </svg>
  )
}

function SpaceRaid({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* stars */}
      {[[20,10],[50,25],[100,8],[140,30],[30,50],[130,55],[80,40]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="1" fill={C} opacity=".4" />
      ))}
      {/* enemies */}
      {[[35,20],[80,20],[125,20],[57,38],[103,38]].map(([x,y],i)=>(
        <path key={i} d={`M${x},${y} l-10,12 l20,0 Z`} fill={'#C46B5A'} opacity=".8" />
      ))}
      {/* player */}
      <path d="M80,88 L68,100 L92,100 Z" fill={G} />
      <rect x="78" y="80" width="4" height="12" fill={G} />
      {/* bullet */}
      <rect x="79" y="56" width="2" height="18" rx="1" fill={GB} />
    </svg>
  )
}

function Breakwall({ className }: IllProps) {
  const bricks = Array.from({ length: 18 }, (_, i) => i)
  const colors = [G, C, '#7DB87A', '#6A9BC4', '#9B7EC4', '#C46B5A']
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {bricks.map(i => {
        const c = i % 6, r = Math.floor(i / 6)
        const broken = [2, 7, 8, 14].includes(i)
        return !broken ? (
          <rect key={i} x={10+c*24} y={10+r*14} width="20" height="11" rx="2"
            fill={colors[r]} opacity=".7" />
        ) : null
      })}
      {/* ball */}
      <circle cx="80" cy="72" r="5" fill={C} />
      {/* paddle */}
      <rect x="52" y="90" width="56" height="8" rx="4" fill={G} />
    </svg>
  )
}

function PacMaze({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* maze walls */}
      <rect x="10" y="10" width="140" height="88" rx="3" fill="none" stroke={DIM} strokeWidth="2" />
      <rect x="30" y="10" width="2" height="35" fill={DIM} /><rect x="70" y="10" width="2" height="25" fill={DIM} />
      <rect x="110" y="10" width="2" height="35" fill={DIM} /><rect x="30" y="63" width="2" height="35" fill={DIM} />
      <rect x="70" y="73" width="2" height="25" fill={DIM} /><rect x="110" y="63" width="2" height="35" fill={DIM} />
      <rect x="30" y="46" width="40" height="2" fill={DIM} /><rect x="90" y="46" width="40" height="2" fill={DIM} />
      {/* dots */}
      {[[50,30],[90,30],[130,30],[50,55],[90,55],[130,55],[50,80]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2.5" fill={C} opacity=".6" />
      ))}
      {/* pac */}
      <path d="M115,77 L140,66 A16,16 0 1,0 140,88 Z" fill={G} />
    </svg>
  )
}

function AsteroidField({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* asteroids */}
      <polygon points="30,20 45,15 55,25 50,38 35,40 22,32" fill={S} stroke={DIM} strokeWidth="1.5" />
      <polygon points="110,15 122,10 132,18 130,32 115,35 105,25" fill={S} stroke={DIM} strokeWidth="1.5" />
      <polygon points="60,60 72,55 80,65 75,76 62,78 53,70" fill={S} stroke={C} strokeWidth="1" opacity=".6" />
      {/* ship */}
      <polygon points="80,85 72,100 88,100" fill="none" stroke={G} strokeWidth="2" />
      <circle cx="80" cy="85" r="3" fill={G} />
      {/* thrust */}
      <path d="M76,100 L80,110 L84,100" fill={GB} opacity=".5" />
    </svg>
  )
}

function FrogCross({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* road lanes */}
      {[0,1,2].map(i => (
        <rect key={i} x="0" y={20+i*22} width="160" height="18" fill={i%2===0?S:'#1a1710'} />
      ))}
      {/* cars */}
      <rect x="10" y="23" width="36" height="14" rx="3" fill={'#C46B5A'} opacity=".8" />
      <rect x="90" y="45" width="36" height="14" rx="3" fill={G} opacity=".8" />
      <rect x="30" y="23" width="0" height="0" />
      {/* logs in water */}
      <rect x="0" y="84" width="160" height="18" fill="#1A2535" opacity=".8" />
      <rect x="15" y="87" width="50" height="12" rx="5" fill="#4A3520" />
      <rect x="95" y="87" width="50" height="12" rx="5" fill="#4A3520" />
      {/* frog */}
      <circle cx="80" cy="78" r="7" fill={'#7DB87A'} />
      <circle cx="77" cy="75" r="2" fill={BG} /><circle cx="83" cy="75" r="2" fill={BG} />
    </svg>
  )
}

function PongDuel({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      <line x1="80" y1="0" x2="80" y2="108" stroke={DIM} strokeWidth="1" strokeDasharray="6,5" />
      <rect x="12" y="34" width="8" height="40" rx="3" fill={G} />
      <rect x="140" y="24" width="8" height="40" rx="3" fill={C} opacity=".7" />
      <circle cx="82" cy="52" r="7" fill={C} />
      <text x="48" y="20" textAnchor="middle" fill={G} fontSize="14" fontWeight="bold" fontFamily="monospace">3</text>
      <text x="112" y="20" textAnchor="middle" fill={C} fontSize="14" fontWeight="bold" fontFamily="monospace">2</text>
    </svg>
  )
}

// ── ACTION ─────────────────────────────────────────────────────────────────
function HexRunner({ className }: IllProps) {
  const obstacles = [[90,70,18,30],[115,70,18,42],[140,70,18,24]]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* ground */}
      <rect x="0" y="88" width="160" height="20" fill={S} />
      <rect x="0" y="86" width="160" height="3" fill={G} opacity=".4" />
      {/* speed lines */}
      {[18,28,38,48,58].map((y,i)=>(
        <line key={i} x1="0" y1={y} x2={30+i*8} y2={y} stroke={DIM} strokeWidth="0.8" opacity=".4" />
      ))}
      {/* obstacles */}
      {obstacles.map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h} rx="2"
          fill={[G,'#9B7EC4','#6A9BC4'][i]} opacity=".7" />
      ))}
      {/* player */}
      <rect x="30" y="60" width="22" height="28" rx="3" fill={G} />
      <circle cx="41" cy="56" r="8" fill={C} />
    </svg>
  )
}

function QuickTapIll({ className }: IllProps) {
  const targets = [[38,28,20,'#D4A843'],[110,42,16,'#6A9BC4'],[68,70,24,'#7DB87A'],[130,80,14,'#9B7EC4']]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {targets.map(([x,y,r,col],i)=>(
        <g key={i}>
          <circle cx={x as number} cy={y as number} r={(r as number)+4} fill={col as string} opacity=".12" />
          <circle cx={x as number} cy={y as number} r={r as number} fill={col as string} opacity=".8" />
          <HexPath cx={x as number} cy={y as number} r={8} fill="none" stroke={BG} />
        </g>
      ))}
      {/* tap ripple */}
      <circle cx="38" cy="28" r="28" fill="none" stroke={G} strokeWidth="1.5" opacity=".3" />
      <circle cx="38" cy="28" r="38" fill="none" stroke={G} strokeWidth="0.8" opacity=".15" />
    </svg>
  )
}

function GravitySwitch({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* spikes top */}
      {Array.from({length:8},(_,i)=>(
        <polygon key={i} points={`${10+i*20},0 ${18+i*20},14 ${2+i*20},14`} fill={'#C46B5A'} opacity=".7" />
      ))}
      {/* spikes bottom */}
      {Array.from({length:8},(_,i)=>(
        <polygon key={i} points={`${10+i*20},108 ${18+i*20},94 ${2+i*20},94`} fill={'#C46B5A'} opacity=".7" />
      ))}
      {/* corridor blocks */}
      {[[0,24],[40,28],[80,20],[120,26]].map(([x,h],i)=>(
        <rect key={i} x={x} y={16} width="28" height={h} rx="2" fill={S} />
      ))}
      {/* player */}
      <rect x="72" y="48" width="16" height="16" rx="3" fill={G} />
      <polygon points="72,52 64,56 72,60" fill={GB} opacity=".6" />
    </svg>
  )
}

function NeonBlade({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* objects */}
      <circle cx="50" cy="45" r="18" fill={S} stroke={G} strokeWidth="1.5" opacity=".8" />
      <rect x="95" cy="30" x1="95" y="30" width="28" height="28" rx="3"
        fill={S} stroke={'#9B7EC4'} strokeWidth="1.5" />
      <polygon points="120,72 135,58 148,78" fill={S} stroke={'#6A9BC4'} strokeWidth="1.5" />
      {/* slash */}
      <path d="M15,90 Q80,20 145,75" stroke={GB} strokeWidth="2.5" fill="none"
        strokeLinecap="round" opacity=".9" />
      <path d="M15,90 Q80,20 145,75" stroke={C} strokeWidth="1" fill="none"
        strokeLinecap="round" opacity=".3" />
    </svg>
  )
}

function DodgeStorm({ className }: IllProps) {
  const bullets = [[30,20],[80,10],[120,35],[55,50],[140,15],[20,70],[100,60]]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {bullets.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="4" fill={'#C46B5A'} opacity=".8" />
      ))}
      {bullets.map(([x,y],i)=>(
        <line key={`t${i}`} x1={x} y1={y} x2={x-12} y2={y+4} stroke={'#C46B5A'} strokeWidth="1.5" opacity=".4" />
      ))}
      <HexPath cx={80} cy={80} r={14} fill={G} />
      <HexPath cx={80} cy={80} r={10} fill={GB} />
    </svg>
  )
}

function TowerStack({ className }: IllProps) {
  const layers = [
    { w: 80, col: G },{ w: 70, col: C },{ w: 65, col: GB },
    { w: 55, col: G },{ w: 42, col: C },
  ]
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {layers.map(({w,col},i)=>(
        <rect key={i} x={(160-w)/2} y={78-i*14} width={w} height="12" rx="2" fill={col} opacity={.5+i*.1} />
      ))}
      {/* moving block */}
      <rect x="20" y="22" width="50" height="12" rx="2" fill={GB} opacity=".9" />
      <line x1="20" y1="28" x2="130" y2="28" stroke={G} strokeWidth="0.5" strokeDasharray="4,3" />
    </svg>
  )
}

// ── PUZZLE ─────────────────────────────────────────────────────────────────
function MemoryRush({ className }: IllProps) {
  const cards = Array.from({length:12},(_,i) => ({
    flipped: [1,4,7,10].includes(i),
    emoji: i%2===0?'hex':'star',
    color: i%4<2?G:C,
  }))
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {cards.map((card,i)=>{
        const col=i%4, row=Math.floor(i/4)
        return (
          <g key={i}>
            <rect x={8+col*36} y={8+row*30} width="30" height="24" rx="4"
              fill={card.flipped?'#201C15':S} stroke={card.flipped?G:DIM} strokeWidth={card.flipped?1.5:0.8} />
            {card.flipped && (
              <HexPath cx={23+col*36} cy={20+row*30} r={7} fill={card.color} />
            )}
          </g>
        )
      })}
      {/* timer bar */}
      <rect x="20" y="98" width="120" height="6" rx="3" fill={S} />
      <rect x="20" y="98" width="75" height="6" rx="3" fill={G} />
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
      <rect width="160" height="108" fill={BG} />
      {/* grid */}
      {Array.from({length:25},(_,i)=>{
        const col=i%5,row=Math.floor(i/5)
        return <rect key={i} x={16+col*28} y={12+row*18} width="22" height="14" rx="2" fill={S} opacity=".6" />
      })}
      {/* paths */}
      <polyline points="27,19 27,37 55,37 55,55 83,55" stroke={G} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="111,19 111,37 139,37 139,55 139,73" stroke={'#6A9BC4'} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* endpoints */}
      {[[27,19,G],[83,55,G],[111,19,'#6A9BC4'],[139,73,'#6A9BC4']].map(([x,y,c],i)=>(
        <circle key={i} cx={x as number} cy={y as number} r="5" fill={c as string} />
      ))}
    </svg>
  )
}

function ShiftBlocks({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* target */}
      <rect x="54" y="36" width="52" height="36" rx="3" fill="none" stroke={G} strokeWidth="1" strokeDasharray="4,3" />
      {/* blocks */}
      <rect x="12" y="44" width="30" height="30" rx="3" fill={'#9B7EC4'} opacity=".8" />
      <rect x="60" y="44" width="30" height="30" rx="3" fill={G} opacity=".8" />
      <rect x="110" y="12" width="30" height="30" rx="3" fill={'#6A9BC4'} opacity=".8" />
      {/* arrows */}
      <path d="M46,59 L56,59 M52,54 L58,59 L52,64" stroke={C} strokeWidth="1.5" fill="none" />
      <path d="M114,46 L114,56 M109,52 L114,58 L119,52" stroke={C} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function HexFlow({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* pipe segments */}
      {[
        {x:30,y:30,type:'corner'},{x:65,y:30,type:'h'},{x:100,y:30,type:'corner2'},
        {x:30,y:58,type:'v'},{x:100,y:58,type:'v'},
        {x:30,y:86,type:'corner3'},{x:65,y:86,type:'h2'},{x:100,y:86,type:'end'},
      ].map((seg,i)=>(
        <rect key={i} x={seg.x-12} y={seg.y-12} width="24" height="24" rx="4"
          fill={'#201C15'} stroke={i<5?G:DIM} strokeWidth={i<5?1.5:1} />
      ))}
      {/* flow */}
      <path d="M30,30 H100 V86 H65" stroke={G} strokeWidth="4" fill="none"
        strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
      {/* source */}
      <circle cx="30" cy="30" r="8" fill={G} />
      <circle cx="65" cy="86" r="8" fill={C} opacity=".7" />
    </svg>
  )
}

function LightBounce({ className }: IllProps) {
  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill={BG} />
      {/* beam */}
      <path d="M20,20 L80,80 L140,30" stroke={GB} strokeWidth="2" fill="none" opacity=".8" />
      <path d="M20,20 L80,80 L140,30" stroke={C} strokeWidth="1" fill="none" opacity=".3" />
      {/* mirrors */}
      <line x1="70" y1="90" x2="90" y2="70" stroke={C} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <line x1="125" y1="20" x2="145" y2="40" stroke={C} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      {/* crystals */}
      <polygon points="20,12 26,20 14,20" fill={GB} opacity=".9" />
      <polygon points="140,22 146,30 134,30" fill={G} opacity=".9" />
      <circle cx="80" cy="80" r="5" fill={C} opacity=".6" />
    </svg>
  )
}

function LowPop({ className }: IllProps) {
  const R = 20
  const hexPts = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6
      return `${(cx + (R - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (R - 1.5) * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  const hexes = [
    { cx: 38,  cy: 30,  color: '#FFB3C6', num: '-7'  },
    { cx: 122, cy: 26,  color: '#B3DCFF', num: '23'  },
    { cx: 24,  cy: 76,  color: '#D4B3FF', num: '4'   },
    { cx: 118, cy: 76,  color: '#B3F0D4', num: '-15' },
    { cx: 72,  cy: 56,  color: '#FFD4B3', num: '61'  },
  ]

  return (
    <svg viewBox="0 0 160 108" className={className}>
      <rect width="160" height="108" fill="#FFF8E7" />
      {hexes.map((h, i) => (
        <g key={i}>
          <polygon points={hexPts(h.cx, h.cy)} fill={h.color}
            filter="drop-shadow(0 2px 5px rgba(0,0,0,0.10))" />
          <text x={h.cx} y={h.cy + 4} textAnchor="middle"
            fontSize={h.num.length > 3 ? '8' : '10'} fontWeight="900"
            fill="#222" fontFamily="system-ui,sans-serif">{h.num}</text>
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

// ── registry ────────────────────────────────────────────────────────────────
const ILLUSTRATIONS: Record<string, React.ComponentType<IllProps>> = {
  'memory-matrix':  MemoryMatrix,
  'dual-n-back':    DualNBack,
  'color-stroop':   ColorStroop,
  'number-flow':    NumberFlow,
  'pattern-sync':   PatternSync,
  'focus-grid':     FocusGrid,
  'speed-sort':     SpeedSort,
  'word-flux':      WordFlux,
  nimtris:          Nimtris,
  hexfall:          HexFallIll,
  'snake-path':     SnakePath,
  'space-raid':     SpaceRaid,
  breakwall:        Breakwall,
  'pac-maze':       PacMaze,
  'asteroid-field': AsteroidField,
  'frog-cross':     FrogCross,
  'pong-duel':      PongDuel,
  runner:           HexRunner,
  quicktap:         QuickTapIll,
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
