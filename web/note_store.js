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

/**
 * @class
 * @alias NoteStore
 */
var NoteStore = (function NoteStoreClosure() {
  function NoteStore() {
    this.pdfDocument = null;
    this.notes = null;
  }

  NoteStore.prototype = /** @lends NoteStore.prototype */ {
    /**
     * Fetches notes for the given page.
     */
    getNotesForPage: function NoteStore_getNotesForPage(pdfPage) {
      return Promise.resolve([
        {
          id: pdfPage.pageIndex,
          pageIndex: pdfPage.pageIndex,
          x: 72,
          y: 144,
          width: 288,
          height: 72,
          text: 'This is my note',
        }
      ]);
    }
  };

  return NoteStore;
})();

export {
  NoteStore,
};
