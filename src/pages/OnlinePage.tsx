import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Plus, Users, Coins } from 'lucide-react'

type Mode = 'quick' | 'create' | 'join'

const MOCK_ROOMS = [
  { id: 'abc123', game: 'Nimtris', players: 3, maxPlayers: 4, entry: 0.001, status: 'waiting' },
  { id: 'def456', game: 'Hex Fall', players: 7, maxPlayers: 8, entry: 0.002, status: 'waiting' },
  { id: 'ghi789', game: 'Quick Tap', players: 1, maxPlayers: 2, entry: 0.005, status: 'waiting' },
]

export default function OnlinePage() {
  const [mode, setMode] = useState<Mode>('quick')
  const [searching, setSearching] = useState(false)

  const handleQuickMatch = () => {
    setSearching(true)
    setTimeout(() => setSearching(false), 3000)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-2">
      <div className="flex items-center gap-2 pt-2">
        <Wifi size={18} className="text-[#FFC107]" />
        <h2 className="text-xl font-black tracking-tight text-white">ONLINE</h2>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-[#111] rounded-xl p-1 gap-1">
        {(['quick', 'create', 'join'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              mode === m ? 'bg-[#FFC107] text-[#080808]' : 'text-[#555]'
            }`}
          >
            {m === 'quick' ? 'Quick Match' : m === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        ))}
      </div>

      {mode === 'quick' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="arcade-card rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🎮</div>
            <p className="text-white font-bold mb-1">Quick Match</p>
            <p className="text-[12px] text-[#555] mb-4">Get matched instantly with online players</p>
            {searching ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-[#FFC107] rounded-full"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
                <p className="text-[12px] text-[#FFC107]">Searching for players…</p>
              </div>
            ) : (
              <button
                onClick={handleQuickMatch}
                className="w-full py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl glow-yellow"
              >
                FIND MATCH
              </button>
            )}
          </div>
        </motion.div>
      )}

      {mode === 'create' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="arcade-card rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus size={14} className="text-[#FFC107]" /> Create Private Room
            </h3>
            <div className="space-y-2">
              <label className="text-[11px] text-[#555] uppercase tracking-widest">Game</label>
              <select className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-white text-sm">
                <option>Nimtris</option>
                <option>Hex Fall</option>
                <option>Quick Tap</option>
                <option>Memory Rush</option>
                <option>Hex Runner</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#555] uppercase tracking-widest">Max Players</label>
                <select className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-white text-sm mt-1">
                  {[2, 4, 8].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#555] uppercase tracking-widest">Entry (NIM)</label>
                <select className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-white text-sm mt-1">
                  {[0.001, 0.002, 0.005, 0.01].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <button className="w-full py-3 bg-[#FFC107] text-[#080808] font-black rounded-xl mt-2">
              CREATE ROOM
            </button>
          </div>
        </motion.div>
      )}

      {mode === 'join' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="arcade-card rounded-2xl p-3 flex gap-2">
            <input
              placeholder="Enter room code…"
              className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
            />
            <button className="bg-[#FFC107] text-[#080808] font-black px-4 py-1.5 rounded-lg text-xs">
              JOIN
            </button>
          </div>

          <p className="text-[11px] text-[#555] uppercase tracking-widest">Public Rooms</p>

          {MOCK_ROOMS.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="arcade-card rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-white text-sm">{room.game}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-[#666]">
                    <Users size={10} /> {room.players}/{room.maxPlayers}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-[#666]">
                    <Coins size={10} /> {room.entry} NIM
                  </span>
                </div>
              </div>
              <button className="text-xs font-bold text-[#080808] bg-[#FFC107] px-3 py-1.5 rounded-lg">
                JOIN
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
