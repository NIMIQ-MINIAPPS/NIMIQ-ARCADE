export interface User {
  id: string
  nimiqAddress: string
  displayName: string
  avatar: string
  xp: number
  level: number
  totalNimEarned: number
  gamesPlayed: number
  wins: number
  losses: number
  dailyXpEarned: number
  lastActiveDate: string
}

export interface GameMeta {
  id: string
  name: string
  description: string
  icon: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  color: string
  highScore: number
  xpMultiplier: number
}

export interface Score {
  userId: string
  gameId: string
  score: number
  xpEarned: number
  date: string
}

export interface LeaderboardEntry {
  rank: number
  user: User
  score: number
  xp: number
}

export interface Tournament {
  id: string
  name: string
  game: string
  entryFee: number
  maxPlayers: number
  currentPlayers: number
  rewardPool: number
  startTime: string
  status: 'upcoming' | 'active' | 'ended'
  type: 'daily' | 'weekly' | 'monthly'
}

export interface OnlineMatch {
  id: string
  game: string
  players: string[]
  maxPlayers: number
  entryFee: number
  pot: number
  status: 'waiting' | 'playing' | 'ended'
  winner?: string
}

export type Tab = 'home' | 'games' | 'online' | 'tournaments' | 'profile'
