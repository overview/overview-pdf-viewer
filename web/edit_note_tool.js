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
import { scrollIntoView } from './ui_utils';

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
        '<button class="editNotePrevious"><span>Previous</span></button>',
        '<button class="editNoteNext"><span>Next</span></button>',
        '<span class="space"></span>',
        '<button class="editNoteDelete"><span>Delete</span></button>',
        '<button class="editNoteClose"><span>Close</span></button>',
      '</div>',
      '<div class="editNoteHighlight"></div>',
      '<form method="POST" action="">',
        '<div>',
          '<textarea name="note"></textarea>',
          '<button class="editNoteSave" disabled><span>Save</span></button>',
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
      this.eventBus.on('clicknote', this.setNote.bind(this));
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
      this.div.querySelector('textarea')
        .addEventListener('input', this._onTextInput.bind(this));
      this.div.querySelector('form')
        .addEventListener('submit', this._onSubmit.bind(this));
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

    _setError: function(err) {
      console.warn(err);

      this.div.classList.add('error');

      this._disableToolbarButtons();
      var error = document.createElement('p');
      error.className = 'error';
      error.textContent =
        'Save failed. Please reload this document and try again.';

      this._disableForm();
      var form = this.div.querySelector('form');
      form.appendChild(error);
    },

    deleteNote: function() {
      var noteStore = this.pdfViewer.noteStore; // assume it's set

      this._disableToolbarButtons();
      this._disableForm();

      this.div.classList.add('deleting');

      var self = this;
      return noteStore.deleteNote(this.currentNote)
        .then(
          // No need to unset 'deleting': the entire div is about to disappear
          function() { self.setNote(null); },
          function(err) { self._setError(err); }
        );
    },

    _disableToolbarButtons: function() {
      var buttons = this.div.querySelectorAll('.editNoteToolbar button');
      for (var i = 0, ii = buttons.length; i < ii; i++) {
        buttons[i].disabled = true;
      }
    },

    _enableToolbarButtons: function() {
      var buttons = this.div.querySelectorAll('.editNoteToolbar button');
      for (var i = 0, ii = buttons.length; i < ii; i++) {
        buttons[i].disabled = false;
      }
    },

    _disableForm: function() {
      this.div.querySelector('textarea').disabled = true;
      this.div.querySelector('form button').disabled = true;
    },

    _enableForm: function() {
      this.div.querySelector('textarea').disabled = false;
      this.div.querySelector('form button').disabled = false;
    },

    saveNote: function() {
      var noteStore = this.pdfViewer.noteStore; // assume it's set

      this.div.classList.add('saving');
      this._disableToolbarButtons();
      this._disableForm();

      var textarea = this.div.querySelector('form textarea');
      var text = textarea.value;

      var self = this;
      return noteStore.setNoteText(this.currentNote, text)
        .then(
          function() {
            self.div.classList.remove('saving');
            self._enableToolbarButtons();
            self._enableForm();
            self.div.querySelector('button').disabled = true; // until an edit
          },
          function(err) {
            self.div.classList.remove('saving');
            self._setError(err);
          }
        );
    },

    _onTextInput: function(ev) {
      ev.target.nextSibling.disabled = false;
    },

    _onMousedownBackground: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
    },

    _onClickPrevious: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.eventBus.dispatch('movetopreviousnote');
    },

    _onClickNext: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.eventBus.dispatch('movetonextnote');
    },

    _onClickDelete: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.deleteNote();
    },

    _onClickClose: function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
    },

    _onSubmit: function(ev) {
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

      scrollIntoView(this.div.querySelector('.editNotePopup'), {
        top: -80, // so the edit-note toolbar appears, which is negative-offset
        left: 0,
      });
    },
  };

  return EditNoteTool;
})();

export {
  EditNoteTool,
};
