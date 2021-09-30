import { Item, UP_VECTOR } from './item.js';
import { Vector2, Vector3 } from 'three';
import { Utils } from '../core/utils.js';

/**
 * A Floor Item is an entity to be placed related to a floor.
 */
export class FloorItem extends Item {
    constructor(model, metadata, id) {
        super(model, metadata, id);
        this._freePosition = false;
        this.__customIntersectionPlanes = this.__model.floorplan.floorPlanesForIntersection;
    }

    snapToPoint(point, normal, intersectingPlane, toWall, toFloor, toRoof) {
        point.y = this.halfSize.y + 5;
        this.position = point;
    }
}
