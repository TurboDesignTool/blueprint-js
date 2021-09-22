import { dimCentiMeter } from './constants.js';
import { EventDispatcher } from 'three';
import { EVENT_CHANGED } from './events.js';


// GENERAL:
/** The dimensioning unit for 2D floorplan measurements. */
export var configDimUnit = 'dimUnit';
// WALL:
/** The initial wall height in cm. */
export const configWallHeight = 'wallHeight';
/** The initial wall thickness in cm. */
export const configWallThickness = 'wallThickness';

export const configSystemUI = 'systemUI';

export const scale = 'scale';

export const gridSpacing = 'gridSpacing';
export const snapToGrid = 'snapToGrid';
export const directionalDrag = 'directionalDrag';
export const dragOnlyX = 'dragOnlyX';
export const dragOnlyY = 'dragOnlyY';
export const snapTolerance = 'snapTolerance'; //In CMS
export const boundsX = 'boundsX'; //In CMS
export const boundsY = 'boundsY'; //In CMS


export var config = { dimUnit: dimCentiMeter, wallHeight: 250, wallThickness: 20, systemUI: false, scale: 1, snapToGrid: false, dragOnlyX: false, dragOnlyY: false, snapTolerance: 50, gridSpacing: 50, directionalDrag: false, boundsX: 500, boundsY: 500 };

export var wallInformation = { exterior: false, interior: false, midline: true, labels: true, exteriorlabel: 'e:', interiorlabel: 'i:', midlinelabel: 'm:' };


/**
 * The tolerance in cms between corners, otherwise below this tolerance they will snap together as one corner*/
export const cornerTolerance = 20;

/** Global configuration to customize the whole system.
 * This is a singleton instance;
 */
export class Configuration extends EventDispatcher {
    constructor() {
        /** Configuration data loaded from/stored to extern. */
        super();
    }

    static getInstance() {
        if (this.__instance === undefined) {
            this.__instance = new Configuration();
        }
        return this.__instance;
    }

    static getData() {
        return config;
    }

    /** Set a configuration parameter. */
    static setValue(key, value) {
        config[key] = value;
        Configuration.getInstance().dispatchEvent({ type: EVENT_CHANGED, item: Configuration.getInstance(), 'key': key, 'value': value });
    }

    /** Get a string configuration parameter. */
    static getStringValue(key) {
        switch (key) {
            case configDimUnit:
                return String(Configuration.getData()[key]);
            default:
                throw new Error('Invalid string configuration parameter: ' + key);
        }
    }

    /** Get a numeric configuration parameter. */
    static getNumericValue(key) {
        switch (key) {
            case configSystemUI:
            case configWallHeight:
            case configWallThickness:
            case scale:
            case snapToGrid:
            case directionalDrag:
            case dragOnlyX:
            case dragOnlyY:
            case boundsX:
            case boundsY:
            case snapTolerance:
            case gridSpacing:
                return Number(Configuration.getData()[key]);
            default:
                throw new Error('Invalid numeric configuration parameter: ' + key);
        }
    }
}
