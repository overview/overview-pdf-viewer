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
 * @property {PDFViewer} pdfViewer - The PDF Viewer.
 */

class AddNoteTool {
  /**
   * @constructs AddNoteTool
   * @param {AddNoteOptions} options
   */
  constructor({ container, eventBus, pdfViewer }) {
    this.container = container;
    this.eventBus = eventBus;
    this.pdfViewer = pdfViewer;
    this.active = false;

    // Events to destroy when deactivating
    this._onmousedown = null;
    this._onmousemove = null;
    this._onmouseup = null;

    this.eventBus.on("toggleaddingnote", this.toggle.bind(this));
  }

  /**
   * @return {boolean}
   */
  get isActive() {
    return this.active;
  }

  toggle() {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate() {
    if (!this.active) {
      this.active = true;
      this.container.classList.add("addingNote");
      this._listenForMousedown();
      this.eventBus.dispatch("addingnotechanged", { isActive: true });
    }
  }

  _listenForMousedown() {
    this._stopListening();

    this._onmousedown = ev => {
      // Prevent clicking on a link, say, or on another note
      ev.preventDefault();
      ev.stopPropagation();

      let node = ev.target;
      while (
        node !== null &&
        !(node.nodeName === "DIV" && node.classList.contains("noteLayer"))
      ) {
        node = node.parentNode;
      }

      if (node === null) {
        return;
      }

      const noteLayer = node;
      const pageLayer = node.parentNode;

      const rect = noteLayer.getBoundingClientRect();
      const x0 = ev.clientX - rect.left;
      const y0 = ev.clientY - rect.top;

      const div = document.createElement("div");
      div.className = "addingNote";
      div.style.left = x0 + "px";
      div.style.top = y0 + "px";
      div.style.width = "0";
      div.style.height = "0";
      noteLayer.appendChild(div);

      const point0 = {
        pageIndex: +pageLayer.getAttribute("data-page-number") - 1,
        layerRect: rect,
        div,
        x0,
        y0,
      };

      this._listenForMouseup(point0);
    };
    this.container.addEventListener("mousedown", this._onmousedown);
  }

  _listenForMouseup(point0) {
    this._stopListening();

    function getCurrentRect(ev) {
      // Clamp x0, y0 and x1, y1 to the page
      const x0 = Math.max(point0.x0, 0);
      const y0 = Math.max(point0.y0, 0);

      const x1 = Math.min(
        point0.layerRect.width,
        ev.clientX - point0.layerRect.left
      );
      const y1 = Math.min(
        point0.layerRect.height,
        ev.clientY - point0.layerRect.top
      );

      // Swap x0<=>x1, y0<=>y1 to ensure x0 < x1, y0 < y1
      return {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    }

    this._onmousemove = function(ev) {
      ev.stopPropagation();
      ev.preventDefault();

      const rect = getCurrentRect(ev);
      point0.div.style.left = rect.x + "px";
      point0.div.style.top = rect.y + "px";
      point0.div.style.width = rect.width + "px";
      point0.div.style.height = rect.height + "px";
    };

    this._onmouseup = ev => {
      ev.stopPropagation();
      ev.preventDefault();

      const rect = getCurrentRect(ev);
      point0.div.remove();
      this._addNote(point0.pageIndex, rect);
      this.deactivate();
    };

    this.container.addEventListener("mousemove", this._onmousemove);
    this.container.addEventListener("mouseup", this._onmouseup);
  }

  /**
   * Stop listening for mousedown, mousemove, mouseup.
   */
  _stopListening() {
    for (const eventName of ["mousedown", "mousemove", "mouseup"]) {
      const listenerName = "_on" + eventName;
      const listener = this[listenerName];

      if (listener !== null) {
        this.container.removeEventListener(eventName, listener);
        this[listenerName] = null;
      }
    }
  }

  /**
   * Finishes adding the Note by calling NoteStore.add().
   */
  _addNote(pageIndex, rectInPx) {
    const pageView = this.pdfViewer.getPageView(pageIndex);

    const p0 = pageView.viewport.convertToPdfPoint(rectInPx.x, rectInPx.y);
    const p1 = pageView.viewport.convertToPdfPoint(
      rectInPx.x + rectInPx.width,
      rectInPx.y + rectInPx.height
    );

    pageView.noteLayerFactory.noteStore.add({
      pageIndex,
      x: Math.min(p0[0], p1[0]),
      y: Math.min(p0[1], p1[1]),
      width: Math.abs(p1[0] - p0[0]),
      height: Math.abs(p1[1] - p0[1]),
      text: "",
    });
  }

  deactivate() {
    if (this.active) {
      this.active = false;
      this.container.classList.remove("addingNote");
      this._stopListening();
      this.eventBus.dispatch("addingnotechanged", { isActive: false });
    }
  }
}

export { AddNoteTool };
