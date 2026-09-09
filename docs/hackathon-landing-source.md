# Hackathon landing page · September 8, 2026

## September 9 organizer review

The announcement has been withdrawn pending confirmation with Daniel. Public Hackathon routes show only “More details coming soon,” without dates, format, promises, or an interest button. Existing interest records are preserved.

The revised draft is saved in `drafts/hackathon/landing.js`. It is available only through the local Vite development server at `/hackathon?preview-hackathon=1`. `import.meta.env.DEV` removes the renderer and draft styles from production builds; the query parameter does not enable it on the live site.

The draft now opens with “FQC Drug Discovery Hackathon,” explains applying quantum computing to drug-discovery problems and optimizing quantum algorithms, and emphasizes student collaboration and creative approaches. Standard system typography, theme-aware surfaces and a real workshop photo replace the slogan-driven presentation. Dates and resource commitments await confirmation.

Interest email behavior: `hackathonInterest/{uid}` stores `uid`, `eventId`, `interested`, and `updatedAt`. The UID links to the member’s account/profile email; no email is copied into the interest record and saving interest does not send an email. Current rules permit only the member or an officer to read the interest record. Account deletion removes the record.

The original launch notes below describe the withdrawn September 8 release.

Source: [UF 2027 Hackathon](https://docs.google.com/document/d/1Q4sjOD96t7P8NfF37MNfDXVkUIY1V89uA13-b6-vws8/edit), read through the club’s signed-in Google Docs session. The connected Drive account did not have access. The document was not edited.

The public page summarizes the drug discovery theme, AI/quantum optimization, HiPerGator, a guided VQE start, asynchronous team coding, workshops, office hours, and demo day. It preserves the early-announcement nature of the brief. Interest uses the existing per-account interest flow; it does not reserve a team or confirm event registration.

Date choice: the opening paragraph says 2026, but the document title and explicit Event Scope & Logistics section identify February 1–13, 2027 as tentative. The page uses the latter with a visible tentative label. Confirm before final registration.

Internal resource costs, account provisioning, proposed capacity and possible partner involvement are not presented as public commitments. The page adds no venue, prize value, confirmed sponsor, quantum advantage claim, or promised drug discovery outcome.

The compact VQE explanation was checked against [IBM Quantum’s VQE tutorial](https://learning.quantum.ibm.com/tutorial/variational-quantum-eigensolver). The styling reuses the app’s semantic light/dark palette and About typography, with [Apple’s color guidance](https://developer.apple.com/design/human-interface-guidelines/color) informing control contrast. No About layout or existing event behavior is changed.

Photo: existing `full-room-clear` assets, showing an FQC club session, not a past edition of this hackathon. Captions identify it as the workshop room.

Validation: responsive light/dark layouts, expandable technical details, interest sign-in/signup return flow, account isolation, withdrawal, and save-error/retry behavior. Phone tests cover WebKit iPhone SE, iPhone 13, large iPhone and landscape, plus Chromium Pixel; desktop checks cover 900px and 1366px widths. These are browser emulations, not physical-device tests.
