import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Plus, Users, Coins } from 'lucide-react'
import { DecorHex } from '../components/ui/Hex'

type Mode = 'quick' | 'create' | 'join'

const ROOMS = [
  { id: 'abc123', game: 'Nimtris',   players: 3, maxPlayers: 4, entry: 0.001 },
  { id: 'def456', game: 'Hex Fall',  players: 7, maxPlayers: 8, entry: 0.002 },
  { id: 'ghi789', game: 'Quick Tap', players: 1, maxPlayers: 2, entry: 0.005 },
]

const sel: React.CSSProperties = {
  background: 'var(--y4)', border: '1px solid var(--y2)',
  color: 'var(--nim-dark)', borderRadius: 10,
  padding: '8px 12px', width: '100%', fontSize: 13, outline: 'none',
}

export default function OnlinePage() {
  const [mode, setMode] = useState<Mode>('quick')
  const [searching, setSearching] = useState(false)

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-5 pb-5 hex-pattern"
        style={{ background: 'linear-gradient(160deg,var(--y2) 0%,var(--y5) 70%)' }}>
        <DecorHex size={70} x={350} y={-10} opacity={0.14} stroke="var(--gold)" strokeWidth={1.2} />
        <div className="relative flex items-center gap-2">
          <Wifi size={16} style={{ color: 'var(--gold-dark)' }} />
          <h2 className="text-xl font-black" style={{ color: 'var(--nim-dark)' }}>ONLINE</h2>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--nim-muted)' }}>
          Challenge players worldwide for NIM prizes
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--y3)', border: '1px solid var(--y2)' }}>
          {(['quick','create','join'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
              style={mode === m
                ? { background: 'var(--nim-dark)', color: 'var(--gold)' }
                : { color: 'var(--nim-muted)' }}>
              {m === 'quick' ? 'Quick' : m === 'create' ? 'Create' : 'Join'}
            </button>
          ))}
        </div>

        {mode === 'quick' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
            <div className="hex-clip w-14 h-14 mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--gold)' }}>
              <Wifi size={22} style={{ color: 'var(--nim-dark)' }} />
            </div>
            <p className="font-black mb-1" style={{ color: 'var(--nim-dark)' }}>Quick Match</p>
            <p className="text-[12px] mb-4" style={{ color: 'var(--nim-muted)' }}>
              Get matched instantly with online players
            </p>
            {searching ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2">
                  {[0,1,2].map(i => (
                    <motion.div key={i} className="w-2.5 h-2.5 rounded-full"
                      style={{ background: 'var(--gold)' }}
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }} />
                  ))}
                </div>
                <p className="text-[12px] font-bold" style={{ color: 'var(--gold-dark)' }}>Searching…</p>
                <button onClick={() => setSearching(false)} className="text-xs" style={{ color: 'var(--nim-muted)' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setSearching(true)}
                className="w-full py-3 font-black rounded-xl glow-gold-sm"
                style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>
                FIND MATCH
              </button>
            )}
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl p-4 space-y-4"
            style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
            <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--nim-dark)' }}>
              <Plus size={14} style={{ color: 'var(--gold-dark)' }} /> Create Private Room
            </h3>
            <div>
              <label className="text-[10px] tracking-widest font-semibold block mb-1" style={{ color: 'var(--nim-muted)' }}>GAME</label>
              <select style={sel}>
                {['Nimtris','Hex Fall','Quick Tap','Memory Rush','Hex Runner'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-widest font-semibold block mb-1" style={{ color: 'var(--nim-muted)' }}>PLAYERS</label>
                <select style={sel}>{[2,4,8].map(n => <option key={n}>{n}</option>)}</select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest font-semibold block mb-1" style={{ color: 'var(--nim-muted)' }}>ENTRY (NIM)</label>
                <select style={sel}>{[0.001,0.002,0.005,0.01].map(n => <option key={n}>{n}</option>)}</select>
              </div>
            </div>
            <button className="w-full py-3 font-black rounded-xl"
              style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>
              CREATE ROOM
            </button>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex gap-2 rounded-xl px-3 py-2"
              style={{ background: 'var(--y4)', border: '1.5px solid var(--y2)' }}>
              <input placeholder="Room code…" className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--nim-dark)' }} />
              <button className="font-black px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--nim-dark)', color: 'var(--gold)' }}>JOIN</button>
            </div>

            <p className="text-[10px] tracking-widest font-bold" style={{ color: 'var(--nim-muted)' }}>PUBLIC ROOMS</p>

            {ROOMS.map((room, i) => (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: 'var(--y4)', border: '1px solid var(--y2)' }}>
                <div>
                  <p className="font-black text-sm" style={{ color: 'var(--nim-dark)' }}>{room.game}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--nim-muted)' }}>
                      <Users size={10} /> {room.players}/{room.maxPlayers}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--nim-muted)' }}>
                      <Coins size={10} /> {room.entry} NIM
                    </span>
                  </div>
                </div>
                <button className="text-xs font-black px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--gold)', color: 'var(--nim-dark)' }}>JOIN</button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
