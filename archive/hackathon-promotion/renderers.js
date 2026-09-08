// Archived September 8, 2026 before removing the public hackathon promotion.
// These renderers use the existing app helpers and state; not imported by the app.
function renderAbout() {
  return `
    <section class="hackathon-landing" data-screen="about">
      <header class="hack-hero">
        <div class="hack-eyebrow"><span class="hack-live-dot"></span> FLORIDA QUANTUM COMPUTING</div>
        <span class="hack-state-mark" aria-hidden="true">|0⟩</span>
        <div class="hack-hero-grid">
          <div><h2>We started<br>from <em>zero</em></h2><p class="hack-origin"><strong class="hack-reader">You can too</strong><br>UF had no quantum club, so we built a place to start together</p><a class="hack-outline-link" href="#hackathon-interest">Explore the hackathon <span aria-hidden="true">↗</span></a></div>
          <figure class="hack-hero-shot">${hackathonPhoto('sign-enhanced', 'Five FQC members beside the club banner at the spring 2026 end-of-year social', true)}<figcaption>Built by students · Open to every major</figcaption></figure>
        </div>
        <div class="hack-hero-footnote"><span>UF’S FIRST QUANTUM COMPUTING CLUB</span><span aria-hidden="true">|0⟩ ── H ── |+⟩</span></div>
      </header>
      ${renderWorkshopStories(hackathonPhoto)}
      <section class="hack-intro hack-build-card" id="hackathon-interest" aria-labelledby="hackathon-title">
        <div><p class="hack-kicker">FQC HACKATHON / IN DEVELOPMENT</p><h2 id="hackathon-title">Your turn<br> to <em>build</em></h2><div class="hack-molecule" aria-hidden="true"><svg viewBox="0 0 210 78"><g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 24 44 10 68 24 68 52 44 66 20 52Z M68 24 92 10 116 24 116 52 92 66 68 52 M116 24 145 24 164 44 192 44 M27 28 44 18 M60 29 60 48 M28 49 44 58"/></g><circle cx="164" cy="44" r="4" fill="currentColor"/></svg></div></div>
        <div class="hack-intro-copy"><p>The next problem is molecular<br> Put quantum + AI to work on drug discovery</p><p class="hack-detail">Molecular screening · Protein binding<br>Exploring CUDA-Q and HiPerGator</p>${hackathonCta()}${state.hackathonInterested ? '<p class="hack-interest-status" role="status">Your interest is saved to your FQC account. Final registration details will follow.</p><button class="hack-cancel" type="button" id="cancel-hackathon-interest">Remove my interest</button>' : '<p class="hack-small">Sign in or create an FQC account to save your interest</p>'}${state.hackathonError ? `<p class="hack-interest-status hack-interest-error" role="alert">${escapeHtml(state.hackathonError)}</p>` : ""}</div>
      </section>
      <section class="hack-faq" aria-labelledby="hack-faq-title"><div><p class="hack-kicker">BEFORE YOU JOIN</p><h2 id="hack-faq-title">A few <em>details</em></h2></div><div class="hack-questions"><details><summary>What’s confirmed?</summary><p>The hackathon is in development<br>Dates, venue, challenges and computing access will be confirmed before registration</p></details><details><summary>Does this reserve my spot?</summary><p>This saves your interest, not a confirmed place<br>Final registration details will follow</p></details><details><summary>New to FQC?</summary><p>Create an account with your UF email<br>We’ll bring you back here and save your interest</p></details></div></section>
      <footer class="hack-story-footer"><span aria-hidden="true">|ψ⟩</span><p>The next state<br><em>includes you</em></p><small>FLORIDA QUANTUM COMPUTING<br>UNIVERSITY OF FLORIDA</small></footer>
    </section>`;
}

function renderHackathon() {
  return `<section class="hackathon-landing hackathon-preview" data-screen="hackathon">
    <header class="hack-hero">
      <div class="hack-eyebrow"><span class="hack-live-dot"></span> FQC HACKATHON</div>
      <span class="hack-state-mark" aria-hidden="true">|ψ⟩</span>
      <h2>Your turn<br>to <em>build</em></h2>
      <p class="hack-origin">More details coming soon</p>
      ${hackathonCta()}
      ${state.hackathonInterested ? '<p class="hack-small" role="status">Your interest is saved</p><button class="hack-cancel" type="button" id="cancel-hackathon-interest">Remove my interest</button>' : '<p class="hack-small">Save your interest with your FQC account</p>'}
      ${state.hackathonError ? `<p class="hack-interest-status hack-interest-error" role="alert">${escapeHtml(state.hackathonError)}</p>` : ""}
    </header>
  </section>`;
}

