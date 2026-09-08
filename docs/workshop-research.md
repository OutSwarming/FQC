# FQC workshop research and landing narrative — 2.23.0

Reviewed September 7, 2026 through the signed-in Florida Quantum Computing Society Drive account. The connector could not access the supplied folder, so the original files were read through the authorized Chrome session. No sharing permissions were changed and no notebook code was executed. This is an evidence and editorial record, not public landing copy.

## What the archive actually contains

### Hardware: an oscillator before a qubit

Source: **Superconducting Arcitecture Fundamentals**, internally titled **Quantum Superconducting Hardware**, Alex Heard. [Original deck](https://docs.google.com/presentation/d/14m2FmoRRAPUXYRUclE1DY2TYqjnme0xokrBj_37YNgk/edit), 19 slides, in Workshops / Spring 2026 / Workshop 1. Read the complete HTML presentation including embedded exercise text. The nearby **Quantum Control w/ IEEE Draft** was identified but not used as evidence of a confirmed partnership.

The distinctive teaching move is to begin with a classical circuit students can construct. Slide 5 specifies an AC source, 1 H inductor, 10 μF capacitor and 100 Ω resistor in Falstad. Slide 6 asks students to change the time step to 781.25 μs, add a 1 Hz–1 kHz frequency slider, and observe the resistor voltage on a scope. They find resonance experimentally before checking the equation. Slide 7 gives 50.3 Hz and asks for the capacitance associated with a 10 pH inductor at 5 GHz.

The analytical values are f₀ = 1/(2π√LC) = 50.3292 Hz and C = 1/((2πf)²L) = 101.321 pF for the stated scale-jump exercise. These are ideal lumped-element calculations; the 50 Hz simulator is not itself a qubit and the 10 pH example is not a device specification.

Slides 10–15 move through Josephson junctions, transmons, anharmonic energy levels, leakage beyond the computational states and microwave control/Rabi rotation. This is the real narrative connection: the resonance experiment supplies an intuitive starting point, then the quantum device requires unequal transition frequencies to address the lowest two levels selectively. Slides 16–18 add noise, cooling and the surrounding circuitry.

Technical expansion was checked against [Koch et al., original transmon paper](https://arxiv.org/abs/cond-mat/0703002) and [Blais et al., Circuit Quantum Electrodynamics](https://arxiv.org/abs/2005.12667). Avoid reproducing the deck's broad “only component” wording or simplified coin analogy as rigorous physics. The site explains the useful mechanism and its limit instead.

### Quirk: measurement odds hide a relative sign

Source: **FQC_Workshop_1, for presenting.pdf**, internally **QUIRK and Quantum Circuits**, Daniel Takshi and Alex Heard, March 24, 2026. [Original PDF](https://drive.google.com/file/d/15jYSE3L52KD15QfWVLBuLZJBE-mk4Uz0/view), 44 pages, in Spring 2026 / Workshop 3. Many pages are incremental presentation builds. Read the foundational, display, X, Z/H, reference and final-challenge sequences through the PDF viewer. Do not infer the event number from the filename: the parent folder is Workshop 3.

Pages 7–9 introduce complex amplitudes and their squared magnitudes as measurement probabilities. Pages 13–20 ask participants to change the input among |+⟩, |−⟩ and the imaginary-phase states and compare Quirk's Amps and Chance displays. Pages 26–34 ask why X swaps |0⟩ and |1⟩ but leaves |+⟩ unchanged, then extend the question to |−⟩. Pages 37–43 explore Z and H, repeated operations, and whether order matters.

The page's two-row H demonstration combines these actual exercises into a short self-contained interaction. Before H, both states yield equal probabilities in the computational basis. After H, |+⟩ yields |0⟩ and |−⟩ yields |1⟩. The beginner sees two different outcomes; the deeper reader sees relative phase and interference. This is a website adaptation, not a screenshot of an experiment performed on hardware.

The hidden second layer is the distinction between relative and global phase: X|−⟩ = −|−⟩ does not make an independently observable change. For an input (a,b), H produces ((a+b)/√2,(a−b)/√2). Applying this to (1,±1)/√2 verifies the displayed probabilities exactly.

Page 44 is unusually good material for inviting participation: construct |0⟩ → |−⟩ and its inverse; compare X², Z² and H²; predict two square-root-X gates; prove no quantum gate maps every possible input to |0⟩; derive constraints on a gate's coefficients. The site surfaces the first and impossible-reset challenges. Its expansion explicitly restricts the impossibility to unitary gates: orthogonality and reversibility forbid that many-to-one map, while physical non-unitary reset remains possible.

Quirk's [original simulator](https://algassert.com/quirk) and [author's repository](https://github.com/Strilanc/Quirk) establish the actual tool rather than substituting another product. Mathematical explanations here are independently derived from the stated gate actions.

### SwampHacks: change the question asked of a black box

Source: **FQC_Workshop_0.pdf**, internally **Quantum Computing — The 2-bit equivalency problem**, Daniel Takshi, SwampHacks XI, January 2026. [Original PDF](https://drive.google.com/file/d/1yQjmuqbZC-ejFBs9ZggCcH8A2dk8w9Mv/view), 67 pages, in Spring 2026 / Swamphacks Workshop. Inspected the opening and black-box, quantum-oracle, answer-qubit and solution sequences, including their diagrams. Numerous pages are incremental builds, not 67 independent lessons.

The problem asks whether two secret bits are equal. The classical box returns one selected bit. The quantum version preserves the test input and XORs a function value into the answer qubit. Slides 54–58 choose an answer proportional to |0⟩ − |1⟩, so NOT returns its negative. Slides 63–65 group 00 with 11 and 01 with 10. This is phase kickback and the structure of Deutsch's algorithm.

The deck omits normalization for readability and leaves the full measurement construction to its linked references. The site uses normalized |+⟩ and |−⟩ and explains the final H explicitly, checked against [IBM's Deutsch derivation](https://quantum.cloud.ibm.com/learning/en/courses/fundamentals-of-quantum-algorithms/quantum-query-algorithms/deutsch-algorithm). The one-versus-two comparison applies to oracle queries for a certain answer, not elapsed runtime, and does not imply recovery of both secret bits. This expansion makes the club's lesson understandable without claiming the extra explanation was verbatim in the deck.

### Grover: the hidden programming notebook

Source: **Grover's Algorithm Solution.ipynb**, [original Colab notebook](https://colab.research.google.com/drive/1kpuFlaUfZtcbNLRY-M5z8LV1HrRMYNBs), found under Workshops / Fall 2025 / Colab Notebooks. Read both code cells and expanded the stored output. The folder is not reliable evidence of the last execution date: saved package output shows Qiskit 2.3.0. No date or named notebook author is assigned on the site.

Exact settings: `n_bits = 12`, `target = 1`, N = 4096, `int((pi/4)*sqrt(N)) = 50` iterations, `AerSimulator`, 200,000 shots. The recorded result is `Most frequent: 1 (bits 000000000001)(frequency 199987)` and `Target: 1`.

The custom controlled-Z is H–MCX–H on the final data qubit. The oracle X-maps zero positions of the target to an all-ones control pattern, applies the phase mark, then reverses the X mapping. The diffuser uses H, X, the phase operation, X, H. The prepared uniform superposition passes through 50 oracle/diffuser pairs before measurement. A potentially misleading comment in the source about repeating MCX is not carried over: the code appends one multi-controlled operation at that point. Its diffuser differs from a common convention by an irrelevant overall phase.

The page reports the stored counts as a simulator result with a deliberately encoded target. It does not turn it into a hardware benchmark, real database discovery or claim that 50 iterations equals 50 elementary gates. The local interactive extension uses the exact ideal one-marked-item formula P(r) = sin²((2r+1)arcsin(1/√N)), checked against [IBM's analysis](https://quantum.cloud.ibm.com/learning/en/courses/fundamentals-of-quantum-algorithms/grover-algorithm/analysis) and [Grover's original paper](https://arxiv.org/abs/quant-ph/9605043). At zero iterations the probability is 1/4096; near 50 it peaks; continuing towards 100 largely undoes the amplification. This illustrates why stopping rules matter. The slider has no backend calls, quantum-job costs or analytics writes.

## Other sources and boundaries

- **Workshop 1 Draft**, Alex Heard, [12-slide fall draft](https://docs.google.com/presentation/d/1cPA-K-9vDZQp2dD76xUoFw11855uSqELYhw8kmKYnZ0/edit): read fully. Contains introductory gates, hardware alternatives, algorithm/application categories and a proposed HardHAQ partnership. Treat as a draft; do not publish the proposed partnership as established or repeat “check many possibilities at once” as a full explanation of Grover.
- **FQC Workshop 2 Spring 2026 slide.pdf** is only a two-page sign-in/social welcome, not the missing technical workshop. Identified and excluded from technical evidence.
- The photonics photograph visibly shows NV-based quantum sensing and its limitations. The final strip retains that grounded topic; it does not imply members fabricated diamond sensors.
- Hackathon planning sources and unconfirmed dates/access remain documented in `hackathon-photo-sources.md`. The planned molecular focus is a destination, not a claim that these exercises already solved drug discovery.

## Narrative and UI decisions

Use [Huthwaite's SPIN principles](https://www.huthwaiteinternational.com/blog/spin-selling-questions) as editorial scaffolding, not visible labels or a scripted pitch. Situation: a curious UF student with no prior club to enter. Problem: a diagram or probability bar alone does not explain the machine. Implication: ignoring resonance, phase or the stopping point leads to the wrong operation or result. Need/payoff: try, inspect, explain and then tackle a problem alongside other members.

The order is conceptual rather than chronological: hardware → state → algorithm → application. Label actual dates where confirmed, and never pretend these distinct events were a single day. “Frequency” works as both resonance and finding people to learn with; “same odds, different story” is both relative phase and the hidden depth of the club; “make one answer stand out” ties phase to the search code. The one-photonics strip widens the destination without turning the page into a generic topic catalog.

Keep four original photos: the club-built sign, a room at laptops, the larger collaborative room, and the actual sensing slide. The two supplied crowded-room images have unconfirmed dates and receive generic session captions. Their placement supports the story without labeling them as the specific pictured workshop. No synthetic scenes or invented participant quotes are used.

The public page provides three depths: brief headlines and photographs; one small phase interaction; native expandable technical notes and the optional Grover control. Deeper content is keyboard accessible and initially collapsed. No extra bottom navigation, autoplay animations, scroll hijacking or account requirement for learning.
