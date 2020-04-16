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
 * Returns a String representing our in-memory data structure, suitable for
 * saving on the server.
 */
function encode(data) {
  return data.flat();
}

/**
 * Turns a String from the server into our internal data structure.
 *
 * Our internal data structure is an Array of sorted Arrays of Notes. The outer
 * index is `pageIndex` (0-based), which makes it fast+easy to find Notes for a
 * given page.
 *
 * Throws error on invalid data.
 */
function decode(arr) {
  if (!Array.isArray(arr)) {
    throw new Error("Expected JSON from server to be Array of objects");
  }

  const ret = [];
  for (const note of arr) {
    if (
      !note || // not typeof, because typeof null === "null"
      typeof note.pageIndex !== "number" ||
      typeof note.x !== "number" ||
      typeof note.y !== "number" ||
      typeof note.width !== "number" ||
      typeof note.height !== "number" ||
      typeof note.text !== "string"
    ) {
      throw new Error("Invalid Note from server: " + JSON.stringify(note));
    }

    for (let j = ret.length - 1, jj = note.pageIndex; j < jj; j++) {
      ret.push([]);
    }

    ret[note.pageIndex].push({
      pageIndex: note.pageIndex,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      text: note.text,
    });
  }

  return ret;
}

function compareNotes(a, b) {
  return (
    b.y - a.y ||
    a.x - b.x ||
    a.height - b.height ||
    a.width - b.width ||
    a.text.localeCompare(b.text)
  );
}

/**
 * @typedef {Function} NoteStoreApiCreator
 *
 * Supply something like this:
 *
 *     const noteStoreApiCreator = (pdfUrl, { onChange }) => {
 *         const apiUrl = pdfUrl.replace(/.pdf$/, "/notes.json");
 *         return {
 *             async load() {
 *                 return fetch(apiUrl).json();
 *             }
 *
 *             async save(notes) {
 *                 return fetch(
 *                     apiUrl,
 *                     { method: "PUT", body: JSON.stringify(notes) },
 *                 );
 *             }
 *         };
 *
 *         // and maybe call `onChange(notes)` whenever we see (asynchronously)
 *         // that notes have changed.
 *     });
 *
 * NoteStore will never call the API's save() twice at a time. It will wait for
 * the first call to return before calling a second time. It will also recover
 * from Promise rejections (Errors).
 */

/**
 * @typedef {Object} NoteStoreOptions
 * @property {EventBus} eventBus - The application event bus.
 * @property {NoteStoreApi} apiCreator - The note-storage logic.
 * @property {Number} focusPageNumber - null; or if set, all notes must
 *   have pageNumber={focusPageNumber}, and they will be _saved_ as having
 *   pageNumber=1. (This supports Overview's "partial document" vs "full
 *   document" concept: when viewing the full document, notes must all be
 *   written to the partial document.)
 * @property {String} pdfUrl - The PDF URL (used to instantiate `api`).
 */

/*
 * Given a document URL, formulates a Notes URL and sync notes on it.
 */
class NoteStore {
  /**
   * @constructs NoteStore
   * @param {NoteStoreOptions} options
   */
  constructor({ eventBus, apiCreator, focusPageNumber, pdfUrl }) {
    this.eventBus = eventBus;
    this.focusPageNumber = focusPageNumber;
    this.api = apiCreator(pdfUrl, {
      onChange: notes => this._setData(this.decode(notes)),
    });

    this.loaded = this.api.load().then(notes => {
      this._setData(this.decode(notes));
    });

    // Methods can call _save() even when we're already saving, to queue another
    // save. All subsequent calls to _save() (until the original save ends) will
    // share the same promise.
    this._lastSave = this.loaded;
    this._nextSave = null;
  }

  /**
   * Schedules a save to the server and returns a Promise that resolves when
   * the save completes.
   *
   * If _save() is called while we're already saving, this queues another
   * save.
   *
   * If _save() is called while we're already saving _and_ another save is
   * queued, both saves will be folded into one save which will begin when the
   * current save completes.
   */
  async _save() {
    if (this._nextSave !== null) {
      // There's a save going on, and there's another save queued
      // after it. Return the second save: it will save the latest
      // data.
      return this._nextSave;
    }

    if (this._lastSave !== null) {
      // There's a save going on. Queue our save for after that one.
      //
      // Sets `this._nextSave`, to short-circuit future calls.
      this._nextSave = this._lastSave.then(() => this._doSave());
      return this._nextSave;
    }

    // There's no other save going on ... _yet_.
    this._lastSave = this._doSave();
    return this._lastSave;
  }

  /**
   * Sends an XHR request to the server with the latest data and returns when
   * the server acknowledges.
   *
   * This is unsafe to call outside of _save() because it might lead to races.
   */
  async _doSave() {
    try {
      await this.api.save(this.encode(this._data));
    } catch (err) {
      // _doSave() _must_ succeed -- otherwise the promise chain breaks
      console.error(err);
    }
    this._lastSave = this._nextSave;
    this._nextSave = null;
    return null;
  }

  /**
   * Fetches Notes for the given page.
   */
  getNotesForPageIndex(pageIndex) {
    return this._data[pageIndex] || [];
  }

  /**
   * Fetches a single Note.
   */
  getNote(pageIndex, indexOnPage) {
    return (this._data[pageIndex] || [])[indexOnPage] || null;
  }

  _setData(data) {
    this._data = data;
    this.eventBus.dispatch("noteschanged");
  }

  /**
   * Ensures `this.loaded`; adds a Note; and begins saving.
   *
   * The returned Promise resolves when the save completes.
   */
  async add(note) {
    await (this._nextSave || this._lastSave || this.loaded);

    // If this pageIndex is the highest we've seen, add empty pages
    for (let i = this._data.length - 1, ii = note.pageIndex; i < ii; i++) {
      this._data.push([]);
    }

    // Store the exact Object we were given. That way, the caller can
    // deleteNote() with the same handle the called addNote() with.
    this._data[note.pageIndex].push(note);

    // Keep list sorted.
    // [adam] Obviously .splice() would be better, but I'm lazy.
    this._data[note.pageIndex].sort(compareNotes);

    this.eventBus.dispatch("noteschanged");
    return this._save();
  }

  /**
   * Returns the "next" Note relative to the given one.
   *
   * If given `null`, returns the first Note.
   */
  getNextNote(note) {
    // Search for `note` from the current page until the end. Return the note
    // after the note we found.
    const ii = this._data.length;
    let seenNote = false;
    for (let i = note ? note.pageIndex : 0; i < ii; i++) {
      const page = this._data[i];
      for (let j = 0, jj = page.length; j < jj; j++) {
        if (seenNote || note === null) {
          return page[j];
        } else if (page[j] === note) {
          seenNote = true;
        }
      }
    }

    // If we still haven't returned, then we've passed the end of the
    // document. Return the first Note.
    for (let i = 0; i < ii; i++) {
      const page = this._data[i];
      if (page.length > 0) {
        return page[0];
      }
    }

    return null; // There aren't any Notes.
  }

  /**
   * Returns the "previous" Note relative to the given one.
   *
   * If given `null`, returns the last Note.
   */
  getPreviousNote(note) {
    // Search for `note` from the current page until the beginning. Return the
    // note before the note we found.
    let seenNote = false;
    for (let i = note ? note.pageIndex : this._data.length - 1; i >= 0; i--) {
      const page = this._data[i];
      for (let j = page.length - 1; j >= 0; j--) {
        if (seenNote || note === null) {
          return page[j];
        } else if (page[j] === note) {
          seenNote = true;
        }
      }
    }

    // If we still haven't returned, then we've passed the end of the
    // document. Return the last Note.
    for (let i = this._data.length - 1; i >= 0; i--) {
      const page = this._data[i];
      if (page.length > 0) {
        return page[page.length - 1];
      }
    }

    return null; // There aren't any Notes.
  }

  /**
   * Ensures `this.loaded`; deletes Note; begins saving.
   *
   * The returned Promise resolves when the save completes.
   */
  async deleteNote(note) {
    await (this._nextSave || this._lastSave || this.loaded);

    const arr = this._data[note.pageIndex];
    const index = arr.indexOf(note);

    if (index === -1) {
      return null; // it's already deleted
    }

    arr.splice(index, 1);

    this.eventBus.dispatch("noteschanged");
    return this._save();
  }

  /**
   * Ensures `this.loaded`; updates text of the given Note; begins saving.
   *
   * The returned Promise resolves when the save completes.
   */
  async setNoteText(note, text) {
    await (this._nextSave || this._lastSave || this.loaded);

    note.text = text;

    this._data[note.pageIndex].sort(compareNotes); // Wild edge case
    this.eventBus.dispatch("noteschanged");
    return this._save();
  }

  /**
   * @private
   */
  decode(arr) {
    if (this.focusPageNumber) {
      arr = arr.map(note =>
        Object.assign(note, { pageIndex: this.focusPageNumber - 1 })
      );
    }
    return decode(arr);
  }

  /**
   * @private
   */
  encode(notes) {
    let arr = encode(notes);
    if (this.focusPageNumber) {
      arr = arr.map(note => Object.assign(note, { pageIndex: 0 }));
    }
    return arr;
  }
}

export { NoteStore };
