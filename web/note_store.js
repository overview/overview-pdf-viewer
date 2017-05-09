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

var LOAD_TIMEOUT = 30000; // ms
var SAVE_TIMEOUT = 30000; // ms

/**
 * Returns a String representing our in-memory data structure, suitable for
 * saving on the server.
 */
function encode(data) {
  var len = data.reduce(function(s, a) { return s + a.length; }, 0);
  var ret = new Array(len);

  var idx = 0;
  for (var i = 0, ii = data.length; i < ii; i++) {
    var arr = data[i];
    for (var j = 0, jj = arr.length; j < jj; j++) {
      ret[idx++] = Object.assign({
        pageIndex: i,
      }, arr[j]);
    }
  }

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
  var arr;
  try {
    arr = JSON.parse(s);
  } catch (e) {
    throw new Error('Invalid JSON from server: ' + e.message);
  }

  if (!Array.isArray(arr)) {
    throw new Error('Expected JSON from server to be Array of objects');
  }

  var ret = [];

  for (var i = 0, ii = arr.length; i < ii; i++) {
    var note = arr[i];
    if (!note // not typeof, because typeof null === 'null'
      || typeof note.pageIndex !== 'number'
      || typeof note.x !== 'number'
      || typeof note.y !== 'number'
      || typeof note.width !== 'number'
      || typeof note.height !== 'number'
      || typeof note.text !== 'string'
    ) {
      throw new Error('Invalid Note from server: ' + JSON.stringify(note));
    }

    for (var j = ret.length - 1, jj = note.pageIndex; j < jj; j++) {
      ret.push([]);
    }

    ret[note.pageIndex].push({
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      text: note.text,
    })
  }

  return ret;
}

/**
 * @typedef {Object} NoteStoreOptions
 * @property {EventBus} eventBus - The application event bus.
 */

/**
 * @class
 * @alias NoteStore
 */
var NoteStore = (function NoteStoreClosure() {
  /**
   * @constructs NoteStore
   * @param {NoteStoreOptions} options
   */
  function NoteStore(options) {
    this.eventBus = options.eventBus;

    this.url = null;

    this.loaded = null;
    this._savePromise = null;
    // Callers can call _save() even when we're already saving, to queue another
    // save. All subsequent calls to _save() (until the original save ends) will
    // share the same promise.
    this._nextSavePromise = null;
    this._isChangedSinceLastSave = null;

    this._data = [];
  }

  NoteStore.prototype = /** @lends NoteStore.prototype */ {
    /**
     * Given a document URL, formulates a Notes URL and begins loading
     * annotations from it.
     *
     * Returns a new Promise, `this.loaded`.
     */
    setDocumentUrl: function NoteStore_setDocument(url) {
      url = new URL(url, window.location).href
        .replace(/\.pdf$/, '/notes');

      this._savePromise = null;
      // Callers can call _save() even when we're already saving, to queue another
      // save. All subsequent calls to _save() (until the original save ends) will
      // share the same promise.
      this._nextSavePromise = null;
      this._setData([]);

      this.url = url;

      var self = this;
      this.loaded = new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 30000;
        xhr.onload = function() {
          try {
            self._setData(decode(xhr.responseText));
            resolve(null);
          } catch (e) {
            self._setData([]);
            reject(e);
          }
        };
        xhr.onerror = function() {
          reject(new Error(
            'Error loading XHR. Status ' + xhr.status + ' ' + xhr.statusText));
        };
        xhr.onabort = function() {
          reject(new Error('Note request aborted'));
        };
        xhr.ontimeout = function() {
          reject(new Error('Note request timed out'));
        };
        xhr.open('GET', self.url);
        xhr.responseType = 'text';
        xhr.timeout = LOAD_TIMEOUT;
        xhr.send(null);
      });
    },

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
    _save: function NoteStore_save() {
      var self = this;

      if (!self.loaded) {
        return Promise.reject(new Error('You must setPdfDocument() before saving'));
      }

      self.loaded.then(function() {
        if (!self._isChangedSinceLastSave) {
          return self._savePromise || Promise.resolve(null);
        }

        if (self._savePromise !== null) {
          if (self._nextSavePromise !== null) {
            return self._nextSavePromise;
          }

          return self._nextSavePromise = self._savePromise.
            then(function() { self._doSave(); });
        }

        return self._savePromise = self._doSave();
      });
    },

    /**
     * Sends an XHR request to the server with the latest data and returns when
     * the server acknowledges.
     *
     * This is unsafe to call outside of _save() because it might lead to races.
     */
    _doSave: function NoteStore_doSave() {
      this._isChangedSinceLastSave = false;

      var self = this;
      return new Promise(function(resolve, reject) {
        function end(callback, arg) {
          // Advance to _nextSavePromise. When we resolve(), it will begin.
          // (See _save().)
          self._savePromise = self._nextSavePromise;
          self._nextSavePromise = null;
          callback(arg);
        }

        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
          end(resolve);
        };
        xhr.onerror = function(ev) {
          end(reject,
            new Error('Save failed: ' + xhr.status + ' ' + xhr.statusText)
          );
        };
        xhr.ontimeout = function() {
          end(reject, new Error('Save timed out'));
        };
        xhr.onabort = function() {
          end(reject, new Error('Save aborted'));
        };

        xhr.timeout = SAVE_TIMEOUT;
        xhr.open('PUT', self.url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(encode(self._data));
      });
    },

    /**
     * Fetches Notes for the given page.
     */
    getNotesForPageIndex: function NoteStore_getNotesForPageIndex(pageIndex) {
      return this._data[pageIndex] || [];
    },

    _setData: function NoteStore_setData(data) {
      this._data = data;
      this.eventBus.dispatch('noteschanged');
    },

    /**
     * Ensures `this.loaded`; adds a Note; and begins saving.
     *
     * The returned Promise resolves when the save completes.
     */
    add: function NoteStore_add(note) {
      var self = this;

      if (!self.loaded) {
        return Promise.reject(new Error('You must setPdfDocument() before add'));
      }

      return self.loaded.then(function() {
        // If this pageIndex is the highest we've seen, add empty pages
        for (var i = self._data.length - 1, ii = note.pageIndex; i < ii; i++) {
          self._data.push([]);
        }

        self._data[note.pageIndex].push({
          x: note.x,
          y: note.y,
          width: note.width,
          height: note.height,
          text: note.text,
        });

        // Keep list sorted.
        // [adam] Obviously .splice() would be better, but I'm lazy.
        self._data[note.pageIndex].sort(function(a, b) {
          return (a.y - b.y) ||
                 (a.x - b.x) ||
                 (a.height - b.height) ||
                 (a.width - b.width) ||
                 a.text.localeCompare(b.text);
        });

        self.eventBus.dispatch('noteschanged');
        self._isChangedSinceLastSave = true;
        return self._save();
      });
    },
  };

  return NoteStore;
})();

export {
  NoteStore,
};
