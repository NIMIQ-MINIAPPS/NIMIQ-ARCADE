import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Plus, Users, Coins } from 'lucide-react'

type Mode = 'quick' | 'create' | 'join'

const MOCK_ROOMS = [
  { id: 'abc123', game: 'Nimtris',    players: 3, maxPlayers: 4, entry: 0.001 },
  { id: 'def456', game: 'Hex Fall',   players: 7, maxPlayers: 8, entry: 0.002 },
  { id: 'ghi789', game: 'Quick Tap',  players: 1, maxPlayers: 2, entry: 0.005 },
]

const selectStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-2)',
  color: 'var(--cream)',
  borderRadius: 10,
  padding: '8px 12px',
  width: '100%',
  fontSize: 13,
  outline: 'none',
}

export default function OnlinePage() {
  const [mode, setMode] = useState<Mode>('quick')
  const [searching, setSearching] = useState(false)

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-2">
      <div className="flex items-center gap-2">
        <Wifi size={16} style={{ color: 'var(--gold)' }} />
        <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--cream)' }}>
          ONLINE
        </h2>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--surface)' }}>
        {(['quick', 'create', 'join'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={mode === m
              ? { background: 'var(--gold)', color: 'var(--bg)' }
              : { color: 'var(--cream-muted)' }
            }
          >
            {m === 'quick' ? 'Quick' : m === 'create' ? 'Create' : 'Join'}
          </button>
        ))}
      </div>

      {mode === 'quick' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-6 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'var(--gold-deep)', border: '1px solid var(--gold)' }}>
            <Wifi size={24} style={{ color: 'var(--gold)' }} />
          </div>
          <p className="font-black mb-1" style={{ color: 'var(--cream)' }}>Quick Match</p>
          <p className="text-[12px] mb-4" style={{ color: 'var(--cream-muted)' }}>
            Get matched instantly with online players
          </p>
          {searching ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--gold)' }}
                    animate={{ scale: [1,1.5,1] }}
                    transition={{ duration: 0.8, delay: i*0.2, repeat: Infinity }} />
                ))}
              </div>
              <p className="text-[12px] font-bold" style={{ color: 'var(--gold)' }}>
                Searching for players…
              </p>
              <button onClick={() => setSearching(false)}
                className="text-xs" style={{ color: 'var(--cream-muted)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setSearching(true)}
              className="w-full py-3 font-black rounded-xl"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
              FIND MATCH
            </button>
          )}
        </motion.div>
      )}

      {mode === 'create' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-4 space-y-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
          <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--cream)' }}>
            <Plus size={14} style={{ color: 'var(--gold)' }} />
            Create Private Room
          </h3>
          <div className="space-y-1">
            <label className="text-[10px] tracking-widest" style={{ color: 'var(--cream-muted)' }}>GAME</label>
            <select style={selectStyle}>
              {['Nimtris','Hex Fall','Quick Tap','Memory Rush','Hex Runner'].map(g => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest" style={{ color: 'var(--cream-muted)' }}>PLAYERS</label>
              <select style={selectStyle}>
                {[2,4,8].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest" style={{ color: 'var(--cream-muted)' }}>ENTRY (NIM)</label>
              <select style={selectStyle}>
                {[0.001,0.002,0.005,0.01].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <button className="w-full py-3 font-black rounded-xl text-sm"
            style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
            CREATE ROOM
          </button>
        </motion.div>
      )}

      {mode === 'join' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex gap-2 rounded-xl px-3 py-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
            <input placeholder="Enter room code…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--cream)' }} />
            <button className="font-black px-3 py-1 rounded-lg text-xs"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
              JOIN
            </button>
          </div>

          <p className="text-[10px] tracking-widest font-bold" style={{ color: 'var(--cream-muted)' }}>
            PUBLIC ROOMS
          </p>

          {MOCK_ROOMS.map((room, i) => (
            <motion.div key={room.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i*0.05 }}
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}>
              <div>
                <p className="font-black text-sm" style={{ color: 'var(--cream)' }}>{room.game}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--cream-muted)' }}>
                    <Users size={10} /> {room.players}/{room.maxPlayers}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--cream-muted)' }}>
                    <Coins size={10} /> {room.entry} NIM
                  </span>
                </div>
              </div>
              <button className="text-xs font-black px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
                JOIN
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
