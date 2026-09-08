// Ideal series-RLC response for the exact component values in Alex's exercise.
function resonanceCurve() {
  return Array.from({ length: 161 }, (_, i) => {
    const omega = 2 * Math.PI * 10 ** (3 * i / 160);
    const amplitude = 100 / Math.hypot(100, omega - 1 / (omega * 0.00001));
    return `${i ? 'L' : 'M'}${i * 2},${(67 - 62 * amplitude).toFixed(2)}`;
  }).join(' ');
}

// Exercises adapted from FQC's teaching archive; provenance is in docs/workshop-research.md.
export function renderWorkshopStories(photo) {
  return `<section class="hack-photo-story workshop-story" aria-label="Inside the FQC workshops">
    <div class="workshop-opening"><p class="hack-kicker">OPEN LAPTOPS / OPEN QUESTIONS</p><p>You don’t have to arrive with the answers<br><em>Start with something you can try</em></p></div>
    <section class="workshop-chapter workshop-hardware" aria-labelledby="hardware-title">
      <div class="workshop-copy"><p class="hack-kicker">AT THE BENCH · ALEX HEARD</p><h2 id="hardware-title">Find your<br><em>frequency</em></h2><p>Our hardware workshop starts in Falstad: build an oscillator, turn the frequency dial, watch the voltage peak</p><p class="workshop-question">How does that become a qubit?</p>
        <div class="resonance-note" role="img" aria-label="The workshop's 1 henry and 10 microfarad circuit resonates at approximately 50.3 hertz"><svg viewBox="0 0 320 76" aria-hidden="true"><path d="M0 67H320" class="resonance-axis"/><path d="${resonanceCurve()}"/><circle cx="181.53" cy="5" r="4"/></svg><div class="resonance-scale"><span>1 Hz</span><span>1 kHz</span></div><div><span>1 H · 10 μF · 100 Ω</span><strong>Peak · 50.3 Hz</strong></div></div>
        <details class="workshop-depth"><summary>From a voltage peak to a quantum gate <span aria-hidden="true">+</span></summary><div class="workshop-detail-body"><p>In the original exercise, sweep the AC source from 1 Hz to 1 kHz and watch the resistor on the scope. Check the peak with <span class="workshop-math">f₀ = 1 / (2π√LC)</span></p><p>A regular oscillator has evenly spaced quantum energy levels. That makes it hard to address just the lowest two. A Josephson junction introduces the nonlinearity used in a transmon, separating the transition frequencies</p><p>That distinction matters: a pulse meant for |0⟩ → |1⟩ can leak into |2⟩ if it is poorly controlled. The deck connects pulse amplitude and duration to Rabi rotation—the physical operation behind a gate</p><p class="workshop-challenge">The workshop’s scale jump: with 10 pH, what capacitance gives 5 GHz? About 101 pF in the ideal LC model</p><a href="https://www.falstad.com/circuit/" target="_blank" rel="noopener noreferrer">Build the oscillator in Falstad ↗</a><small>From “Quantum Superconducting Hardware” · slides 5–7 and 10–17<br>The 50.3 Hz circuit is a classical teaching model, not a working qubit</small></div></details>
      </div>
      <figure class="workshop-photo">${photo('workshop-room-clear', 'FQC members working at laptops in a crowded club session')}<figcaption>FQC in session · A room to work things out together</figcaption></figure>
    </section>
    <section class="workshop-chapter workshop-phase" aria-labelledby="phase-title">
      <div class="workshop-copy"><p class="hack-kicker">AT THE CIRCUIT · DANIEL TAKSHI &amp; ALEX HEARD</p><h2 id="phase-title">Same odds<br><em>different story</em></h2><p>In our Quirk workshop, two states both read 50/50. Their amplitudes tell a different story</p><p class="workshop-question">Can one gate make that difference visible?</p>
        <details class="workshop-depth"><summary>The detail a probability chart misses <span aria-hidden="true">+</span></summary><div class="workshop-detail-body"><p>The deck pairs Quirk’s Amps and Chance displays. For |+⟩ and |−⟩, squaring the amplitudes gives identical 0/1 probabilities. The relative minus sign survives in the state</p><p class="workshop-math">|+⟩ = (|0⟩ + |1⟩) / √2<br>|−⟩ = (|0⟩ − |1⟩) / √2</p><p>A Hadamard gate combines those amplitudes. They reinforce one outcome and cancel the other: H|+⟩ = |0⟩, H|−⟩ = |1⟩. Measurement in the 0/1 basis can now distinguish them</p><p>The earlier X-gate puzzle has another layer: X|+⟩ = |+⟩, while X|−⟩ = −|−⟩. That second minus multiplies the whole state—a global phase, with no observable change on its own</p><small>“QUIRK and Quantum Circuits” · March 24, 2026 · exercises on slides 13–20, 26–34 and 37–43</small></div></details>
        <details class="workshop-depth"><summary>The challenge we leave you with <span aria-hidden="true">+</span></summary><div class="workshop-detail-body"><p>Build |0⟩ → |−⟩, then reverse it. In circuit order, try H then Z; the inverse is Z then H. Order matters</p><p>Now try the final slide’s harder question: can a quantum gate send every input to |0⟩? A unitary gate cannot—distinct orthogonal inputs must remain orthogonal. Reset is possible, but it needs a non-unitary process rather than one reversible gate</p><a href="https://algassert.com/quirk" target="_blank" rel="noopener noreferrer">Try the workshop challenges in Quirk ↗</a><small>Original challenge sheet · slide 44</small></div></details>
      </div>
      <div class="phase-experiment" aria-label="Try the Quirk workshop idea"><div class="experiment-heading"><span>TRY THE IDEA</span><span>01 / PHASE</span></div><p class="phase-instruction">Two inputs, one operation</p>
        <div class="phase-track" data-phase-track="plus"><span class="phase-input">|+⟩</span><span class="phase-wire"></span><span class="phase-gate" data-phase-gate>—</span><span class="phase-wire"></span><span class="phase-result" data-phase-state="plus">|+⟩</span></div>
        <div class="phase-probabilities" data-phase-bars="plus" role="img" aria-label="Plus input: zero 50 percent, one 50 percent"><div><span>0</span><i><b style="width:50%"></b></i><strong>50%</strong></div><div><span>1</span><i><b style="width:50%"></b></i><strong>50%</strong></div></div>
        <div class="phase-track" data-phase-track="minus"><span class="phase-input">|−⟩</span><span class="phase-wire"></span><span class="phase-gate" data-phase-gate>—</span><span class="phase-wire"></span><span class="phase-result" data-phase-state="minus">|−⟩</span></div>
        <div class="phase-probabilities" data-phase-bars="minus" role="img" aria-label="Minus input: zero 50 percent, one 50 percent"><div><span>0</span><i><b style="width:50%"></b></i><strong>50%</strong></div><div><span>1</span><i><b style="width:50%"></b></i><strong>50%</strong></div></div>
        <button type="button" class="workshop-action" data-apply-h aria-pressed="false">Apply H to both</button><p class="experiment-result" data-phase-explanation role="status">Same measurement odds<br>A different relative sign</p><small>H = Hadamard gate · Bars show 0/1 measurement odds</small>
      </div>
    </section>
    <section class="workshop-search" aria-labelledby="search-title">
      <figure class="workshop-search-photo">${photo('full-room-clear', 'A full room of FQC members with laptops, sharing ideas', false, true)}<figcaption>More minds in the circuit</figcaption></figure>
      <div class="workshop-search-body"><div class="workshop-copy"><p class="hack-kicker">IN THE CODE · OUR GROVER NOTEBOOK</p><h2 id="search-title">Make one answer<br><em>stand out</em></h2><p>Our Qiskit notebook marks a target by changing its phase, then amplifies its chance of being measured</p><p class="workshop-question">The sign you just uncovered becomes a search tool</p></div>
        <div class="workshop-search-notes"><dl class="search-facts"><div><dt>12</dt><dd>simulated qubits</dd></div><div><dt>4,096</dt><dd>possible states</dd></div><div><dt>50</dt><dd>amplification rounds</dd></div></dl>
          <details class="workshop-depth"><summary>Inside our search notebook <span aria-hidden="true">+</span></summary><div class="workshop-detail-body"><p>Prepare all 12 qubits with H gates. The oracle surrounds a multi-controlled Z operation with X gates to mark the chosen bitstring. The diffuser reflects amplitudes about their average; repeat oracle + diffuser 50 times</p><p>The saved AerSimulator run sets target = 1 and records that answer 199,987 times in 200,000 shots. This controlled simulator exercise starts with a target deliberately encoded in the oracle</p><div class="grover-experiment"><label for="grover-rounds">Try a different number of rounds</label><div class="grover-readout"><output id="grover-probability" for="grover-rounds">99.995%</output><span>ideal target probability</span></div><div class="grover-field"><canvas width="768" height="288" role="img" aria-label="4,096 states; target 1 has 99.995 percent probability" data-grover-field></canvas><span>4,096 states · Highlighted dot: target 1</span></div><input id="grover-rounds" type="range" min="0" max="100" value="50" aria-describedby="grover-round-label grover-explanation"><div class="grover-scale"><span>0</span><output id="grover-round-label" for="grover-rounds">50 rounds</output><span>100</span></div><p id="grover-explanation">Near the first peak—keep going and the probability falls again</p></div><p class="workshop-math">P(r) = sin²((2r + 1)θ)<br>θ = arcsin(1/√4096)</p><small>Explore the ideal one-target model<br>Source: FQC’s “Grover’s Algorithm Solution.ipynb”</small></div></details>
          <details class="workshop-depth"><summary>Before the search: two hidden bits <span aria-hidden="true">+</span></summary><div class="workshop-detail-body"><p>Daniel’s SwampHacks XI workshop poses a smaller problem: a black box hides two bits. You only need to know whether they match. Reading one bit classically leaves the answer unresolved</p><p>Prepare a test qubit in |+⟩ and an answer qubit in |−⟩. One coherent oracle call transfers the hidden relationship into the test qubit’s relative phase. A final H makes it readable</p><div class="oracle-outcomes"><div><b>00 / 11</b><span>same → |0⟩</span></div><div><b>01 / 10</b><span>different → |1⟩</span></div></div><p>This is Deutsch’s algorithm: one quantum query versus two classical queries for a certain answer in this oracle model. It reveals the relationship, not both secret bits</p><a href="https://quantum.cloud.ibm.com/learning/en/courses/fundamentals-of-quantum-algorithms/quantum-query-algorithms/deutsch-algorithm" target="_blank" rel="noopener noreferrer">Follow the phase-kickback derivation ↗</a><small>“The 2-bit equivalency problem” · Daniel Takshi · SwampHacks XI, January 2026<br>Final H/readout explained here using IBM’s derivation</small></div></details>
        </div>
      </div>
    </section>
    <aside class="workshop-outlook"><figure>${photo('photonics-enhanced', 'FQC audience viewing the NV-based quantum sensing slide at the April 2026 photonics talk')}<figcaption>Photonics session · April 2026</figcaption></figure><div><p class="hack-kicker">BEYOND THE LAPTOP</p><h2>A different<br> kind of <em>signal</em></h2><p>Our photonics session explored nitrogen-vacancy centers in diamond—quantum states used to sense the world</p><p class="workshop-outlook-link">Control a state → reveal a difference → put it to work</p></div></aside>
  </section>`;
}

let removeStoryLayoutListener;
let removeStoryMotion;
const enteredPhotos = new Set();

function bindPhotoPress(figures, reduced) {
  let pressed = null;
  const animations = new Set();
  const play = (figure, frames, options) => {
    figure.getAnimations().forEach(animation => animation.cancel());
    if (reduced.matches) return;
    const animation = figure.animate(frames, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };
  const release = bounce => {
    if (!pressed) return;
    const { figure } = pressed;
    pressed = null;
    const current = getComputedStyle(figure).transform;
    figure.classList.remove('photo-is-pressed');
    play(figure, bounce ? [
      { transform: current, offset: 0 },
      { transform: 'scale(1.018)', offset: .45 },
      { transform: 'scale(.997)', offset: .76 },
      { transform: 'none', offset: 1 }
    ] : [{ transform: current }, { transform: 'none' }], {
      duration: bounce ? 420 : 140, easing: 'ease-out'
    });
  };
  const down = event => {
    if (event.button !== 0 || event.target.closest('a, button, input')) return;
    if (!event.isPrimary) { release(false); return; }
    release(false);
    const figure = event.currentTarget;
    const box = figure.getBoundingClientRect();
    const tilt = Math.max(-.6, Math.min(.6, ((event.clientX - box.left) / box.width - .5) * 1.2));
    pressed = { figure, id: event.pointerId, x: event.clientX, y: event.clientY };
    figure.classList.add('photo-is-pressed');
    play(figure, [{ transform: getComputedStyle(figure).transform }, { transform: `scale(.972) rotate(${tilt}deg)` }], {
      duration: 110, easing: 'ease-out', fill: 'forwards'
    });
  };
  const move = event => {
    if (pressed?.id === event.pointerId && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 10) release(false);
  };
  const up = event => { if (pressed?.id === event.pointerId) release(event.type === 'pointerup'); };
  const reset = () => {
    pressed?.figure.classList.remove('photo-is-pressed');
    pressed = null;
    figures.forEach(figure => figure.getAnimations().forEach(animation => animation.cancel()));
    animations.clear();
  };
  figures.forEach(figure => {
    figure.classList.add('story-photo-bubble');
    figure.addEventListener('pointerdown', down, { passive: true });
  });
  // No capture or preventDefault: a swipe starting on a photo still scrolls.
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('pointercancel', up, { passive: true });
  window.addEventListener('blur', reset);
  reduced.addEventListener('change', reset);
  return () => {
    reset();
    figures.forEach(figure => figure.removeEventListener('pointerdown', down));
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('blur', reset);
    reduced.removeEventListener('change', reset);
  };
}

// Photo and caption move as one unit. Content is visible even before this
// enhancement runs, and entrances never replay during tab or account updates.
function bindStoryMotion(root) {
  removeStoryMotion?.();
  const figures = [...root.querySelectorAll('.hack-hero-shot, .workshop-photo, .workshop-search-photo, .workshop-outlook figure')];
  if (!figures.length || !globalThis.IntersectionObserver) return;
  const compact = matchMedia('(max-width: 680px), (max-width: 900px) and (max-height: 500px) and (pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const removePhotoPress = bindPhotoPress(figures, reduced);
  const animations = new Set();
  let observer;
  let generation = 0;
  const update = () => {
    const current = ++generation;
    observer?.disconnect();
    animations.forEach(animation => animation.cancel());
    animations.clear();
    if (!compact.matches || reduced.matches) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const figure = entry.target;
        const img = figure.querySelector('img');
        const key = img?.getAttribute('src');
        observer.unobserve(figure);
        if (!key || enteredPhotos.has(key)) continue;
        enteredPhotos.add(key);
        const enter = () => {
          const box = figure.getBoundingClientRect();
          if (current !== generation || !figure.isConnected || box.bottom <= 0 || box.top >= innerHeight || figure.getAnimations().length) return;
          const animation = figure.animate(
            [{ transform: 'translateY(16px)' }, { transform: 'translateY(0)' }],
            { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' }
          );
          animations.add(animation);
          animation.finished.catch(() => {}).finally(() => animations.delete(animation));
        };
        if (img.complete && img.naturalWidth) enter();
        else img.decode().then(enter).catch(() => {});
      }
    }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    figures.forEach(figure => observer.observe(figure));
  };
  update();
  compact.addEventListener('change', update);
  reduced.addEventListener('change', update);
  removeStoryMotion = () => {
    removePhotoPress();
    generation++;
    observer?.disconnect();
    animations.forEach(animation => animation.cancel());
    compact.removeEventListener('change', update);
    reduced.removeEventListener('change', update);
  };
}

// Keep focus and reading order aligned with the compact visual order.
function bindStoryLayout(root) {
  removeStoryLayoutListener?.();
  if (!root.querySelector('.workshop-story')) return;
  const compact = matchMedia('(max-width: 680px)');
  const sections = [...root.querySelectorAll('.workshop-hardware, .workshop-phase')].map(chapter => ({
    chapter, copy: chapter.querySelector('.workshop-copy'), details: [...chapter.querySelectorAll('.workshop-depth')]
  }));
  const arrange = () => sections.forEach(({chapter, copy, details}) => details.forEach(detail => (compact.matches ? chapter : copy).append(detail)));
  arrange();
  compact.addEventListener('change', arrange);
  removeStoryLayoutListener = () => compact.removeEventListener('change', arrange);
}

// One dot per state. Brightness is illustrative; the numeric readout is the probability.
function drawGroverField(canvas, probability) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const p = probability / 100;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const targetColumn = 64, targetRow = 16;
  const otherOpacity = .48 * Math.sqrt((1 - p) / (1 - 1 / 4096));
  ctx.fillStyle = `rgba(169,213,255,${otherOpacity})`;
  ctx.beginPath();
  for (let row = 0; row < 32; row++) for (let column = 0; column < 128; column++) {
    if (column === targetColumn && row === targetRow) continue;
    const x = 3 + column * 6, y = 51 + row * 6;
    ctx.moveTo(x + 1.2, y); ctx.arc(x, y, 1.2, 0, Math.PI * 2);
  }
  ctx.fill();
  const x = 3 + targetColumn * 6, y = 51 + targetRow * 6;
  const strength = Math.sqrt(p);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 36);
  glow.addColorStop(0, `rgba(169,213,255,${.65 * strength})`);
  glow.addColorStop(1, 'rgba(169,213,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 36, y - 36, 72, 72);
  ctx.beginPath(); ctx.arc(x, y, 1.2 + 5 * strength, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(205,232,255,${.48 + .52 * strength})`; ctx.fill();
  ctx.strokeStyle = '#a9d5ff80'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
  canvas.setAttribute('aria-label', `4,096 states; target 1 has ${probability < .001 ? 'less than 0.001' : probability.toFixed(3)} percent probability`);
}

export function bindWorkshopStories(root = document) {
  bindStoryLayout(root);
  bindStoryMotion(root);
  const toggle = root.querySelector('[data-apply-h]');
  toggle?.addEventListener('click', () => {
    const applied = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(applied));
    toggle.textContent = applied ? 'Remove H' : 'Apply H to both';
    root.querySelectorAll('[data-phase-gate]').forEach(gate => { gate.textContent = applied ? 'H' : '—'; });
    for (const [input, zero, one, output] of [['plus', 100, 0, '|0⟩'], ['minus', 0, 100, '|1⟩']]) {
      root.querySelector(`[data-phase-state="${input}"]`).textContent = applied ? output : input === 'plus' ? '|+⟩' : '|−⟩';
      const bars = root.querySelector(`[data-phase-bars="${input}"]`);
      const values = applied ? [zero, one] : [50, 50];
      bars.setAttribute('aria-label', `${input === 'plus' ? 'Plus' : 'Minus'} input: zero ${values[0]} percent, one ${values[1]} percent`);
      bars.querySelectorAll('b').forEach((bar, i) => { bar.style.width = `${values[i]}%`; });
      bars.querySelectorAll('strong').forEach((label, i) => { label.textContent = `${values[i]}%`; });
    }
    root.querySelector('[data-phase-explanation]').innerHTML = applied ? 'The signs become different outcomes<br>That is interference at work' : 'Same measurement odds<br>A different relative sign';
  });
  const rounds = root.querySelector('#grover-rounds');
  const field = root.querySelector('[data-grover-field]');
  if (rounds) drawGroverField(field, 100 * Math.sin((2 * Number(rounds.value) + 1) * Math.asin(1 / 64)) ** 2);
  rounds?.addEventListener('input', () => {
    const count = Number(rounds.value);
    const probability = 100 * Math.sin((2 * count + 1) * Math.asin(1 / 64)) ** 2;
    drawGroverField(field, probability);
    root.querySelector('#grover-probability').textContent = probability < 0.001 ? "<0.001%" : `${probability.toFixed(3)}%`;
    root.querySelector('#grover-round-label').textContent = `${count} ${count === 1 ? 'round' : 'rounds'}`;
    root.querySelector('#grover-explanation').textContent = count === 0 ? 'Before amplification: one chance in 4,096' : count < 48 ? 'The target grows more likely as amplitudes interfere' : count <= 52 ? 'Near the first peak—keep going and the probability falls again' : 'Past the peak: extra rounds undo the amplification';
  });
}
