type Reader = {
  page: () => number;
  lastVisible: () => number;
  count: () => number;
  next: () => void;
  settled: () => boolean;
};

export function speechChunks(text: string): string[] {
  // Short utterances avoid browser limits on long articles. Prefer sentence ends.
  const sentences = text.match(/[^।.!?]+[।.!?]*\s*/gu) ?? [];
  const chunks: string[] = [];
  let chunk = '';
  for (const sentence of sentences) {
    for (const word of sentence.trim().split(/\s+/)) {
      if (chunk.length + word.length > 180 && chunk) { chunks.push(chunk.trim()); chunk = ''; }
      chunk += `${word} `;
    }
    if (chunk.length >= 100) { chunks.push(chunk.trim()); chunk = ''; }
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks;
}

export function createAudioBook(reader: Reader) {
  const button = document.getElementById('audio-book') as HTMLButtonElement;
  const status = document.getElementById('audio-status')!;
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let pages: string[] = [];
  let active = false;
  let generation = 0;
  let reading = -1;
  let moving = false;
  // Retain the utterance until completion (some engines otherwise collect it).
  let utterance: SpeechSynthesisUtterance | null = null;
  let releaseSpeech: (() => void) | undefined;

  function show(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }
  function paint() {
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Stop audiobook' : 'Read aloud from this page';
    button.setAttribute('aria-label', active ? 'Stop Audio Book' : 'Start Audio Book');
  }
  function cancelSpeech() {
    // Invalidate handlers before cancel(), which may synchronously emit an error.
    if (utterance) { utterance.onend = null; utterance.onerror = null; }
    if (supported) window.speechSynthesis.cancel();
    releaseSpeech?.();
    releaseSpeech = undefined;
    utterance = null;
  }
  function stop(message = '') {
    active = false;
    generation++;
    moving = false;
    cancelSpeech();
    paint();
    show(message);
  }
  const valid = (token: number) => active && generation === token;
  async function settle(token: number, previous?: number) {
    const deadline = Date.now() + 6000;
    while (valid(token) && (!reader.settled() || (previous !== undefined && reader.page() === previous))) {
      if (Date.now() > deadline) throw new Error('The page could not turn. Please try Audio Book again.');
      await new Promise(resolve => setTimeout(resolve, 60));
    }
  }
  async function speak(text: string, token: number) {
    if (!valid(token)) return;
    const speech = window.speechSynthesis;
    const hindi = (text.match(/[\u0900-\u097f]/g)?.length ?? 0) > (text.match(/[a-z]/gi)?.length ?? 0);
    const language = hindi ? 'hi-IN' : 'en-IN';
    const voices = speech.getVoices();
    const voice = voices.find(voice => voice.lang.replace('_', '-').toLowerCase() === language.toLowerCase())
      ?? voices.find(voice => voice.lang.startsWith(hindi ? 'hi' : 'en'));
    await new Promise<void>((resolve, reject) => {
      const request = new SpeechSynthesisUtterance(text);
      utterance = request;
      releaseSpeech = resolve;
      request.lang = language;
      if (voice) request.voice = voice;
      request.rate = .95;
      request.onend = () => { releaseSpeech = undefined; utterance = null; resolve(); };
      request.onerror = event => {
        releaseSpeech = undefined;
        utterance = null;
        if (!valid(token)) { resolve(); return; }
        reject(new Error(event.error === 'language-unavailable' || event.error === 'voice-unavailable'
          ? 'Install a Hindi speech voice in your device settings, then try Audio Book again.'
          : 'Narration could not play. Please try Audio Book again and check your device’s speech settings.'));
      };
      speech.speak(request);
    });
  }
  async function run(start: number, token: number) {
    try {
      reading = start;
      await settle(token);
      if (!valid(token)) return;
      if (reading < reader.page() || reading > reader.lastVisible()) reading = reader.page();
      // A cover is displayed on its own. Open it before reading page two.
      if (reading === 0 && reader.count() > 1) {
        moving = true;
        reader.next();
        await settle(token, 0);
        if (!valid(token)) return;
        moving = false;
        reading = reader.page();
      }
      while (valid(token) && reading < reader.count()) {
        const page = reading;
        const chunks = speechChunks(pages[page]);
        show(chunks.length ? `Reading page ${page + 1} of ${reader.count()}` : `No readable text on page ${page + 1}. Continuing…`);
        for (const chunk of chunks) {
          if (!valid(token)) return;
          await speak(chunk, token);
        }
        if (!valid(token)) return;
        if (page === reader.count() - 1) { stop('Audiobook finished.'); return; }
        // Read the right-hand page too before turning a desktop spread.
        reading = page + 1;
        if (reading > reader.lastVisible()) {
          moving = true;
          const previous = reader.page();
          await settle(token);
          if (!valid(token)) return;
          reader.next();
          await settle(token, previous);
          if (!valid(token)) return;
          moving = false;
          reading = reader.page();
        }
      }
    } catch (error) {
      if (valid(token)) stop(error instanceof Error ? error.message : 'Narration could not play. Please try again.');
    }
  }
  button.onclick = () => {
    if (active) { stop(); return; }
    if (!supported || !pages.length) return;
    active = true;
    paint();
    // Prime speech inside the click gesture, including when a cover must turn first.
    const prime = new SpeechSynthesisUtterance(' ');
    prime.volume = 0;
    window.speechSynthesis.speak(prime);
    void run(reader.page(), ++generation);
  };
  window.addEventListener('pagehide', () => stop());
  return {
    async load(base: string) {
      if (!supported) {
        button.disabled = false;
        button.onclick = () => show('Audio Book needs a browser with text-to-speech support.');
        button.title = 'Text-to-speech is unavailable in this browser';
        return;
      }
      try {
        const response = await fetch(`${base}book/narration.json`);
        if (!response.ok) throw new Error('Missing narration');
        const data = await response.json();
        if (!Array.isArray(data.pages) || data.pages.length !== reader.count() || !data.pages.every((page: unknown) => typeof page === 'string')) throw new Error('Invalid narration');
        pages = data.pages;
        window.speechSynthesis.getVoices();
        button.disabled = false;
      } catch {
        button.disabled = false;
        button.onclick = () => show('Audiobook text could not load. Please refresh and try again.');
      }
    },
    pageChanged(target?: number) {
      if (!active || moving || (target === undefined && reading >= reader.page() && reading <= reader.lastVisible())) return;
      generation++;
      cancelSpeech();
      void run(target ?? reader.page(), generation);
    },
  };
}
