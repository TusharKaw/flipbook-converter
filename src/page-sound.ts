/** Play the supplied page-turn recording, preloaded from this site's own assets. */
let context: AudioContext | undefined;
let recording: Promise<AudioBuffer | null> | undefined;
let active: { source: AudioBufferSourceNode; gain: GainNode } | undefined;
let requestedTurn = 0;

// Begin downloading before the first gesture so touch/drag playback starts promptly.
const file = fetch(`${import.meta.env.BASE_URL}audio/page-flip.mp3`)
  .then(response => {
    if (!response.ok) throw new Error('Page-turn audio unavailable');
    return response.arrayBuffer();
  })
  .catch(() => null);

export function unlockPageSound() {
  try {
    context ??= new AudioContext();
    const audio = context;
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
    recording ??= file.then(bytes => bytes ? audio.decodeAudioData(bytes) : null).catch(() => null);
  } catch { /* Reading continues if browser audio is unavailable. */ }
}

export function playPageSound() {
  if (!context || !recording) return;
  const audio = context;
  const turn = ++requestedTurn;
  void Promise.all([recording, audio.resume()]).then(([buffer]) => {
    if (!buffer || turn !== requestedTurn) return;
    const now = audio.currentTime;
    // Avoid stacking the 2.4-second recording when pages are turned quickly.
    if (active) {
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(active.gain.gain.value, now);
      active.gain.gain.linearRampToValueAtTime(0, now + .025);
      active.source.stop(now + .03);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    // Preserve the recording's original pitch, timing, and tone.
    gain.gain.value = .7;
    source.connect(gain).connect(audio.destination);
    active = { source, gain };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (active?.source === source) active = undefined;
    };
    source.start();
  }).catch(() => { /* Audio must never interrupt navigation. */ });
}
