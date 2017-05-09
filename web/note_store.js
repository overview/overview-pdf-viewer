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

const LOAD_TIMEOUT = 30000; // ms
const SAVE_TIMEOUT = 30000; // ms

/**
 * Returns a String representing our in-memory data structure, suitable for
 * saving on the server.
 */
function encode(data) {
  const ret = [];
  data.forEach((arr, pageIndex) => {
    for (const note of arr) {
      ret.push(Object.assign({ pageIndex }, note));
    }
  });

  return JSON.stringify(ret);
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
function decode(s) {
  let arr;
  try {
    arr = JSON.parse(s);
  } catch (e) {
    throw new Error("Invalid JSON from server: " + e.message);
  }

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
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      text: note.text,
    });
  }

  return ret;
}

/**
 * @typedef {Object} NoteStoreOptions
 * @property {EventBus} eventBus - The application event bus.
 * @property {String} url - Endpoint for GET/PUT of notes.
 */

/*
 * Given a document URL, formulates a Notes URL and sync notes on it.
 */
class NoteStore {
  /**
   * @constructs NoteStore
   * @param {NoteStoreOptions} options
   */
  constructor({ eventBus, url }) {
    this.eventBus = eventBus;
    this.url = url;
    this._data = [];

    this._savePromise = null;
    // Callers can call _save() even when we're already saving, to queue another
    // save. All subsequent calls to _save() (until the original save ends) will
    // share the same promise.
    this._nextSavePromise = null;
    this._isChangedSinceLastSave = null;

    this._savePromise = null;

    this.loaded = new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 30000;
      xhr.onload = () => {
        try {
          this._setData(decode(xhr.responseText));
          resolve(null);
        } catch (e) {
          this._setData([]);
          reject(e);
        }
      };
      xhr.onerror = function() {
        reject(
          new Error(
            "Error loading XHR. Status " + xhr.status + " " + xhr.statusText
          )
        );
      };
      xhr.onabort = function() {
        reject(new Error("Note request aborted"));
      };
      xhr.ontimeout = function() {
        reject(new Error("Note request timed out"));
      };
      xhr.open("GET", this.url);
      xhr.responseType = "text";
      xhr.timeout = LOAD_TIMEOUT;
      xhr.send(null);
    });
  }

  /**
   * Schedules a save to the server and returns a Promise that resolves when
   * the save completes.
   *
   * If _save() is called without local changes, this is a no-op.
   *
   * If _save() is called while we're already saving, this queues another
   * save.
   *
   * If _save() is called while we're already saving _and_ another save is
   * queued, both saves will be folded into one save which will begin when the
   * current save completes.
   */
  _save() {
    return this.loaded.then(() => {
      if (!this._isChangedSinceLastSave) {
        return this._savePromise || Promise.resolve(null);
      }

      if (this._savePromise !== null) {
        if (this._nextSavePromise === null) {
          this._nextSavePromise = this._savePromise.then(() => this._doSave());
        } // otherwise it's already queued

        return this._nextSavePromise;
      }

      this._savePromise = this._doSave();
      return this._savePromise;
    });
  }

  /**
   * Sends an XHR request to the server with the latest data and returns when
   * the server acknowledges.
   *
   * This is unsafe to call outside of _save() because it might lead to races.
   */
  _doSave() {
    this._isChangedSinceLastSave = false;

    return new Promise((resolve, reject) => {
      const end = (callback, ...args) => {
        // Advance to _nextSavePromise. When we resolve(), it will begin.
        // (See _save().)
        this._savePromise = this._nextSavePromise;
        this._nextSavePromise = null;
        callback(...args);
      };

      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
        end(resolve);
      };
      xhr.onerror = function(ev) {
        end(
          reject,
          new Error("Save failed: " + xhr.status + " " + xhr.statusText)
        );
      };
      xhr.ontimeout = function() {
        end(reject, new Error("Save timed out"));
      };
      xhr.onabort = function() {
        end(reject, new Error("Save aborted"));
      };

      xhr.timeout = SAVE_TIMEOUT;
      xhr.open("PUT", this.url);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(encode(this._data));
    });
  }

  /**
   * Fetches Notes for the given page.
   */
  getNotesForPageIndex(pageIndex) {
    return this._data[pageIndex] || [];
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
  add(note) {
    return this.loaded.then(() => {
      // If this pageIndex is the highest we've seen, add empty pages
      for (let i = this._data.length - 1, ii = note.pageIndex; i < ii; i++) {
        this._data.push([]);
      }

      this._data[note.pageIndex].push({
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        text: note.text,
      });

      // Keep list sorted.
      // [adam] Obviously .splice() would be better, but I'm lazy.
      this._data[note.pageIndex].sort(function(a, b) {
        return (
          a.y - b.y ||
          a.x - b.x ||
          a.height - b.height ||
          a.width - b.width ||
          a.text.localeCompare(b.text)
        );
      });

      this.eventBus.dispatch("noteschanged");
      this._isChangedSinceLastSave = true;
      return this._save();
    });
  }
}

export { NoteStore };
