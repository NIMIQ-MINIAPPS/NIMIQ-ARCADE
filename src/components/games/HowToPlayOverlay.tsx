import { motion } from 'framer-motion'

interface HowToPlayOverlayProps {
  bg: string
  accent: string
  textColor?: string
  mutedColor?: string
  title?: string
  bullets: string[]
  onStart: () => void
}

/** Second pre-game step shown after the start screen's PLAY tap and before
 * gameplay begins — a short "how to play" so nobody starts a game blind. */
export default function HowToPlayOverlay({
  bg,
  accent,
  textColor = '#F2F2F5',
  mutedColor = '#8A8A9A',
  title = 'HOW TO PLAY',
  bullets,
  onStart,
}: HowToPlayOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 px-8"
      style={{ background: bg }}
    >
      <p
        className="text-[13px] font-black tracking-[0.2em]"
        style={{ color: accent }}
      >
        {title}
      </p>

      <div className="flex flex-col gap-3 max-w-[300px] w-full">
        {bullets.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3"
          >
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: accent, color: bg }}
            >
              {i + 1}
            </span>
            <p className="text-[13px] leading-snug pt-0.5" style={{ color: textColor }}>
              {b}
            </p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="px-10 py-3 rounded-xl font-black text-[14px] tracking-wide mt-2"
        style={{ background: accent, color: bg }}
      >
        GOT IT
      </button>

      <p className="text-[10px]" style={{ color: mutedColor }}>Shown once — jump straight in next time</p>
    </motion.div>
  )
}
