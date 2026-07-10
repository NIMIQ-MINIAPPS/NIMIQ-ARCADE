import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, Plus, Users, Loader2, Trophy, Copy, Check } from 'lucide-react'
import { DecorHex } from '../components/ui/Hex'
import { useGameStore } from '../store/useGameStore'
import { GAMES } from '../lib/games'
import { getCurrentPlayerId } from '../lib/backend'
import {
  roomsAvailable, createRoom, joinRoomByCode, listOpenRooms, quickMatch,
  fetchRoomPlayers, fetchRoom, startRoom, subscribeRoom,
  type OpenRoom, type RoomPlayerWithProfile, type RoomRow,
} from '../lib/rooms'

type Mode = 'quick' | 'create' | 'join'

const AVAILABLE_GAMES = GAMES.filter(g => g.available)

const sel: React.CSSProperties = {
  background: 'var(--y4)', border: '1px solid var(--y2)',
  color: 'var(--nim-dark)', borderRadius: 10,
  padding: '8px 12px', width: '100%', fontSize: 13, outline: 'none',
}

function gameName(gameId: string) {
  return GAMES.find(g => g.id === gameId)?.name ?? gameId
}

// ── Room lobby / play / results — shown once the player has joined a room ──
function RoomView({ room, myId, onLeave }: { room: RoomRow; myId: string; onLeave: () => void }) {
  const [current, setCurrent] = useState<RoomRow>(room)
  const [players, setPlayers] = useState<RoomPlayerWithProfile[]>([])
  const [copied, setCopied] = useState(false)
  const { activeRoom, setActiveRoom, setActiveTab } = useGameStore()

  const refresh = useCallback(async () => {
    const [r, p] = await Promise.all([fetchRoom(room.id), fetchRoomPlayers(room.id)])
    if (r) setCurrent(r)
    setPlayers(p)
  }, [room.id])

  useEffect(() => {
    refresh()
    const unsubscribe = subscribeRoom(room.id, refresh)
    // Realtime needs `rooms`/`room_players` added to the supabase_realtime
    // publication (Database → Replication in the dashboard, or
    // `alter publication supabase_realtime add table rooms, room_players;`
    // in the SQL Editor) — until/unless that's done, this poll is what
    // actually keeps the lobby in sync, so it isn't optional.
    const poll = setInterval(refresh, 3000)
    return () => { unsubscribe(); clearInterval(poll) }
  }, [room.id, refresh])

  const isHost = current.host_id === myId
  const me = players.find(p => p.player_id === myId)
  const iHavePlayed = !!me?.finished_at
  const allFinished = players.length > 0 && players.every(p => p.finished_at)
  const waitingToPlay = current.status === 'playing' && !iHavePlayed && activeRoom?.roomId !== room.id

  const goPlay = () => {
    setActiveRoom({ roomId: room.id, gameId: current.game_id, code: current.code })
    setActiveTab('games')
  }

  const ranked = [...players].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
        <p className="text-[10px] tracking-widest font-semibold mb-1" style={{ color: 'var(--nim-muted)' }}>ROOM CODE</p>
        <div className="flex items-center justify-center gap-2">
          <p className="text-2xl font-black tracking-[0.3em]" style={{ color: 'var(--gold-dark)' }}>{current.code}</p>
          <button onClick={() => { navigator.clipboard?.writeText(current.code); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
            {copied ? <Check size={16} style={{ color: 'var(--green)' }} /> : <Copy size={16} style={{ color: 'var(--nim-muted)' }} />}
          </button>
        </div>
        <p className="text-[12px] mt-1 font-bold" style={{ color: 'var(--nim-dark)' }}>{gameName(current.game_id)}</p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
        <p className="text-[10px] tracking-widest font-bold px-4 pt-3 pb-2" style={{ color: 'var(--nim-muted)' }}>
          PLAYERS ({players.length}/{current.max_players})
        </p>
        {ranked.map((p, i) => (
          <div key={p.player_id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: '1px solid var(--y2)' }}>
            {current.status === 'finished' && <span className="text-sm font-black w-4" style={{ color: i === 0 ? '#C49210' : 'var(--nim-muted)' }}>{i + 1}</span>}
            <span className="text-lg">{p.avatar}</span>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--nim-dark)' }}>
                {p.displayName}{p.player_id === myId && <span className="text-[10px] ml-1" style={{ color: 'var(--nim-muted)' }}>(you)</span>}
                {p.player_id === current.host_id && <span className="text-[9px] ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--gold-bg)', color: 'var(--gold-dark)' }}>HOST</span>}
              </p>
            </div>
            {p.score != null ? (
              <span className="text-sm font-black" style={{ color: 'var(--gold-dark)' }}>{p.score.toLocaleString()}</span>
            ) : current.status === 'playing' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--nim-muted)' }} />
            ) : (
              <span className="text-[10px]" style={{ color: 'var(--nim-muted)' }}>waiting</span>
            )}
          </div>
        ))}
      </div>

      {current.status === 'waiting' && isHost && (
        <button onClick={() => startRoom(room.id)} disabled={players.length < 1}
          className="w-full py-3 font-black rounded-xl glow-gold-sm" style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>
          START MATCH
        </button>
      )}
      {current.status === 'waiting' && !isHost && (
        <p className="text-center text-[12px]" style={{ color: 'var(--nim-muted)' }}>Waiting for host to start…</p>
      )}
      {waitingToPlay && (
        <button onClick={goPlay} className="w-full py-3 font-black rounded-xl glow-gold-sm" style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>
          GO PLAY {gameName(current.game_id).toUpperCase()}
        </button>
      )}
      {current.status === 'playing' && activeRoom?.roomId === room.id && (
        <p className="text-center text-[12px] font-bold" style={{ color: 'var(--gold-dark)' }}>Playing… go finish your run, then come back here.</p>
      )}
      {current.status === 'playing' && iHavePlayed && !allFinished && (
        <p className="text-center text-[12px]" style={{ color: 'var(--nim-muted)' }}>Score submitted — waiting for the rest of the room…</p>
      )}
      {(current.status === 'finished' || allFinished) && (
        <div className="rounded-xl p-3 flex items-center gap-2 justify-center" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold)' }}>
          <Trophy size={16} style={{ color: 'var(--gold-dark)' }} />
          <p className="text-[12px] font-bold" style={{ color: 'var(--nim-dark)' }}>
            {ranked[0]?.player_id === myId ? "You won this room!" : `${ranked[0]?.displayName ?? '—'} won this room.`}
          </p>
        </div>
      )}

      <button onClick={onLeave} className="w-full py-2.5 text-xs font-bold" style={{ color: 'var(--nim-muted)' }}>
        ← BACK TO LOBBIES
      </button>
    </motion.div>
  )
}

export default function OnlinePage() {
  const { currentRoomId, setCurrentRoomId } = useGameStore()
  const [mode, setMode] = useState<Mode>('quick')
  const [searching, setSearching] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomRow | null>(null)
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([])
  const [joinCode, setJoinCode] = useState('')
  const [createGameId, setCreateGameId] = useState(AVAILABLE_GAMES[0]?.id ?? '')
  const [createMax, setCreateMax] = useState(4)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getCurrentPlayerId().then(setMyId) }, [])
  useEffect(() => {
    if (mode === 'join' && !room) listOpenRooms().then(setOpenRooms)
  }, [mode, room])

  // Coming back to the Online tab after playing a room's game lands here —
  // reattach to whatever room we were last in instead of resetting to Quick/Create/Join.
  useEffect(() => {
    if (currentRoomId && !room) fetchRoom(currentRoomId).then(r => { if (r) setRoom(r) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId])

  const requireId = async () => myId ?? (await getCurrentPlayerId())

  const enterRoom = (r: RoomRow) => { setRoom(r); setCurrentRoomId(r.id) }
  const leaveRoom = () => { setRoom(null); setCurrentRoomId(null) }

  const handleQuickMatch = async () => {
    const id = await requireId()
    if (!id) { setError('Not signed in yet — try again in a moment.'); return }
    setSearching(true)
    const gameId = AVAILABLE_GAMES[Math.floor(Math.random() * AVAILABLE_GAMES.length)]?.id
    const r = await quickMatch(gameId, id)
    setSearching(false)
    if (r) enterRoom(r); else setError('Could not find or create a match.')
  }

  const handleCreate = async () => {
    const id = await requireId()
    if (!id || !createGameId) return
    const r = await createRoom(createGameId, createMax, id)
    if (r) enterRoom(r); else setError('Could not create the room.')
  }

  const handleJoin = async (code: string) => {
    const id = await requireId()
    if (!id || !code) return
    const r = await joinRoomByCode(code, id)
    if (r) enterRoom(r); else setError('Room not found or already full/started.')
  }

  if (!roomsAvailable) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 px-6 text-center">
        <Wifi size={28} style={{ color: 'var(--nim-muted)' }} />
        <p className="font-bold" style={{ color: 'var(--nim-dark)' }}>Online is offline</p>
        <p className="text-[12px]" style={{ color: 'var(--nim-muted)' }}>Backend isn't configured for this build.</p>
      </div>
    )
  }

  if (room && myId) {
    return (
      <div className="flex flex-col gap-4 pb-2 px-4 pt-5">
        <RoomView room={room} myId={myId} onLeave={leaveRoom} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{ background: 'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)' }}>
        <DecorHex size={70} x={350} y={-10} opacity={0.14} stroke="var(--gold)" strokeWidth={1.2} />
        <div className="relative flex items-center gap-2">
          <Wifi size={16} style={{ color: 'var(--gold-dark)' }} />
          <h2 className="text-xl font-black" style={{ color: 'var(--nim-dark)' }}>ONLINE</h2>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--nim-muted)' }}>
          Same game, same time — highest score wins the room
        </p>
      </div>

      <div className="px-4 space-y-4">
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--y3)', border: '1px solid var(--y2)' }}>
          {(['quick', 'create', 'join'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null) }}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
              style={mode === m ? { background: 'var(--nim-dark)', color: 'var(--gold)' } : { color: 'var(--nim-muted)' }}>
              {m === 'quick' ? 'Quick' : m === 'create' ? 'Create' : 'Join'}
            </button>
          ))}
        </div>

        {error && <p className="text-[11px] text-center" style={{ color: 'var(--red,#E74C3C)' }}>{error}</p>}

        <AnimatePresence mode="wait">
          {mode === 'quick' && (
            <motion.div key="quick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-6 text-center" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
              <div className="hex-clip w-14 h-14 mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--gold)' }}>
                <Wifi size={22} style={{ color: 'var(--nim-dark)' }} />
              </div>
              <p className="font-black mb-1" style={{ color: 'var(--nim-dark)' }}>Quick Match</p>
              <p className="text-[12px] mb-4" style={{ color: 'var(--nim-muted)' }}>Join an open room or start one instantly</p>
              {searching ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }}
                        animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }} />
                    ))}
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: 'var(--gold-dark)' }}>Searching…</p>
                </div>
              ) : (
                <button onClick={handleQuickMatch} className="w-full py-3 font-black rounded-xl glow-gold-sm"
                  style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>
                  FIND MATCH
                </button>
              )}
            </motion.div>
          )}

          {mode === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
              <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--nim-dark)' }}>
                <Plus size={14} style={{ color: 'var(--gold-dark)' }} /> Create Room
              </h3>
              <div>
                <label className="text-[10px] tracking-widest font-semibold block mb-1" style={{ color: 'var(--nim-muted)' }}>GAME</label>
                <select style={sel} value={createGameId} onChange={e => setCreateGameId(e.target.value)}>
                  {AVAILABLE_GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest font-semibold block mb-1" style={{ color: 'var(--nim-muted)' }}>MAX PLAYERS</label>
                <select style={sel} value={createMax} onChange={e => setCreateMax(Number(e.target.value))}>
                  {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={handleCreate} className="w-full py-3 font-black rounded-xl" style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>
                CREATE ROOM
              </button>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
                <input placeholder="Room code…" value={joinCode} maxLength={6}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-transparent text-sm outline-none tracking-widest font-bold" style={{ color: 'var(--nim-dark)' }} />
                <button onClick={() => handleJoin(joinCode)} className="font-black px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>JOIN</button>
              </div>

              <p className="text-[10px] tracking-widest font-bold" style={{ color: 'var(--nim-muted)' }}>OPEN ROOMS</p>

              {openRooms.length === 0 ? (
                <p className="text-center text-xs py-8" style={{ color: 'var(--nim-muted)' }}>No open rooms right now — create one!</p>
              ) : openRooms.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-4 flex items-center justify-between" style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
                  <div>
                    <p className="font-black text-sm" style={{ color: 'var(--nim-dark)' }}>{gameName(r.game_id)}</p>
                    <span className="flex items-center gap-1 text-[11px] mt-1" style={{ color: 'var(--nim-muted)' }}>
                      <Users size={10} /> {r.playerCount}/{r.max_players} · code {r.code}
                    </span>
                  </div>
                  <button onClick={() => handleJoin(r.code)} className="text-xs font-black px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>JOIN</button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
