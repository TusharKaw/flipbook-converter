# Vidhan Chetna flipbook

A minimal, responsive flipbook of all 208 pages of the August–October 2026 edition. The interface contains only the pages and a floating navigation toolbar.

- Drag a page corner with a mouse or finger; quick touch swipes also turn pages.
- A subtle paper rustle plays during turns after the first user interaction.
- Desktop uses two-page spreads; phones use a single page.
- Use the toolbar, arrow keys, Home/End, or enter a page number.
- Reading progress is saved locally. A URL ending in `#page=72` opens that page.
- Upcoming pages are preloaded and distant decoded images released to limit memory.
- Click **Audio Book** on the right of the toolbar to narrate from the displayed page. Starting on the cover opens page 2 first. Narration continues through both pages of desktop spreads, turns to the next spread automatically, and stops at the end. Click again to stop; navigating manually switches narration to the destination.
- Narration uses your browser/device's text-to-speech voices, selecting Hindi or English for each passage. Install a Hindi voice in your device's speech settings if needed. Voice quality and background playback depend on the browser and device.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The `dist/` folder is a static site and can be hosted on any static web host. Relative asset paths support subdirectory hosting.

## Convert a PDF again

The optimized page images are already included. To regenerate them, install Poppler (`brew install poppler` on macOS) and run:

```sh
npm run convert -- "/absolute/path/to/document.pdf"
```

The original 137 MB PDF is kept outside this repository. The converter produces 2000-pixel WebP pages and a book manifest in `public/book/`. Edit the manifest's display metadata and dimensions if using a different document.

Page-turn rendering uses StPageFlip (MIT). Audio uses the supplied `freesound_community-one-page-book-flip-101928.mp3` recording, served locally as `public/audio/page-flip.mp3` and played through the Web Audio API. Page images preserve the supplied publication. They are image-based, so the original PDF's selectable text and links are not interactive in this viewer.

## Audiobook text

`public/book/narration.json` contains the narration text in page order. It was extracted locally from the existing images with Hindi/English OCR, so recognition and reading-order errors can occur, especially on decorative pages and tables. Edit the page strings to proofread narration without changing the page images.

After replacing the book images, regenerate narration with Tesseract and its Hindi/English language data installed:

```sh
npm run extract-narration
```

Regenerate narration after PDF conversion before building the site. No speech API key or runtime OCR download is required.
