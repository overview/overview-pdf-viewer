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

import { Util } from "../shared/util.js";

/**
 * @typedef {Object} NoteElementParameters
 * @property {Object} data
 * @property {HTMLDivElement} layer
 * @property {PageViewport} viewport
 */

class NoteElementFactory {
  /**
   * @param {NoteElementParameters} parameters
   * @returns {NoteElement}
   */
  static create(parameters) {
    return new NoteElement(parameters);
  }
}

class NoteElement {
  constructor(parameters) {
    this.data = parameters.data;
    this.layer = parameters.layer;
    this.viewport = parameters.viewport;

    this.container = this._createContainer();
  }

  /**
   * Create an empty container for the note's HTML element.
   *
   * @private
   * @memberof NoteElement
   * @returns {HTMLSectionElement}
   */
  _createContainer() {
    const data = this.data,
      viewport = this.viewport;
    const container = document.createElement("section");

    const rect = Util.normalizeRect(
      viewport.convertToViewportRectangle([
        data.x,
        data.y,
        data.x + data.width,
        data.y + data.height,
      ])
    );

    container.style.left = `${rect[0]}px`;
    container.style.top = `${rect[1]}px`;
    container.style.width = `${rect[2] - rect[0]}px`;
    container.style.height = `${rect[3] - rect[1]}px`;

    return container;
  }
}

/**
 * @typedef {Object} NoteLayerParameters
 * @property {PageViewport} viewport
 * @property {HTMLDivElement} div
 * @property {Array} notes
 */

class NoteLayer {
  /**
   * Render a new note layer with all note elements.
   *
   * @public
   * @param {NoteLayerParameters} parameters
   * @memberof NoteLayer
   */
  static render(parameters) {
    for (const data of parameters.notes) {
      if (!data) {
        continue;
      }

      const element = NoteElementFactory.create({
        data,
        layer: parameters.div,
        viewport: parameters.viewport,
      });
      parameters.div.appendChild(element.container);
    }
  }
}

export { NoteLayer };
