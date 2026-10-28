/** A short, softly filtered paper rustle. Generated locally, with no audio downloads. */
let context: AudioContext | undefined;
let paper: AudioBuffer | undefined;

export function unlockPageSound() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (paper) return;
    const duration = .58;
    paper = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = paper.getChannelData(0);
    let smoothed = 0;
    for (let i = 0; i < samples.length; i++) {
      const time = i / context.sampleRate;
      const noise = Math.random() * 2 - 1;
      smoothed = smoothed * .7 + noise * .3;
      const envelope = Math.pow(Math.sin(Math.PI * time / duration), 1.8);
      const flutter = .58 + .23 * Math.sin(time * 76) + .14 * Math.sin(time * 143);
      samples[i] = (noise * .25 + smoothed) * envelope * flutter;
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
    source.buffer = buffer;
    source.playbackRate.value = .94 + Math.random() * .12;
    highPass.type = 'highpass';
    highPass.frequency.value = 650;
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 6200;
    volume.gain.value = .34;
    source.connect(highPass).connect(lowPass).connect(volume).connect(audio.destination);
    source.onended = () => { source.disconnect(); highPass.disconnect(); lowPass.disconnect(); volume.disconnect(); };
    source.start();
  };
  if (audio.state === 'running') play();
  else void audio.resume().then(play).catch(() => {});
}
