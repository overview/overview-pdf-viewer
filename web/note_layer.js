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
import { CustomStyle } from './pdfjs';

/**
 * @typedef {Object} NoteElementPrameters
 * @property {Object} data
 * @property {HTMLDivElement} layer
 * @property {PageViewport} viewport
 */

/**
 * @class
 * @alias NoteElementFactory
 */
function NoteElementFactory() {}
NoteElementFactory.prototype =
    /** @lends NoteElementFactory.prototype */ {
  /**
   * @param {NoteElementParameters} parameters
   * @returns {NoteElement}
   */
  create: function NoteElementFactory_create(parameters) {
    return new NoteElement(parameters);
  },
};

/**
 * @class
 * @alias NoteElement
 */
var NoteElement = (function NoteElementClosure() {
  function NoteElement(parameters) {
    this.data = parameters.data;
    this.layer = parameters.layer;
    this.viewport = parameters.viewport;

    this.container = this._createContainer();
  }

  NoteElement.prototype = /** @lends NoteElement.prototype */ {
    /**
     * Create an empty container for the note's HTML element.
     *
     * @private
     * @memberof NoteElement
     * @returns {HTMLSectionElement}
     */
    _createContainer: function NoteElement_createContainer() {
      var data = this.data, viewport = this.viewport;
      var container = document.createElement('section');

      var rect = Util.normalizeRect(viewport.convertToViewportRectangle([
        data.x,
        data.y,
        data.x + data.width,
        data.y + data.height,
      ]));

      container.style.left = rect[0] + 'px';
      container.style.top = rect[1] + 'px';
      container.style.width = (rect[2] - rect[0]) + 'px';
      container.style.height = (rect[3] - rect[1]) + 'px';

      return container;
    },
  };

  return NoteElement;
})();

/**
 * @typedef {Object} NoteLayerParameters
 * @property {PageViewport} viewport
 * @property {HTMLDivElement} div
 * @property {Array} notes
 */

/**
 * @class
 * @alias NoteLayer
 */
var NoteLayer = (function NoteLayerClosure() {
  return {
    /**
     * Render a new note layer with all note elements.
     *
     * @public
     * @param {NoteLayerParameters} parameters
     * @memberof NoteLayer
     */
    render: function NoteLayer_render(parameters) {
      var noteElementFactory = new NoteElementFactory();

      for (var i = 0, ii = parameters.notes.length; i < ii; i++) {
        var data = parameters.notes[i];
        if (!data) {
          continue;
        }

        var element = noteElementFactory.create({
          data,
          layer: parameters.div,
          viewport: parameters.viewport,
        });
        parameters.div.appendChild(element.container);
      }

      parameters.div.removeAttribute('hidden');
    },
  };
})();

export {
  NoteLayer,
};
