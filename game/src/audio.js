// Synthesised sound: every effect is an oscillator or a noise burst shaped live in
// WebAudio, so the game ships zero audio files and stays fully offline.
// The context is created lazily on the first user gesture (browsers require one),
// and every call is a no-op until then — the screenshot scenes run silently.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let bassStep = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    return true;
  }

  /** One shaped oscillator blip. */
  function tone({ type = 'square', from = 440, to = from, seconds = 0.12, volume = 0.2, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  /** One filtered noise burst (explosions, impacts). */
  function noise({ seconds = 0.3, volume = 0.35, from = 1200, to = 120, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  const audio = {
    unlock() {
      ensure();
      audio.startMusic();
    },
    shoot() {
      tone({ type: 'square', from: 880, to: 220, seconds: 0.07, volume: 0.07 });
    },
    enemyHit() {
      tone({ type: 'triangle', from: 300, to: 180, seconds: 0.05, volume: 0.06 });
    },
    explosion(big = false) {
      noise({ seconds: big ? 0.55 : 0.28, volume: big ? 0.5 : 0.3, from: big ? 900 : 1400 });
      tone({ type: 'sine', from: big ? 160 : 220, to: 40, seconds: big ? 0.5 : 0.25, volume: 0.25 });
    },
    playerHurt() {
      tone({ type: 'sawtooth', from: 220, to: 70, seconds: 0.22, volume: 0.3 });
      noise({ seconds: 0.15, volume: 0.2, from: 2000, to: 300 });
    },
    pickup() {
      tone({ type: 'sine', from: 660, to: 660, seconds: 0.07, volume: 0.16 });
      tone({ type: 'sine', from: 990, to: 990, seconds: 0.1, volume: 0.16, delay: 0.06 });
    },
    nova() {
      noise({ seconds: 0.7, volume: 0.5, from: 3000, to: 100 });
      tone({ type: 'sine', from: 80, to: 400, seconds: 0.5, volume: 0.2 });
    },
    upgrade() {
      [523, 659, 784, 1046].forEach((note, i) => tone({ type: 'triangle', from: note, to: note, seconds: 0.16, volume: 0.16, delay: i * 0.07 }));
    },
    waveClear() {
      [392, 523, 659].forEach((note, i) => tone({ type: 'square', from: note, to: note, seconds: 0.14, volume: 0.1, delay: i * 0.09 }));
    },
    alarm() {
      tone({ type: 'sawtooth', from: 140, to: 140, seconds: 0.18, volume: 0.22 });
      tone({ type: 'sawtooth', from: 140, to: 140, seconds: 0.18, volume: 0.22, delay: 0.28 });
    },
    gameOver() {
      [440, 349, 262, 196].forEach((note, i) => tone({ type: 'triangle', from: note, to: note * 0.97, seconds: 0.3, volume: 0.2, delay: i * 0.22 }));
    },
    victory() {
      [523, 659, 784, 1046, 1318].forEach((note, i) => tone({ type: 'triangle', from: note, to: note, seconds: 0.24, volume: 0.18, delay: i * 0.11 }));
    },
    /** A slow two-bar bass pulse under the action; scheduled, quiet, and stoppable. */
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      const bassline = [55, 55, 82.4, 55, 65.4, 55, 98, 73.4];
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const note = bassline[bassStep % bassline.length];
        bassStep += 1;
        tone({ type: 'triangle', from: note, to: note, seconds: 0.24, volume: 0.11 });
        if (bassStep % 4 === 0) tone({ type: 'sine', from: note * 4, to: note * 4, seconds: 0.5, volume: 0.03 });
      }, 240);
    },
    setMuted(value) {
      muted = value;
      if (master && context) master.gain.setValueAtTime(value ? 0 : 0.5, context.currentTime);
    },
    isMuted() {
      return muted;
    },
  };
  return audio;
}
