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
 * @property {EventBus} eventBus
 */

class NoteLayerBuilder {
  /**
   * @param {NoteLayerBuilderOptions} options
   */
  constructor({ pageDiv, pdfPage, eventBus, noteStore, div = null }) {
    this.pageDiv = pageDiv;
    this.pdfPage = pdfPage;
    this.noteStore = noteStore;
    this.eventBus = eventBus;
    this.div = div;
  }

  /**
   * @param {PageViewport} viewport
   */
  render(viewport) {
    if (!this.noteStore) {
      return;
    }

    if (this.div) {
      this.div.innerHTML = "";
    } else {
      this.div = document.createElement("div");
      this.div.className = "noteLayer";
      this.pageDiv.appendChild(this.div);

      if (this.eventBus && this.noteStore) {
        this.div.addEventListener("click", ev => {
          if (ev.target.nodeName === "SECTION") {
            const i = Array.prototype.indexOf.call(
              this.div.childNodes,
              ev.target
            );
            if (i !== -1) {
              const note = this.noteStore.getNote(
                this.pdfPage.pageNumber - 1,
                i
              );
              this.eventBus.dispatch("clicknote", note);
            }
          }
        });
      }
    }

    const parameters = {
      viewport,
      div: this.div,
      notes: this.noteStore.getNotesForPageIndex(this.pdfPage.pageNumber - 1),
      page: this.pdfPage,
    };

    NoteLayer.render(parameters);
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
class NoteLayerFactory {
  /**
   * @param {NoteStore} noteStore
   */
  constructor(noteStore) {
    this.noteStore = noteStore;
  }

  /**
   * @param {HTMLDivElement} pageDiv
   * @param {PDFPage} pdfPage
   * @returns {NoteLayerBuilder}
   */
  createNoteLayerBuilder(pageDiv, pdfPage) {
    return new NoteLayerBuilder({
      pageDiv,
      pdfPage,
      noteStore: this.noteStore,
      eventBus: this.noteStore ? this.noteStore.eventBus : null,
    });
  }
}

export { NoteLayerBuilder, NoteLayerFactory };
