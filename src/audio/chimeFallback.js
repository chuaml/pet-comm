const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

function hashString(str) {
  const text = String(str || 'pad');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function playFallbackChime(ctx, seedKey = 'pad', volume = 0.8) {
  if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
    return false;
  }

  try {
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime || 0;
    const baseFreq = PENTATONIC_HZ[hashString(seedKey) % PENTATONIC_HZ.length];
    const safeVol = Math.min(Math.max(Number(volume) || 0.8, 0.1), 1.0);
    const peakGain = 0.16 * safeVol;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    masterGain.connect(ctx.destination);

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(baseFreq, now);
    oscMain.connect(masterGain);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.28, now);
    overtoneGain.connect(masterGain);

    const oscWarm = ctx.createOscillator();
    oscWarm.type = 'triangle';
    oscWarm.frequency.setValueAtTime(baseFreq * 1.5, now);
    oscWarm.connect(overtoneGain);

    oscMain.start(now);
    oscWarm.start(now);
    oscMain.stop(now + 0.25);
    oscWarm.stop(now + 0.25);
    return true;
  } catch {
    return false;
  }
}
