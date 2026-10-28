/** A quiet, rounded paper swish, generated locally without audio downloads. */
let context: AudioContext | undefined;
let paper: AudioBuffer | undefined;

export function unlockPageSound() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (paper) return;
    const duration = .72;
    paper = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = paper.getChannelData(0);
    let smoothed = 0;
    // Sample-rate-independent colored noise avoids the old sharp, static-like hiss.
    const smoothing = Math.exp(-2 * Math.PI * 850 / context.sampleRate);
    for (let i = 0; i < samples.length; i++) {
      const time = i / context.sampleRate;
      smoothed = smoothed * smoothing + (Math.random() * 2 - 1) * (1 - smoothing);
      // One gentle swell with a long, silent-ended release; no rapid flutter.
      const envelope = Math.pow(Math.sin(Math.PI * time / duration), 2);
      const movement = .94 + .06 * Math.sin(time * 18);
      samples[i] = smoothed * envelope * movement;
    }
  } catch { /* Reading continues when audio is unsupported or blocked. */ }
}

export function playPageSound() {
  if (!context || !paper) return;
  const audio = context;
  const buffer = paper;
  const play = () => {
    const source = audio.createBufferSource();
    const highPass = audio.createBiquadFilter();
    const lowPass = audio.createBiquadFilter();
    const volume = audio.createGain();
    const now = audio.currentTime;
    source.buffer = buffer;
    source.playbackRate.value = .97 + Math.random() * .06;
    highPass.type = 'highpass';
    highPass.frequency.value = 120;
    highPass.Q.value = .5;
    lowPass.type = 'lowpass';
    lowPass.Q.value = .5;
    lowPass.frequency.setValueAtTime(1600, now);
    lowPass.frequency.exponentialRampToValueAtTime(850, now + .65);
    volume.gain.value = .2;
    source.connect(highPass).connect(lowPass).connect(volume).connect(audio.destination);
    source.onended = () => { source.disconnect(); highPass.disconnect(); lowPass.disconnect(); volume.disconnect(); };
    source.start();
  };
  if (audio.state === 'running') play();
  else void audio.resume().then(play).catch(() => {});
}
