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

import { scrollIntoView } from "./ui_utils.js";
import { Util } from "../src/shared/util.js";

const EditNoteTreeSpec = [
  {
    tag: "div",
    attrs: { class: "editNoteBackground" },
    children: [
      { tag: "div", attrs: { class: "bgAbove" } },
      { tag: "div", attrs: { class: "bgBelow" } },
      { tag: "div", attrs: { class: "bgLeft" } },
      { tag: "div", attrs: { class: "bgRight" } },
    ],
  },
  {
    tag: "div",
    attrs: { class: "editNotePopup" },
    children: [
      {
        tag: "div",
        attrs: { class: "editNoteToolbar" },
        children: [
          { tag: "h4", text: "Note" },
          {
            tag: "button",
            attrs: { class: "editNotePrevious" },
            children: [{ tag: "span", text: "Previous" }],
          },
          {
            tag: "button",
            attrs: { class: "editNoteNext" },
            children: [{ tag: "span", text: "Next" }],
          },
          { tag: "span", attrs: { class: "space" } },
          {
            tag: "button",
            attrs: { class: "editNoteDelete" },
            children: [{ tag: "span", text: "Delete" }],
          },
          {
            tag: "button",
            attrs: { class: "editNoteClose" },
            children: [{ tag: "span", text: "Close" }],
          },
        ],
      },
      { tag: "div", attrs: { class: "editNoteHighlight" } },
      {
        tag: "form",
        attrs: { method: "POST", action: "" },
        children: [
          {
            tag: "div",
            children: [
              { tag: "textarea", attrs: { name: "note" } },
              {
                tag: "button",
                attrs: { class: "editNoteSave", disabled: true },
                children: [{ tag: "span", text: "Save" }],
              },
            ],
          },
        ],
      },
    ],
  },
];

function createEditNoteFragment() {
  const fragment = document.createDocumentFragment();

  function append(node, childSpec) {
    const child = document.createElement(childSpec.tag);
    if (childSpec.attrs) {
      for (const attr in childSpec.attrs) {
        child.setAttribute(attr, childSpec.attrs[attr]);
      }
    }
    if (childSpec.text) {
      child.textContent = childSpec.text;
    }
    if (childSpec.children) {
      for (const grandchildSpec of childSpec.children) {
        append(child, grandchildSpec);
      }
    }
    node.appendChild(child);
  }

  for (const spec of EditNoteTreeSpec) {
    append(fragment, spec);
  }

  return fragment;
}

/**
 * @typedef {Object} EditNoteToolOptions
 * @property {HTMLDivElement} container - The document container.
 * @property {EventBus} eventBus - The application event bus.
 * @property {PDFViewer} pdfViewer - The PDF Viewer.
 */

class EditNoteTool {
  /**
   * @constructs EditNoteTool
   * @param {EditNoteToolOptions} options
   */
  constructor({ container, eventBus, pdfViewer }) {
    this.container = container;
    this.eventBus = eventBus;
    this.pdfViewer = pdfViewer;
    this.div = document.createElement("div");
    this.div.className = "editNoteTool";
    this.container.appendChild(this.div);

    this.active = false;
    this.currentNote = null;

    this._attachEventBus();
  }

  setNote(note) {
    this.currentNote = note;

    // Remove any previous DOM
    while (this.div.lastElementChild) {
      this.div.lastElementChild.remove();
    }
    // Add new DOM, if there's a note
    if (this.currentNote !== null) {
      const fragment = createEditNoteFragment();
      this.div.appendChild(fragment);
      this._attachDom();
      this._updateDom();
    }
  }

  _attachEventBus() {
    this.eventBus.on("clicknote", this.setNote.bind(this));
    this.eventBus.on("movetonextnote", this.moveToNext.bind(this));
    this.eventBus.on("movetopreviousnote", this.moveToPrevious.bind(this));
    this.eventBus.on("updateviewarea", this._updateDomPositions.bind(this));
  }

  _attachDom() {
    this.div
      .querySelector("div.editNoteBackground")
      .addEventListener("mousedown", this._onMousedownBackground.bind(this));
    this.div
      .querySelector("button.editNotePrevious")
      .addEventListener("click", this._onClickPrevious.bind(this));
    this.div
      .querySelector("button.editNoteNext")
      .addEventListener("click", this._onClickNext.bind(this));
    this.div
      .querySelector("button.editNoteDelete")
      .addEventListener("click", this._onClickDelete.bind(this));
    this.div
      .querySelector("button.editNoteClose")
      .addEventListener("click", this._onClickClose.bind(this));
    this.div
      .querySelector("textarea")
      .addEventListener("input", this._refreshSubmitButtonDisabled.bind(this));
    this.div
      .querySelector("form")
      .addEventListener("submit", this._onSubmit.bind(this));
  }

  close() {
    this.setNote(null);
  }

  get noteStore() {
    return this.pdfViewer.getPageView(1).noteLayerFactory.noteStore;
  }

  moveToPrevious() {
    if (this.noteStore) {
      const previousNote = this.noteStore.getPreviousNote(this.currentNote);
      this.setNote(previousNote);
    }
  }

  moveToNext() {
    if (this.noteStore) {
      const nextNote = this.noteStore.getNextNote(this.currentNote);
      this.setNote(nextNote);
    }
  }

  _setError(err) {
    console.warn(err);

    this.div.classList.add("error");

    this._setToolbarButtonsDisabled(true);
    const error = document.createElement("p");
    error.className = "error";
    error.textContent =
      "Save failed. Please reload this document and try again.";

    this._setFormDisabled(true);
    const form = this.div.querySelector("form");
    form.appendChild(error);
  }

  deleteNote() {
    if (!this.noteStore || !this.currentNote) {
      return;
    }

    this._setToolbarButtonsDisabled(true);
    this._setFormDisabled(true);
    this.div.classList.add("deleting");

    this.noteStore.deleteNote(this.currentNote).then(
      () => this.setNote(null),
      err => this._setError(err)
    );
  }

  _setToolbarButtonsDisabled(disabled) {
    const controls = this.div.querySelectorAll("button, textarea, form");
    for (const control of controls) {
      control.disabled = disabled;
    }
  }

  _setFormDisabled(disabled) {
    this.div.querySelector("textarea").disabled = disabled;
    this.div.querySelector("form button").disabled = disabled;
  }

  saveNote() {
    if (!this.noteStore || !this.currentNote) {
      return;
    }

    this.div.classList.add("saving");
    this._setToolbarButtonsDisabled(true);
    this._setFormDisabled(true);

    const textarea = this.div.querySelector("form textarea");
    const text = textarea.value;

    this.noteStore.setNoteText(this.currentNote, text).then(
      () => {
        this.div.classList.remove("saving");
        this._setToolbarButtonsDisabled(false);
        this._setFormDisabled(false);
        this._refreshSubmitButtonDisabled();
      },
      err => {
        this.div.classList.remove("saving");
        this._setError(err);
      }
    );
  }

  _onMousedownBackground(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.close();
  }

  _onClickPrevious(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.eventBus.dispatch("movetopreviousnote");
  }

  _onClickNext(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.eventBus.dispatch("movetonextnote");
  }

  _onClickDelete(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.deleteNote();
  }

  _onClickClose(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.close();
  }

  _onSubmit(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this.saveNote();
  }

  _refreshSubmitButtonDisabled() {
    const textarea = this.div.querySelector("textarea");
    const button = this.div.querySelector("form button");
    button.disabled =
      this.currentNote && textarea.value === this.currentNote.text;
  }

  _updateDom() {
    const { div, currentNote } = this;
    div.querySelector("textarea").value = currentNote.text;

    this._updateDomPositions();
  }

  _updateDomPositions() {
    const { div, currentNote } = this;
    if (!currentNote) {
      return;
    }

    const note = currentNote;

    div.querySelector("textarea").value = note.text;

    const pageView = this.pdfViewer.getPageView(note.pageIndex);
    const viewport = pageView.viewport;
    const pageDiv = pageView.div;
    const noteRect = Util.normalizeRect(
      viewport.convertToViewportRectangle([
        note.x,
        note.y,
        note.x + note.width,
        note.y + note.height,
      ])
    ); // relative to pageDiv
    const pageStyle = window.getComputedStyle(pageDiv);

    const position = {
      top:
        pageDiv.offsetTop + noteRect[1] + parseFloat(pageStyle.borderTopWidth),
      left:
        pageDiv.offsetLeft +
        noteRect[0] +
        parseFloat(pageStyle.borderLeftWidth),
      bottom:
        pageDiv.offsetTop + noteRect[3] + parseFloat(pageStyle.borderTopWidth),
      right:
        pageDiv.offsetLeft +
        noteRect[2] +
        parseFloat(pageStyle.borderLeftWidth),
    };
    position.height = position.bottom - position.top;
    position.width = position.right - position.left;

    const bg = div.querySelector(".editNoteBackground");

    const bgAbove = bg.querySelector(".bgAbove");
    bgAbove.style.height = position.top + "px";

    const bgLeft = bg.querySelector(".bgLeft");
    bgLeft.style.top = position.top + "px";
    bgLeft.style.width = pageDiv.offsetLeft + "px";
    bgLeft.style.height = position.height + "px";

    const bgRight = bg.querySelector(".bgRight");
    bgRight.style.top = position.top + "px";
    bgRight.style.left = pageDiv.offsetLeft + pageDiv.offsetWidth + "px";
    bgRight.style.height = position.height + "px";

    const bgBelow = bg.querySelector(".bgBelow");
    bgBelow.style.top = position.bottom + "px";
    bgBelow.style.height = this.container.scrollHeight - position.bottom + "px";

    const popup = div.querySelector(".editNotePopup");
    popup.style.top = position.top + "px";
    popup.style.height = position.height + "px";
    popup.style.left =
      pageDiv.offsetLeft + parseFloat(pageStyle.borderLeftWidth) + "px";
    popup.style.width = pageDiv.clientWidth + "px";

    scrollIntoView(this.div.querySelector(".editNotePopup"), {
      top: -80, // so the edit-note toolbar appears, which is negative-offset
      left: 0,
    });
  }
}

export { EditNoteTool };
