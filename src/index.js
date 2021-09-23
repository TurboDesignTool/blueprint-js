import { BlueprintJS } from './scripts/blueprint.js';
import { EVENT_LOADED } from './scripts/core/events.js';
import { Configuration, configDimUnit } from './scripts/core/configuration.js';
import { dimMeter } from './scripts/core/constants.js';

let blueprint3d = null;
// eslint-disable-next-line no-undef
const test_json = require('./test.json');

let opts = {
    viewer2d: {
        id: 'bp3djs-viewer2d',
        viewer2dOptions: {
            'corner-radius': 7.5,
            pannable: true,
            zoomable: true,
            dimlinecolor: '#3E0000',
            dimarrowcolor: '#FF0000',
            dimtextcolor: '#000000'
        }
    },
    viewer3d: 'bp3djs-viewer3d',
    textureDir: 'models/textures/',
    widget: false,
    resize: true,
};
console.log('ON DOCUMENT READY ');
blueprint3d = new BlueprintJS(opts);
Configuration.setValue(configDimUnit, dimMeter);
blueprint3d.model.addEventListener(EVENT_LOADED, function() { console.log('LOAD SERIALIZED JSON ::: '); });
blueprint3d.model.loadSerialized(test_json);

document.getElementById('switch-viewer').onclick = function() {
    blueprint3d.switchView();
};

document.getElementById('draw-viewer2d').onclick = function() {
    blueprint3d.setViewer2DModeToDraw();
};

document.getElementById('move-viewer2d').onclick = function() {
    blueprint3d.setViewer2DModeToMove();
};
document.getElementById('center-viewer2d').onclick = function() {
    blueprint3d.setView2DMoveToCenter();
};
document.getElementById('top-viewer').onclick = function () {
    blueprint3d.three.switchView('topview');
};
document.getElementById('export3D-img').onclick = function () {
    blueprint3d.three.exportImg();
};
document.getElementById('export2D-img').onclick = function () {
    blueprint3d.floorplanner.exportImg();
};
