// Internal metrics dashboard — NOT part of the normal tab navigation. Reached
// by opening the app with #admin in the URL (see App.tsx). Built to be
// screenshotted/screen-shared when pitching "Nimiq Arcade brings new users to
// Nimiq and moves real volume" — every number here is a live read from
// Supabase via the admin-gated RPCs in supabase/012_admin_metrics.sql.
//
// Access control is enforced server-side (the RPCs check admin_players), not
// here — this page just renders whatever they return, including the
// "unauthorized" case for a signed-in player who isn't an admin.

import { useEffect, useState, useMemo, useRef, useId } from 'react'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, Wallet, Activity, Gamepad2, Trophy, Coins, Clock,
  RefreshCw, Lock, AlertTriangle, Loader2, TrendingUp,
} from 'lucide-react'
import { ensureSession } from '../lib/backend'
import {
  adminMetricsAvailable, fetchAdminOverview, fetchAdminTopGames, fetchAdminGrowth, fetchAdminVolumeGrowth,
  type AdminOverview, type AdminTopGame, type AdminGrowthPoint, type AdminVolumePoint,
} from '../lib/adminMetrics'
import { GAMES } from '../lib/games'

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString()
}

function fmtNim(n: number): string {
  if (n === 0) return '0'
  return n.toFixed(n < 1 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '')
}

function gameName(id: string): string {
  return GAMES.find(g => g.id === id)?.name ?? id
}

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3.5" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--nim-muted)' }}>{label}</span>
      </div>
      <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--nim-muted)' }}>{sub}</p>}
    </motion.div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] tracking-widest font-bold mb-2" style={{ color: 'var(--nim-muted)' }}>{children}</p>
}

// ── Line chart (single series, hover crosshair) ──────────────────────────
function LineChart({
  data, color, formatValue, height = 140,
}: {
  data: { day: string; value: number }[]
  color: string
  formatValue: (n: number) => string
  height?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const width = 600
  const padX = 8
  const padTop = 10
  const padBottom = 20

  const max = Math.max(1, ...data.map(d => d.value))
  const plotW = width - padX * 2
  const plotH = height - padTop - padBottom

  const points = useMemo(() => data.map((d, i) => {
    const x = padX + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW)
    const y = padTop + plotH - (d.value / max) * plotH
    return { x, y, ...d }
  }), [data, max, plotW, plotH])

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0]?.x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`

  const gradId = `grad-${useId()}`

  const handleMove = (clientX: number) => {
    const svg = svgRef.current
    if (!svg || points.length === 0) return
    const rect = svg.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * width
    let nearest = 0
    let best = Infinity
    points.forEach((p, i) => { const d = Math.abs(p.x - relX); if (d < best) { best = d; nearest = i } })
    setHoverIdx(nearest)
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1]

  return (
    <div className="relative">
      {hovered && (
        <div className="absolute top-0 right-0 text-right pointer-events-none">
          <p className="text-lg font-black leading-none" style={{ color }}>{formatValue(hovered.value)}</p>
          <p className="text-[10px]" style={{ color: 'var(--nim-muted)' }}>{fmtDay(hovered.day)}</p>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        style={{ height }}
        onMouseMove={e => handleMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={e => { if (e.touches[0]) handleMove(e.touches[0].clientX) }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* recessive gridlines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={padX} x2={width - padX} y1={padTop + plotH * f} y2={padTop + plotH * f}
            stroke="var(--y2)" strokeWidth="1" />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hovered && (
          <>
            <line x1={hovered.x} x2={hovered.x} y1={padTop} y2={padTop + plotH} stroke={color} strokeWidth="1" strokeOpacity="0.35" />
            <circle cx={hovered.x} cy={hovered.y} r="4" fill={color} stroke="var(--y4)" strokeWidth="2" />
          </>
        )}
        {points.length > 1 && (
          <>
            <text x={points[0].x} y={height - 4} fontSize="9" fill="var(--nim-muted)">{fmtDay(points[0].day)}</text>
            <text x={points[points.length - 1].x} y={height - 4} fontSize="9" fill="var(--nim-muted)" textAnchor="end">{fmtDay(points[points.length - 1].day)}</text>
          </>
        )}
      </svg>
    </div>
  )
}

// ── Horizontal bar list (single series — top games) ───────────────────────
function TopGamesBars({ games }: { games: AdminTopGame[] }) {
  const max = Math.max(1, ...games.map(g => g.uniquePlayers))
  return (
    <div className="space-y-2.5">
      {games.map((g, i) => (
        <div key={g.gameId}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold truncate" style={{ color: 'var(--nim-dark)' }}>
              <span style={{ color: 'var(--nim-muted)' }}>#{i + 1}</span> {gameName(g.gameId)}
            </span>
            <span className="text-xs font-black shrink-0 ml-2" style={{ color: 'var(--gold-dark)' }}>{fmtInt(g.uniquePlayers)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--y3)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--gold-dark), var(--gold))' }}
              initial={{ width: 0 }}
              animate={{ width: `${(g.uniquePlayers / max) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      ))}
      {games.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--nim-muted)' }}>Aún no hay partidas registradas.</p>}
    </div>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }
  | { status: 'ready'; overview: AdminOverview; topGames: AdminTopGame[]; growth: AdminGrowthPoint[]; volume: AdminVolumePoint[] }

export default function AdminMetricsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const load = async () => {
    setState({ status: 'loading' })
    if (!adminMetricsAvailable) { setState({ status: 'error', message: 'Backend no configurado (VITE_SUPABASE_URL/ANON_KEY).' }); return }
    await ensureSession()

    const [ov, tg, gr, vg] = await Promise.all([
      fetchAdminOverview(), fetchAdminTopGames(8), fetchAdminGrowth(30), fetchAdminVolumeGrowth(30),
    ])

    if (!ov.ok) { setState(ov.unauthorized ? { status: 'unauthorized' } : { status: 'error', message: ov.error }); return }
    if (!tg.ok || !gr.ok || !vg.ok) { setState({ status: 'error', message: 'No se pudieron cargar todas las métricas.' }); return }

    setState({ status: 'ready', overview: ov.data, topGames: tg.data, growth: gr.data, volume: vg.data })
    setGeneratedAt(new Date())
  }

  useEffect(() => { load() }, [])

  return (
    <div className="admin-metrics-page min-h-dvh px-4 py-6" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--nim-dark)' }}>Nimiq Arcade — Métricas</h1>
            <p className="text-[11px]" style={{ color: 'var(--nim-muted)' }}>
              {generatedAt ? `Snapshot generado ${generatedAt.toLocaleString('es')}` : 'Cargando snapshot…'}
            </p>
          </div>
          <button onClick={load} disabled={state.status === 'loading'}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
            style={{ background: 'var(--gold-bg)', border: '1.5px solid var(--gold)', color: 'var(--gold-dark)' }}>
            <RefreshCw size={13} className={state.status === 'loading' ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {state.status === 'loading' && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--nim-muted)' }} />
          </div>
        )}

        {state.status === 'unauthorized' && (
          <div className="mt-6 rounded-xl p-6 text-center" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
            <Lock size={24} className="mx-auto mb-2" style={{ color: 'var(--nim-muted)' }} />
            <p className="font-bold text-sm mb-1" style={{ color: 'var(--nim-dark)' }}>Sin acceso de administrador</p>
            <p className="text-xs" style={{ color: 'var(--nim-muted)' }}>
              Tu cuenta no está en la lista de administradores. Agrégate desde el SQL Editor de Supabase —
              ver instrucciones en supabase/012_admin_metrics.sql.
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="mt-6 rounded-xl p-6 text-center" style={{ background: 'var(--y4)', border: '1px solid var(--red)' }}>
            <AlertTriangle size={22} className="mx-auto mb-2" style={{ color: 'var(--red)' }} />
            <p className="font-bold text-sm" style={{ color: 'var(--nim-dark)' }}>{state.message}</p>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="mt-5 space-y-6">
            {/* ── Crecimiento ── */}
            <section>
              <SectionLabel>CRECIMIENTO DE USUARIOS</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCard icon={<Users size={14} />} label="Total jugadores" value={fmtInt(state.overview.totalPlayers)} color="var(--nim-dark)" />
                <KpiCard icon={<UserPlus size={14} />} label="Nuevos hoy" value={fmtInt(state.overview.newPlayersToday)} color="var(--green)" />
                <KpiCard icon={<UserPlus size={14} />} label="Nuevos 7 días" value={fmtInt(state.overview.newPlayers7d)} color="var(--green)" />
                <KpiCard icon={<UserPlus size={14} />} label="Nuevos 30 días" value={fmtInt(state.overview.newPlayers30d)} color="var(--green)" />
              </div>
            </section>

            {/* ── Engagement ── */}
            <section>
              <SectionLabel>USUARIOS ACTIVOS Y FRECUENTES</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCard icon={<Activity size={14} />} label="Activos hoy" value={fmtInt(state.overview.activeToday)} color="var(--blue)" />
                <KpiCard icon={<Clock size={14} />} label="Activos 7 días" value={fmtInt(state.overview.active7d)} color="var(--blue)" />
                <KpiCard icon={<Clock size={14} />} label="Activos 30 días" value={fmtInt(state.overview.active30d)} color="var(--blue)" />
                <KpiCard icon={<Wallet size={14} />} label="Con wallet conectada" value={fmtInt(state.overview.playersWithWallet)} color="var(--purple)"
                  sub={`${state.overview.totalPlayers > 0 ? Math.round((state.overview.playersWithWallet / state.overview.totalPlayers) * 100) : 0}% del total`} />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--nim-muted)' }}>
                "Activos" refleja el último día de actividad registrado por jugador (no hay log histórico de sesiones), por lo que es una foto del momento, no una tendencia día a día.
              </p>
            </section>

            {/* ── Volumen ── */}
            <section>
              <SectionLabel>VOLUMEN EN NIM</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <KpiCard icon={<Coins size={14} />} label="NIM pagado a jugadores" value={fmtNim(state.overview.nimPaidOut)} color="var(--gold-dark)" sub="Payouts confirmados" />
                <KpiCard icon={<Coins size={14} />} label="NIM pendiente" value={fmtNim(state.overview.nimPayoutsPending)} color="var(--nim-mid)" sub="En proceso" />
                <KpiCard icon={<TrendingUp size={14} />} label="Cuotas de entrada (est.)" value={fmtNim(state.overview.nimEntryFeesEst)} color="var(--nim-dark)" sub="Rooms + torneos" />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--nim-muted)' }}>
                Las cuotas de entrada se pagan on-chain directo a la wallet de la casa y no quedan registradas con hash de transacción aquí — esta cifra es un estimado (cuota × participantes), no un total verificado on-chain.
              </p>
            </section>

            {/* ── Charts ── */}
            <section>
              <SectionLabel>NUEVOS JUGADORES — ÚLTIMOS 30 DÍAS</SectionLabel>
              <div className="rounded-xl p-3 pt-8" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
                <LineChart data={state.growth.map(p => ({ day: p.day, value: p.newPlayers }))} color="var(--green)" formatValue={fmtInt} />
              </div>
            </section>

            <section>
              <SectionLabel>NIM PAGADO A JUGADORES — ÚLTIMOS 30 DÍAS</SectionLabel>
              <div className="rounded-xl p-3 pt-8" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
                <LineChart data={state.volume.map(p => ({ day: p.day, value: p.nimPaidOut }))} color="var(--gold-dark)" formatValue={fmtNim} />
              </div>
            </section>

            {/* ── Top games ── */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy size={12} style={{ color: 'var(--nim-muted)' }} />
                <SectionLabel>JUEGOS MÁS JUGADOS (por jugadores únicos)</SectionLabel>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
                <TopGamesBars games={state.topGames} />
              </div>
              <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--nim-muted)' }}>
                <Gamepad2 size={11} /> Basado en jugadores distintos con un puntaje registrado por juego (no hay log de cada partida individual).
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
