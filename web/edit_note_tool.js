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
import { Util } from '../src/shared/util';

/**
 * @typedef {Object} EditNoteToolOptions
 * @property {HTMLDivElement} container - The document container.
 * @property {EventBus} eventBus - The application event bus.
 * @property {PDFViewer} pdfViewer - The PDF Viewer.
 */

/**
 * @class
 */
var EditNoteTool = (function EditNoteToolClosure() {
  /**
   * @constructs EditNoteTool
   * @param {EditNoteToolOptions} options
   */
  function EditNoteTool(options) {
    this.container = options.container;
    this.eventBus = options.eventBus;
    this.pdfViewer = options.pdfViewer;
    this.div = document.createElement('div');
    this.div.className = 'editNoteTool';
    this.container.appendChild(this.div);

    this.active = false;
    this.currentNote = null;

    this._attachEventBus();
  }

  var EditNoteHtml = [
    '<div class="editNoteBackground">',
      '<div class="bgAbove"></div>',
      '<div class="bgBelow"></div>',
      '<div class="bgLeft"></div>',
      '<div class="bgRight"></div>',
    '</div>',
    '<div class="editNotePopup">',
      '<div class="editNoteToolbar">',
        '<h4>Note</h4>',
        '<button class="editNotePrevious">Previous</button>',
        '<button class="editNoteNext">Next</button>',
        '<span class="space"></span>',
        '<button class="editNoteDelete">Delete</button>',
        '<button class="editNoteClose">Close</button>',
      '</div>',
      '<div class="editNoteHighlight"></div>',
      '<form method="POST" action="">',
        '<div>',
          '<textarea name="note"></textarea>',
          '<button class="editNoteSave" disabled>Save</button>',
        '</div>',
      '</form>',
    '</div>',
  ].join('');

  EditNoteTool.prototype = {
    setNote: function EditNoteTool_setNote(note) {
      this.currentNote = note;

      if (this.currentNote === null) {
        this.div.innerHTML = '';
      } else {
        this.div.innerHTML = EditNoteHtml;
        this._attachDom();
        this._updateDom();
      }
    },

    _attachEventBus: function() {
      this.eventBus.on('movetonextnote', this.moveToNext.bind(this));
      this.eventBus.on('movetopreviousnote', this.moveToPrevious.bind(this));
      this.eventBus.on('updateviewarea', this._updateDomPositions.bind(this));
    },

    _attachDom: function() {
      this.div.querySelector('div.editNoteBackground')
        .addEventListener('mousedown', this._onMousedownBackground.bind(this));
      this.div.querySelector('button.editNotePrevious')
        .addEventListener('click', this._onClickPrevious.bind(this));
      this.div.querySelector('button.editNoteNext')
        .addEventListener('click', this._onClickNext.bind(this));
      this.div.querySelector('button.editNoteDelete')
        .addEventListener('click', this._onClickDelete.bind(this));
      this.div.querySelector('button.editNoteClose')
        .addEventListener('click', this._onClickClose.bind(this));
    },

    close: function() {
      this.setNote(null);
    },

    moveToPrevious: function() {
      var noteStore = this.pdfViewer.noteStore;
      if (noteStore) {
        var previousNote = noteStore.getPreviousNote(this.currentNote);
        this.setNote(previousNote);
      }
    },

    moveToNext: function() {
      var noteStore = this.pdfViewer.noteStore;
      if (noteStore) {
        var nextNote = noteStore.getNextNote(this.currentNote);
        this.setNote(nextNote);
      }
    },

    deleteNote: function() {
      console.log('TODO deleteNote()');
    },

    saveNote: function() {
      console.log('TODO saveNote()');
    },

    _onMousedownBackground: function(ev) {
      console.log('mousedown background', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
    },

    _onClickPrevious: function(ev) {
      console.log('click previous', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.eventBus.dispatch('movetopreviousnote');
    },

    _onClickNext: function(ev) {
      console.log('click next', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.eventBus.dispatch('movetonextnote');
    },

    _onClickDelete: function(ev) {
      console.log('click delete', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.deleteNote();
    },

    _onClickClose: function(ev) {
      console.log('click close', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
    },

    _onClickSave: function(ev) {
      console.log('click save', ev);
      ev.preventDefault();
      ev.stopPropagation();
      this.saveNote();
    },

    _updateDom: function() {
      var div = this.div;
      var note = this.currentNote;

      div.querySelector('textarea').value = note.text;

      this._updateDomPositions();
    },

    _updateDomPositions: function() {
      if (!this.currentNote) return;

      var div = this.div;
      var note = this.currentNote;

      div.querySelector('textarea').value = note.text;

      var pageView = this.pdfViewer.getPageView(note.pageIndex);
      var viewport = pageView.viewport;
      var pageDiv = pageView.div;
      var noteRect = Util.normalizeRect(viewport.convertToViewportRectangle([
        note.x,
        note.y,
        note.x + note.width,
        note.y + note.height,
      ])); // relative to pageDiv
      var pageStyle = window.getComputedStyle(pageDiv);

      var position = {
        top: pageDiv.offsetTop + noteRect[1] + parseFloat(pageStyle.borderTopWidth),
        left: pageDiv.offsetLeft + noteRect[0] + parseFloat(pageStyle.borderLeftWidth),
        bottom: pageDiv.offsetTop + noteRect[3] + parseFloat(pageStyle.borderTopWidth),
        right: pageDiv.offsetLeft + noteRect[2] + parseFloat(pageStyle.borderLeftWidth),
      };
      position.height = position.bottom - position.top;
      position.width = position.right - position.left;

      var bg = div.querySelector('.editNoteBackground');

      var bgAbove = bg.querySelector('.bgAbove');
      bgAbove.style.height = position.top + 'px';

      var bgLeft = bg.querySelector('.bgLeft');
      bgLeft.style.top = position.top + 'px';
      bgLeft.style.width = position.left + 'px';
      bgLeft.style.height = position.height + 'px';

      var bgRight = bg.querySelector('.bgRight');
      bgRight.style.top = position.top + 'px';
      bgRight.style.left = position.right + 'px';
      bgRight.style.height = position.height + 'px';

      var bgBelow = bg.querySelector('.bgBelow');
      bgBelow.style.top = position.bottom + 'px';
      bgBelow.style.height = (this.container.scrollHeight - position.bottom) + 'px';

      var popup = div.querySelector('.editNotePopup');
      popup.style.top = position.top + 'px';
      popup.style.height = position.height + 'px';
      popup.style.left = (pageDiv.offsetLeft + parseFloat(pageStyle.borderLeftWidth)) + 'px';
      popup.style.width = pageDiv.clientWidth + 'px';
    },
  };

  return EditNoteTool;
})();

export {
  EditNoteTool,
};
