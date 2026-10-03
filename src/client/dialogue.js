const pages = [
  [
    ['First run, rookie? Figures. I’m Ren. Try to keep up: '],
    ['don’t touch the road borders.', 'danger'],
    [' One scrape and your run is over. Let’s see if you can handle the first bend.'],
  ],
  [
    ['And a little advice, rookie: '],
    ['don’t hit my car.', 'danger'],
    [' Contact ends your run instantly. This paint job costs more than your driving lessons.'],
  ],
  [
    ['Think you can beat me? Get '],
    ['fully ahead and stay clear for 5 seconds.', 'goal'],
    [' Do it '],
    ['before I reach the finish.', 'goal'],
    [' I’ll give you a good look at my taillights. Ready, rookie?'],
  ],
];

/** One reusable voice; short, changing syllables without recorded assets. */
export class RivalVoice {
  constructor(createContext = () => new AudioContext()) {
    this.createContext = createContext;
    this.syllable = 0;
  }
  unlock() {
    if (this.failed) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.oscillator = this.context.createOscillator();
        this.gain = this.context.createGain();
        this.oscillator.type = 'triangle';
        this.gain.gain.value = 0;
        this.oscillator.connect(this.gain);
        this.gain.connect(this.context.destination);
        this.oscillator.start();
      }
      this.context.resume().catch(() => this.disable());
    } catch {
      this.disable();
    }
  }
  disable() {
    this.failed = true;
    this.stop();
  }
  speak(letter) {
    if (this.failed || !this.context || !/[a-z0-9]/i.test(letter)) return;
    const time = this.context.currentTime;
    const pitch = [420, 560, 470, 630, 510, 390][this.syllable++ % 6];
    this.oscillator.frequency.setValueAtTime(pitch, time);
    this.oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.78, time + 0.045);
    this.gain.gain.cancelScheduledValues(time);
    this.gain.gain.setValueAtTime(0, time);
    this.gain.gain.linearRampToValueAtTime(0.045, time + 0.008);
    this.gain.gain.linearRampToValueAtTime(0, time + 0.055);
  }
  stop() {
    if (!this.gain) return;
    this.gain.gain.cancelScheduledValues(this.context.currentTime);
    this.gain.gain.setValueAtTime(0, this.context.currentTime);
  }
}

export function createDialogue(onFinish, onCancel, isSoundOn) {
  const dialog = document.getElementById('rival-dialogue');
  const copy = document.getElementById('dialogue-copy');
  const next = document.getElementById('dialogue-next');
  const voice = new RivalVoice();
  let page = 0;
  let cursor = 0;
  let timer = null;
  let parts = [];
  let fullText = '';
  const stop = () => {
    clearInterval(timer);
    timer = null;
    voice.stop();
    dialog.classList.remove('speaking');
  };
  function reveal() {
    let remaining = cursor;
    for (const [element, text] of parts) {
      element.textContent = text.slice(0, Math.max(0, remaining));
      remaining -= text.length;
    }
    if (cursor >= fullText.length) {
      stop();
      next.textContent = page === pages.length - 1 ? 'LET’S RACE ↗' : 'NEXT ▸';
    }
  }
  function showPage() {
    stop();
    cursor = 0;
    copy.replaceChildren();
    parts = pages[page].map(([text, tone]) => {
      const element = document.createElement(tone ? 'strong' : 'span');
      if (tone) element.className = tone;
      copy.append(element);
      return [element, text];
    });
    fullText = pages[page].map(([text]) => text).join('');
    copy.setAttribute('aria-label', fullText);
    document.getElementById('dialogue-page').textContent = `RULE ${page + 1} / ${pages.length}`;
    next.textContent = 'SHOW TEXT ▸';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cursor = fullText.length;
      reveal();
      return;
    }
    dialog.classList.add('speaking');
    timer = setInterval(() => {
      if (document.hidden || !document.hasFocus()) {
        voice.stop();
        return;
      }
      cursor = Math.min(cursor + 2, fullText.length);
      if (isSoundOn()) voice.speak(fullText[cursor - 1]);
      reveal();
    }, 60);
  }
  function advance() {
    if (cursor < fullText.length) {
      cursor = fullText.length;
      reveal();
    } else if (page < pages.length - 1) {
      page++;
      showPage();
    } else {
      stop();
      dialog.close();
      onFinish();
    }
  }
  next.onclick = advance;
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) advance();
    }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    stop();
    dialog.close();
    onCancel();
  });
  dialog.addEventListener('close', stop);
  window.addEventListener('blur', () => voice.stop());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) voice.stop();
  });
  return {
    open() {
      page = 0;
      if (isSoundOn()) voice.unlock();
      dialog.showModal();
      showPage();
      next.focus();
    },
    close() {
      stop();
      dialog.close();
    },
    get active() {
      return dialog.open;
    },
  };
}
