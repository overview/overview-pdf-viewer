/* Copyright 2017 Overview Services Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NoteLayer } from "pdfjs-lib";

/**
 * @typedef {Object} NoteLayerBuilderOptions
 * @property {HTMLDivElement} pageDiv
 * @property {PDFPage} pdfPage
 * @property {NoteStore} noteStore
 */

class NoteLayerBuilder {
  /**
   * @param {NoteLayerBuilderOptions} options
   */
  constructor({ pageDiv, pdfPage, noteStore, div = null }) {
    this.pageDiv = pageDiv;
    this.pdfPage = pdfPage;
    this.noteStore = noteStore;
    this.div = div;
  }

  /**
   * @param {PageViewport} viewport
   */
  render(viewport) {
    if (!this.noteStore) {
      return;
    }

    this.noteStore.getNotesForPage(this.pdfPage).then(notes => {
      const parameters = {
        viewport: viewport.clone({ dontFlip: true }),
        div: this.div,
        notes,
        page: this.pdfPage,
      };

      if (this.div) {
        // If a noteLayer already exists, refresh its children's
        // transformation matrices
        NoteLayer.update(parameters);
      } else {
        // Create a note layer div and render the notes, even if there are
        // zero notes.
        this.div = document.createElement("div");
        this.div.className = "noteLayer";
        this.pageDiv.appendChild(this.div);
        parameters.div = this.div;

        NoteLayer.render(parameters);
      }
    });
  }

  hide() {
    if (!this.div) {
      return;
    }
    this.div.setAttribute("hidden", true);
  }
}

/**
 * @implements INoteLayerFactory
 */
class DefaultNoteLayerFactory {
  /**
   * @param {HTMLDivElement} pageDiv
   * @param {PDFPage} pdfPage
   * @returns {NoteLayerBuilder}
   */
  createNoteLayerBuilder(pageDiv, pdfPage) {
    return new NoteLayerBuilder({ pageDiv, pdfPage, noteStore: null });
  }
}

export { NoteLayerBuilder, DefaultNoteLayerFactory };
