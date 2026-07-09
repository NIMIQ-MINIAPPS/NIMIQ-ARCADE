// Singleton mute flag — import in every game's snd() function
export let soundMuted = false
export function setSoundMuted(v: boolean) { soundMuted = v }
