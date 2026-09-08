# Hackathon landing page photos

Photos supplied from the FQC club Drive, retrieved September 7, 2026. No sharing settings were changed.

Root: https://drive.google.com/drive/folders/1FlpeVX-V9-3WEw3CNhtz4cfXxfwo3oi6

- `community-*.webp`: SPRING 2026 PHOTOS / IonQ Speaker / 20260303_163716.jpg. Drive file `19v0G5OPrCdqP5ANT8gorv-JVmnvwM7ih`.
- `meeting-*.webp`: SPRING 2026 PHOTOS / GBM 2 / GBM-2-1.jpeg. Drive file `1tvhUaD-6IjhAtkYI9m9Nu9QquwFXEsu_`.

Images resized to 800 and 1600 pixels wide and converted to WebP. Layout cropping happens in CSS. These show past club activities, not the upcoming hackathon.

## Release 2.21.0 source review

Reviewed the signed-in FQC Drive account on September 7, 2026. The new landing uses these four photographs, visually verified before conversion:

- `sign-*.webp`: End of Year Social, April 2026; five members with FQC banner. File `1HiD1brFUJLcX2tCuyT8ffW5sqIHgkUlC`, IMG_20260421_182039768_HDR.jpg
- `spring-*.webp`: GBM 1, January 20, 2026; Spring 2026 GBM 1 1-20-26.jpeg. File `1rfXtBBlGLiVkwNqKeTRMt_rzzOQVoOE1`
- `photonics-*.webp`: Photonics Speaker, April 7, 2026; audience and NV-based quantum sensing slide. File `1lYdW7iW4FCfziDKA2dNabJeSD3Dlkx_H`
- `social-*.webp`: End of Year Social, April 2026; food, members in FQC shirts, and Stratego. File `1Dlqu5qxn_tsaIOjItfJB8LmQ0zMcJhNa`

### Copy evidence

- **FQC GBM 1 Spring 2026 slides.pdf**, January 20, 2026, page 5: describes FQC as the first quantum computing club at UF. Page 6: accessible hands-on learning and interdisciplinary education. Page 11: quantum control fundamentals and Quirk/circuit workshop plans. The user also explicitly supplied the ground-up founding story.
- **FQC_Workshop_1, for presenting.pdf**, “QUIRK and Quantum Circuits”, Daniel Takshi and Alex Heard, March 24, 2026, pages 29–33: asks members to place an X gate, test |0⟩ and |1⟩, switch to |+⟩, and explain why X|+⟩ = |+⟩. This directly grounds the landing’s technical exercise and attribution.
- **Photonics Speaker** April 7 album: the photographed slide is “Untapped Potential of NV-Based Quantum Sensing”, with diamond/NV-center diagrams and sensing limitations. No commercial partnership or hardware access inferred.
- The social photo visibly includes a Stratego box, grounding the social caption.

The upcoming hackathon is described only as upcoming with an interest list. Dates, venue and challenges remain unannounced; no prizes, sponsors, hardware access or confirmed places are promised.

## Release 2.21.1 photography

The user supplied three unique additional photos (the second and third attachments are byte-identical). Their event names/dates are unconfirmed, so the new captions identify only visible activities. `full-room-enhanced` replaces the smaller spring kickoff photo. `workshop-room-enhanced` and `conversation-enhanced` add two complementary views. The sign, photonics and spring social photos remain, with light corrections.

The built-in image editor was tried and rejected because it altered faces and lettering. The user then explicitly approved standard photo corrections. All shipped edits use the original pixels through Pillow: ceiling/floor crops, modest black-point/gamma correction, white balance, saturation, and restrained sharpening. No generated images are deployed. Originals, seven full-resolution edited JPEGs, and a before/after contact sheet are saved under `output/club-photos/`. The adjustments are reproducible with `scripts/prepare-club-photos.py`. Each website photo uses a distinct versioned `*-enhanced-*` URL and responsive 800/1600-pixel WebP files.

## Release 2.22.0: one connected quantum story

Drive sources revisited through the signed-in FQC account on September 7, 2026:

- **Fall 2025 GBM 1 (pdf)**, Google Slides `1cY_y-BSK8QAKardVpWwE2Jn1_KCAdK7m5LcLICTCUlE`, slide 17: the initial roadmap paired a theory workshop (1a) with a programming workshop (1b). The copy describes the roadmap rather than claiming every planned event occurred.
- **8/11/2026**, Google Doc `1soZbE2IfBmn_wVg4QoK9I9yylqkNhCfn1mPnCJD0iqU`: summer planning for a drug discovery optimization hackathon, teaching quantum/AI, HiPerGator and drug-discovery libraries before building a solution.
- **UF 2027 Hackathon**, Google Doc `1Q4sjOD96t7P8NfF37MNfDXVkUIY1V89uA13-b6-vws8`: proposed AI/quantum optimization event, workshop/bootcamp structure, biochemistry/drug discovery direction. This contains inconsistent proposed dates and conditional sponsorship/computing allocation, so none is presented as confirmed.
- **Sponsorship Content - Hackathon 2027**, Google Doc `1dObTEpHCThtlNb9lGPi5BGVe5qE5HInznMH_Vq0iXmQ`: draft theme Drug Discovery Optimization; molecular screening/protein binding; contemplated CUDA-Q and HiPerGator. Projected attendees, prizes, companies and dates are omitted. The page explicitly labels the hackathon in development and says the tools are being explored.
- The earlier March 24 Quirk workshop and April 7 photonics photos remain the source for the X-gate example and nitrogen-vacancy sensing. The two X gates are independent examples, not an entangled circuit. Decorative state marks, vacancy motif and molecular linework connect the narrative without implying experimental results.

Photo refinement uses a spatial dark-channel estimate to reduce the gray lens veil, plus modest white balance, local contrast and output sharpening. It uses original pixels, with no generated faces/text. Full-room and conversation exports are downsampled from the supplied larger originals to a 3840-pixel long edge; the tighter workshop portrait crop is resampled to the same export size. This does not recover detail absent from the source. Web images have new `*-clear-*` URLs at 800, 1600 and 2400 pixels.

The landing now uses four purposeful photos: sign, laptops, sensing talk, full room. The pizza/Stratego detour is removed. Three refined user-supplied photos and a before/after sheet are in `output/club-photos/clear-4k/`.
