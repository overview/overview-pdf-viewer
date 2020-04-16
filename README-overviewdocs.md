This fork is meant to be run within [https://github.com/overview/overview-server](Overview).

# Overview-specific features:

## Slimmer toolbar

Many features are removed (such as print, download, and "attachments" sidebar)
because:

* Overview provides the same features.
* Overview restricts the area of the PDF viewer. (The PDF iframe is only about
  a third the size of the browser tab.)
* Overview doesn't want to distract the user with endless PDF-viewing features.

The "open/close sidebar" toggle in the toolbar is hidden, but the feature still
exists. Overview presents its own interface for toggling sidebar visibility.

## PDF Notes

Given a `noteStoreApiCreator` function, exposes a note-creation interface:

* Click "Add Note", then click-and-drag on the document to open a dialog and
  add a note. Notes, `{ x, y, width, height, pageNumber, text }`, will be
  saved (as one big Array) to the note-store API you gave, for each edit.
  (Coordinates are in pt from top-left of document, as is PDF convention.)
* The note-store API may notify when new notes are changed, and PDF.js will
  update the UI.

## "Partial" vs "Full" Documents

When `PDFViewerApplication.open(url)` is called with a second argument,
`{ fullDocumentInfo: { pageNumber, nPages, url } }`, we consider the
first-argument `url` to be a "partial" document, with the "full" document
being at `arguments[1].fullDocumentInfo.url`.

* The normal page-switching buttons do not appear.
* In their stead, a "Load all pages" button will load `fullDocumentInfo.url` at
  the correct page.
* In this "full document" mode, PDF Notes (see above) can only be added and
  edited on the "partial" document's page.
* When switching from "partial" to "full" document mode, rotation/zoom/scroll
  positions are preserved.

# Set up a dev environment

1. `npm install`
2. `node_modules/.bin/gulp generic` # generates some locale files, among other things
3. `node_modules/.bin/gulp server`

## Dev loop (combined with Overview)

Try to do as much as possible _before_ integrating into Overview: this keeps the
loop tighter.

1. Browse to http://localhost:8888/web/viewer.html?file=/web/compressed.tracemonkey-pldi-09.pdf
2. Scan for bugs surrounding the feature you want to add. (It's easiest if you
   find bugs _before_ editing -- and fix them -- so you won't think you caused
   them.)
3. Add a new feature, accessible in a URL-only fashion.
4. Test at http://localhost:8888/web/viewer.html?file=/web/compressed.tracemonkey-pldi-09.pdf
5. `node_modules/.bin/gulp generic`
6. Test at http://localhost:8888/build/generic/web/viewer.html?file=/web/compressed.tracemonkey-pldi-09.pdf
7. Bring in to local Overview (relies on the `gulp generic` above):
   `(cd /path/to/overview-server && auto/refresh-pdfjs.py /path/to/overview-pdf-viewer/)`
8. Test in Overview (in its `./dev` server)

# Test URLs

A typical PDF: http://localhost:8888/web/viewer.html?file=/web/compressed.tracemonkey-pldi-09.pdf

A "per-page" PDF: http://localhost:8888/web/viewer.html?file=/web/compressed.tracemonkey-pldi-09-p4.pdf&fullDocumentInfo.pageNumber=4&fullDocumentInfo.nPages=9&fullDocumentInfo.url=/web/compressed.tracemonkey-pldi-09.pdf
