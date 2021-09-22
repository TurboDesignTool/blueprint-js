import { Configuration, configDimUnit } from './core/configuration';
import { dimCentiMeter } from './core/constants';
import { Model } from './model/model';
import { Viewer3D } from './viewer3d/Viewer3d';
import { Viewer2D, floorplannerModes } from './viewer2d/Viewer2D';

///** BlueprintJS core application. */
class BlueprintJS {
    /**
     * Creates an instance of BlueprintJS. This is the entry point for the application
     *
     * @param {Object} - options The initialization options.
     * @param {string} options.floorplannerElement - Id of the html element to use as canvas. Needs to exist in the html
     * @param {string} options.threeElement - Id of the html element to use as canvas. Needs to exist in the html and should be #idofhtmlelement
     * @param {string} options.threeCanvasElement - Id of the html element to use as threejs-canvas. This is created automatically
     * @param {string} options.textureDir - path to texture directory. No effect
     * @param {boolean} options.widget - If widget mode then disable the controller from interactions
     * @example
     * let blueprint3d = new BP3DJS.BlueprintJS(opts);
     */
    constructor(options) {
        Configuration.setValue(configDimUnit, dimCentiMeter);

        /**
         * @property {Object} options
         * @type {Object}
         **/
        this.options = options;
        /**
         * @property {Model} model
         * @type {Model}
         **/
        this.model = new Model(options.textureDir);
        /**
         * @property {Viewer3D} three
         * @type {Viewer3D}
         **/
        this.three = new Viewer3D(this.model, options.viewer3d, this.options);
        if (!options.widget) {
            /**
             * @property {Viewer2D} floorplanner
             * @type {Viewer2D}
             **/
            this.floorplanner = new Viewer2D(options.viewer2d.id, this.model.floorplan, this.options.viewer2d.viewer2dOptions);
        }

        this.view_now = 2;
        this.switchView();
    }

    switchView() {
        if (this.options.widget) {
            return;
        }
        if (this.view_now === 3) {
            this.view_now = 2;
            document.getElementById(this.options.viewer2d.id).style.visibility = 'visible';
            document.getElementById(this.options.viewer3d).style.visibility = 'hidden';
        } else if (this.view_now === 2) {
            this.view_now = 3;
            document.getElementById(this.options.viewer2d.id).style.visibility = 'hidden';
            document.getElementById(this.options.viewer3d).style.visibility = 'visible';
        }
    }

    setViewer2DModeToDraw(mode) {
        if (this.options.widget) {
            return;
        }
        this.floorplanner.switchMode(floorplannerModes.DRAW);
    }

    setViewer2DModeToMove(mode) {
        if (this.options.widget) {
            return;
        }
        this.floorplanner.switchMode(floorplannerModes.MOVE);
    }
    setView2DMoveToCenter() {
        this.floorplanner.moveToCenter();
    }
}
export { BlueprintJS };
