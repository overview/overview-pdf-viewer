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
import { NoteLayer} from './note_layer';

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
  constructor(options) {
    this.pageDiv = options.pageDiv;
    this.pdfPage = options.pdfPage;
    this.noteStore = options.noteStore;
    this.div = null;
  }

  /**
   * @param {PageViewport} viewport
   */
  render(viewport) {
    if (!this.noteStore) {
      return;
    }

    var parameters = {
      viewport,
      div: this.div,
      notes: this.noteStore.getNotesForPageIndex(this.pdfPage.pageIndex),
      page: this.pdfPage,
    };

    if (this.div) {
      this.div.innerHTML = '';
    } else {
      this.div = document.createElement('div');
      this.div.className = 'noteLayer';
      this.pageDiv.appendChild(this.div);
    }

    parameters.div = this.div;
    NoteLayer.render(parameters);
  }

  hide() {
    if (!this.div) {
      return;
    }
    this.div.setAttribute('hidden', true);
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

export {
  NoteLayerBuilder,
  DefaultNoteLayerFactory,
};
