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
 * @typedef {Object} AddNoteToolOptions
 * @property {HTMLDivElement} container - The document container.
 * @property {EventBus} eventBus - The application event bus.
 */

/**
 * @class
 */
var AddNoteTool = (function AddNoteToolClosure() {
  /**
   * @constructs AddNoteTool
   * @param {AddNoteOptions} options
   */
  function AddNoteTool(options) {
    this.container = options.container;
    this.eventBus = options.eventBus;
    this.active = false;

    // Events to destroy when deactivating
    this._onmousedown = null;
    this._onmousemove = null;
    this._onmouseup = null;

    this.eventBus.on('toggleaddingnote', this.toggle.bind(this));
  }

  AddNoteTool.prototype = {
    /**
     * @return {boolean}
     */
    get isActive() {
      return this.active;
    },

    toggle: function AddNoteTool_toggle() {
      if (this.active) {
        this.deactivate();
      } else {
        this.activate();
      }
    },

    activate: function() {
      if (!this.active) {
        this.active = true;
        this.container.classList.add('addingNote');
        this._listenForMousedown();
        this.eventBus.dispatch('addingnotechanged', { isActive: true, });
      }
    },

    _listenForMousedown: function() {
      var self = this;
      this._stopListening();

      this._onmousedown = function(ev) {
        // Prevent clicking on a link, say, or on another note
        ev.preventDefault();
        ev.stopPropagation();

        var node = ev.target;
        while (node !== null && node.nodeName === 'DIV' && !node.classList.contains('noteLayer')) {
          node = node.parentNode;
        }

        if (node === null) {
          return;
        }

        var noteLayer = node;
        var pageLayer = node.parentNode;

        var rect = noteLayer.getBoundingClientRect();
        var x0 = ev.clientX - rect.left;
        var y0 = ev.clientY - rect.top;

        var div = document.createElement('div');
        div.className = 'addingNote';
        div.style.left = x0 + 'px';
        div.style.top = y0 + 'px';
        div.style.width = '0';
        div.style.height = '0';
        noteLayer.appendChild(div);

        var point0 = {
          pageIndex: +pageLayer.getAttribute('data-page-number') - 1,
          layerRect: rect,
          div: div,
          x0: x0,
          y0: y0,
        };

        self._listenForMouseup(point0);
      }
      this.container.addEventListener('mousedown', this._onmousedown);
    },

    _listenForMouseup: function(point0) {
      var self = this;
      this._stopListening();

      function getCurrentRect(ev) {
        var x0 = point0.x0;
        var y0 = point0.y0;

        var x1 = ev.clientX - point0.layerRect.left;
        var y1 = ev.clientY - point0.layerRect.top;

        // Clamp x1 and y1 onto the page.
        if (x1 < 0) x1 = 0;
        if (x1 > point0.layerRect.right) x1 = point0.layerRect.right;
        if (y1 < 0) y1 = 0;
        if (y1 > point0.layerRect.bottom) y1 = point0.layerRect.bottom;

        // Swap if needed so x0,y0 is top-left
        if (x0 > x1) {
          var tx = x1;
          x1 = x0;
          x0 = tx;
        }

        if (y0 > y1) {
          var ty = y1;
          y1 = y0;
          y0 = ty;
        }

        return {
          x: x0,
          y: y0,
          width: x1 - x0,
          height: y1 - y0,
        };
      }

      this._onmousemove = function(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        var rect = getCurrentRect(ev);
        point0.div.style.left = rect.x + 'px';
        point0.div.style.top = rect.y + 'px';
        point0.div.style.width = rect.width + 'px';
        point0.div.style.height = rect.height + 'px';
      };

      this._onmouseup = function(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        var rect = getCurrentRect(ev);
        point0.div.parentNode.removeChild(point0.div);
        self._addNote(point0.pageIndex, rect);
        self.deactivate();
      };

      this.container.addEventListener('mousemove', this._onmousemove);
      this.container.addEventListener('mouseup', this._onmouseup);
    },

    /**
     * Stop listening for mousedown, mousemove, mouseup.
     */
    _stopListening: function() {
      var events = [ 'mousedown', 'mousemove', 'mouseup' ];
      for (var i = 0, ii = events.length; i < ii; i++) {
        var event = events[i];
        var listenerName = '_on' + event;
        var listener = this[listenerName];

        if (listener !== null) {
          this.container.removeEventListener(event, listener);
          this[listenerName] = null;
        }
      }
    },

    /**
     * Notifies that we want a Note added.
     */
    _addNote: function AddNoteTool_addNote(pageIndex, rect) {
      console.log('add-note!', pageIndex, rect);
    },

    deactivate: function() {
      if (this.active) {
        this.active = false;
        this.container.classList.remove('addingNote');
        this._stopListening();
        this.eventBus.dispatch('addingnotechanged', { isActive: false, });
      }
    },
  };

  return AddNoteTool;
})();

export {
  AddNoteTool,
};
