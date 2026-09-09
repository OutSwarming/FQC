// The public hackathon landing page. Its inline styles keep this campaign layout
// self-contained while reusing the app's established color and type tokens.
export function renderHackathonLanding({ photo, cta, interested, error }) {
  return `<section class="hackathon-draft" data-screen="hackathon" aria-labelledby="discovery-title">
    <style>${draftStyles}</style>
    <header class="draft-intro">
      <div>
        <h2 id="discovery-title">FQC Drug Discovery Hackathon</h2>
        <p class="draft-lead">Apply quantum computing to problems in drug discovery while learning how to optimize quantum algorithms.</p>
        <p>Bring your curiosity and work with other students to try different approaches. There’s room to question the obvious solution, test an unexpected idea, and learn from each other.</p>
        ${cta}
        ${interested
          ? '<p class="draft-account-note" role="status">Your interest is saved to your FQC account. Final registration will follow.</p><button class="hack-cancel" type="button" id="cancel-hackathon-interest">Remove my interest</button>'
          : '<p class="draft-account-note">Join with your FQC account. Your interest is linked to your account email; this isn’t final registration.</p>'}
        ${error ? `<p class="hack-interest-error" role="alert">${error}</p>` : ''}
      </div>
      <figure class="hack-hero-shot draft-photo">${photo('full-room-clear', 'FQC members sharing ideas and working at laptops during a club session', true)}<figcaption>Students working together at an FQC workshop</figcaption></figure>
    </header>
    <section class="draft-approach" aria-labelledby="draft-approach-title">
      <h3 id="draft-approach-title">What we’re putting together</h3>
      <p>We’re planning a team challenge with a guided starting point, time to experiment, and help along the way. You’ll explore how a quantum algorithm works, look for ways to improve it, and share what you find.</p>
      <p>Creativity matters here. A useful question or a different way of approaching the problem can be just as valuable as getting the code to run.</p>
      <details class="draft-depth"><summary>What kind of quantum algorithm? <span aria-hidden="true">+</span></summary><div><p>We’re exploring a variational quantum eigensolver (VQE) as a starting point. It pairs a quantum circuit that estimates an energy with a classical optimizer that adjusts the circuit and tries again.</p><p>The exact challenge, format and support are still being confirmed. We’ll share those details when they’re ready.</p></div></details>
    </section>
  </section>`;
}

const draftStyles = `
.hackathon-draft { padding: 36px clamp(20px,4vw,48px) 30px; background: var(--surface); border: 1px solid var(--line); border-radius: 24px; }
.draft-intro { display: grid; grid-template-columns: 1.1fr 1fr; gap: 42px; align-items: center; }
.hackathon-draft h2 { margin: 0 0 22px; max-width: 18ch; font-family: inherit; font-size: clamp(2rem,4vw,3.5rem); font-weight: 650; line-height: 1.1; letter-spacing: -.045em; text-wrap: balance; }
.hackathon-draft p { color: var(--muted); font-size: .98rem; line-height: 1.7; margin: 0 0 16px; }
.hackathon-draft .draft-lead { color: var(--ink); font-size: 1.12rem; line-height: 1.6; }
.hackathon-draft .hack-cta { margin-top: 4px; min-height: 48px; background: var(--accent-strong); color: white; }
.hackathon-draft .hack-cta:disabled { cursor: default; }
.hackathon-draft .draft-account-note { font-size: .79rem; line-height: 1.6; margin: 12px 0 0; max-width: 380px; }
.draft-photo { background: var(--surface-soft); }
.draft-photo img { aspect-ratio: 1.1; object-position: 58% center; }
.draft-photo figcaption { padding: 14px 16px; color: var(--muted); font-size: .75rem; line-height: 1.5; }
.draft-approach { border-top: 1px solid var(--line); margin-top: 36px; padding-top: 28px; }
.draft-approach h3 { color: var(--ink); font-size: 1.4rem; font-weight: 600; letter-spacing: -.025em; margin: 0 0 18px; }
.draft-approach > p, .draft-depth > div { max-width: 740px; }
.draft-depth { margin-top: 24px; border-block: 1px solid var(--line); }
.draft-depth summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 60px; padding-block: 12px; font-size: .92rem; font-weight: 550; }
.draft-depth summary::-webkit-details-marker { display: none; }
.draft-depth summary span { color: var(--accent-strong); font-size: 1.4rem; }
.draft-depth[open] summary span { transform: rotate(45deg); }
.draft-depth summary:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 3px; border-radius: 8px; }
.draft-depth > div { padding-bottom: 4px; }
@media(max-width:680px) {
  .hackathon-draft { padding: 26px 20px; }
  .draft-intro { grid-template-columns: 1fr; gap: 26px; }
  .hackathon-draft h2 { font-size: clamp(1.9rem,8.1vw,2.8rem); margin-bottom: 18px; }
  .hackathon-draft .draft-lead { font-size: 1.04rem; }
  .hackathon-draft p { font-size: .94rem; }
  .draft-photo img { aspect-ratio: 1.5; }
  .draft-approach { margin-top: 26px; padding-top: 24px; }
}
@media(max-height:500px) and (pointer:coarse) {
  .hackathon-draft { padding-bottom: 120px; }
}
`;
