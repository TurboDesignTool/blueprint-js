import { EventDispatcher, Vector2 } from 'three';
import { Plane, Raycaster, Vector3, Matrix4 } from 'three/build/three.module';
import { EVENT_ITEM_SELECTED, EVENT_ITEM_MOVE, EVENT_ITEM_HOVERON, EVENT_ITEM_HOVEROFF, EVENT_ITEM_MOVE_FINISH, EVENT_NO_ITEM_SELECTED, EVENT_WALL_CLICKED, EVENT_FLOOR_CLICKED, EVENT_ROOM_CLICKED } from '../core/events';
import { IS_TOUCH_DEVICE } from '../../DeviceInfo';
import {RotationHelper} from './Hud';

/**
 * This is a custom implementation of the DragControls class
 * In this class the raycaster intersection will not check for children
 * This is supposed to work only for physicalroomitems because it creates
 * a invisible box geometry based on the loaded gltf
 */
export class DragRoomItemsControl3D extends EventDispatcher {
    constructor(walls, floors, items, camera, domElement, view3d) {
        super();
        this.__view3d = view3d;
        this.__walls = walls;
        this.__floors = floors;
        this.__draggableItems = items;
        this.__camera = camera;
        this.__domElement = domElement;
        this.__enabled = true;
        this.__transformGroup = false;

        this.__intersections = [];

        this.__plane = new Plane();// plane of the selected object, which is perpendicular to the camera's world space direction
        this.__raycaster = new Raycaster();
        this.__mouse = new Vector2();// normalized device coordinates of the mouse
        this.__offset = new Vector3(); // offset between the mouse and the center of selected object
        this.__offset2 = new Vector3(); // offset between the mouse and the center of selected object y fixed
        this.__intersection = new Vector3();
        this.__intersection2 = new Vector3();

        this.__rotationHelper = null;
        this.__enableRotation = false;

        this.__worldPosition = new Vector3();
        this.__inverseMatrix = new Matrix4();
        this.__selected = null;// selected object
        this.__hovered = null;

        this.__timestamp = Date.now();

        this.__pressListenerEvent = this.__pressListener.bind(this);
        this.__releaseListenerEvent = this.__releaseListener.bind(this);
        this.__moveListenerEvent = this.__moveListener.bind(this);
        this.activate();
    }

    __pressListener(evt) {
        this.enabled = true;
        let time = Date.now();
        let deltaTime = time - this.__timestamp;
        this.__timestamp = time;
        evt.preventDefault();
        evt = (evt.changedTouches !== undefined) ? evt.changedTouches[0] : evt;
        let rect = this.__domElement.getBoundingClientRect();
        this.__mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
        this.__mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

        this.__intersections.length = 0;

        this.__raycaster.setFromCamera(this.__mouse, this.__camera);
        if (this.__rotationHelper) {
            const hudIntersects = this.__raycaster.intersectObject(this.__rotationHelper, true);
            if (hudIntersects.length) {
                this.enabled = false;
                this.enableRotation = true;
                const customPlanesThatIntersect = this.__raycaster.intersectObjects(this.__selected.intersectionPlanes, true);
                let intersectionData = customPlanesThatIntersect[0];
                this.__intersection = intersectionData.point;
                this.__offset2.copy(this.__intersection).sub(this.__selected.position);
                return;
            }
        }


        this.__raycaster.intersectObjects(this.visibleDraggableItems, false, this.__intersections);
        if (this.__intersections.length) {
            this.__selected = (this.__transformGroup) ? this.__draggableItems[0] : this.__intersections[0].object;

            if (this.__raycaster.ray.intersectPlane(this.__plane, this.__intersection)) {

                this.__inverseMatrix.getInverse(this.__selected.parent.matrixWorld);
                /**
                 * The belwo line for plane setting normal and coplanar point is necessary for touch based events (ref: DragCOntrols.js in three)
                 */
                this.__plane.setFromNormalAndCoplanarPoint(this.__camera.getWorldDirection(this.__plane.normal), this.__worldPosition.setFromMatrixPosition(this.__selected.matrixWorld));
                this.__offset.copy(this.__intersection).sub(this.__worldPosition.setFromMatrixPosition(this.__selected.matrixWorld));
                let customPlanesThatIntersect = this.__raycaster.intersectObjects(this.__selected.intersectionPlanes, true);
                if (customPlanesThatIntersect.length) {
                    let intersectionData = customPlanesThatIntersect[0];
                    this.__intersection = intersectionData.point;
                    this.__offset2.copy(this.__intersection).sub(this.__selected.position);
                    this.__updateHub();
                }
            }
            this.__domElement.style.cursor = 'move';
            this.dispatchEvent({ type: EVENT_ITEM_SELECTED, item: this.__selected });
            return;
        }
        //
        evt = (evt.changedTouches !== undefined) ? evt.changedTouches[0] : evt;
        this.__raycaster.setFromCamera(this.__mouse, this.__camera);

        let wallPlanesThatIntersect = this.__raycaster.intersectObjects(this.__walls, false);
        let floorPlanesThatIntersect = this.__raycaster.intersectObjects(this.__floors, false);
        if (wallPlanesThatIntersect.length) {
            this.dispatchEvent({ type: EVENT_WALL_CLICKED, item: wallPlanesThatIntersect[0].object.edge, point: wallPlanesThatIntersect[0].point, normal: wallPlanesThatIntersect[0].face.normal });
        } else if (floorPlanesThatIntersect.length) {
            this.dispatchEvent({ type: EVENT_ROOM_CLICKED, item: floorPlanesThatIntersect[0].object.room, point: floorPlanesThatIntersect[0].point, normal: floorPlanesThatIntersect[0].face.normal });
        }
        this.__updateSelected();
        this.enabled = false;
        //
        if (deltaTime < 300) {
            this.dispatchEvent({ type: EVENT_NO_ITEM_SELECTED, item: this.__selected });
        }
    }
    __updateSelected() {
        if (this.__rotationHelper) {
            this.__view3d.remove(this.__rotationHelper);
            this.__rotationHelper = null;
        }
        this.dispatchEvent({ type: EVENT_NO_ITEM_SELECTED, item: this.__selected });
    }

    __updateHub() {
        if (!this.__rotationHelper) {
            if (this.__selected.itemModel.allowRotate) {
                this.__rotationHelper = new RotationHelper(this.__selected.itemModel);
                this.__view3d.add(this.__rotationHelper);
            }
        } else {
            this.__rotationHelper.update(this.__selected.itemModel);
        }
    }

    __releaseListener(evt) {
        this.enabled = false;
        this.enableRotation = false;
        evt.preventDefault();
        if (this.__selected) {
            this.dispatchEvent({ type: EVENT_ITEM_MOVE_FINISH, item: this.__selected });
        }
        this.__domElement.style.cursor = (this.__hovered) ? 'pointer' : 'auto';

    }

    __moveListener(evt) {
        evt.preventDefault();
        evt = (evt.changedTouches !== undefined) ? evt.changedTouches[0] : evt;

        let rect = this.__domElement.getBoundingClientRect();
        this.__mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
        this.__mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

        this.__raycaster.setFromCamera(this.__mouse, this.__camera);

        if (this.__rotationHelper && this.enableRotation) {
            const customPlanesThatIntersect = this.__raycaster.intersectObjects(this.__selected.intersectionPlanes, true);
            if (customPlanesThatIntersect.length) {
                this.__selected.rotate(customPlanesThatIntersect[0].point);
                this.dispatchEvent({ type: EVENT_ITEM_MOVE, item: this.__selected });
                this.__updateHub();
                return;
            }
        }

        if (this.__selected && this.__enabled && this.__selected.visible) {
            //Check if the item has customIntersectionPlanes, otherwise move it freely
            if (!this.__selected.intersectionPlanes.length) {
                if (this.__raycaster.ray.intersectPlane(this.__plane, this.__intersection)) {
                    let location = this.__selected.location.clone().copy(this.__intersection.sub(this.__offset).applyMatrix4(this.__inverseMatrix));
                    this.__selected.location = location;
                }
            } else {
                let customPlanesThatIntersect = this.__raycaster.intersectObjects(this.__selected.intersectionPlanes, true);
                if (customPlanesThatIntersect.length) {
                    let intersectionData = customPlanesThatIntersect[0];
                    this.__intersection = intersectionData.point;
                    let location = intersectionData.point;
                    let normal = intersectionData.face.normal;
                    let intersectingPlane = intersectionData.object;
                    this.__selected.snapToPoint(location.clone().sub(this.__offset2), normal, intersectingPlane);
                    this.__updateHub();
                }
            }
            this.dispatchEvent({ type: EVENT_ITEM_MOVE, item: this.__selected });
            return;
        }

        if (IS_TOUCH_DEVICE) {
            return;
        }

        this.__intersections.length = 0;

        this.__raycaster.setFromCamera(this.__mouse, this.__camera);
        this.__raycaster.intersectObjects(this.__draggableItems, false, this.__intersections);
        if (this.__intersections.length) {
            let object = this.__intersections[0].object;
            this.__plane.setFromNormalAndCoplanarPoint(this.__camera.getWorldDirection(this.__plane.normal), this.__worldPosition.setFromMatrixPosition(object.matrixWorld));

            if (this.__hovered !== object) {
                this.__hovered = object;
                this.__domElement.style.cursor = 'pointer';
                this.dispatchEvent({ type: EVENT_ITEM_HOVERON, item: object });
            }
        } else {
            if (this.__hovered !== null) {
                this.__domElement.style.cursor = 'auto';
                this.dispatchEvent({ type: EVENT_ITEM_HOVEROFF, item: this.__hovered });
                this.__hovered = null;
            }
        }
    }

    dispose() {
        this.deactivate();
    }

    activate() {

        this.__domElement.addEventListener('mousedown', this.__pressListenerEvent, false);
        this.__domElement.addEventListener('touchstart', this.__pressListenerEvent, false);

        this.__domElement.addEventListener('mousemove', this.__moveListenerEvent, false);
        this.__domElement.addEventListener('touchmove', this.__moveListenerEvent, false);

        this.__domElement.addEventListener('mouseup', this.__releaseListenerEvent, false);
        this.__domElement.addEventListener('touchend', this.__releaseListenerEvent, false);

    }

    deactivate() {
        this.__domElement.removeEventListener('mousedown', this.__pressListenerEvent, false);
        this.__domElement.removeEventListener('touchstart', this.__pressListenerEvent, false);

        this.__domElement.removeEventListener('mousemove', this.__moveListenerEvent, false);
        this.__domElement.removeEventListener('touchmove', this.__moveListenerEvent, false);

        this.__domElement.removeEventListener('mouseup', this.__releaseListenerEvent, false);
        this.__domElement.removeEventListener('touchend', this.__releaseListenerEvent, false);

        this.__domElement.style.cursor = '';

    }

    get enabled() {
        return this.__enabled;
    }

    set enabled(flag) {
        this.__enabled = flag;
    }

    set enableRotation(flag) {
        this.__enableRotation = flag;
    }

    get enableRotation() {
        return  this.__enableRotation;
    }

    get draggableItems() {
        return this.__draggableItems;
    }

    set draggableItems(items) {
        this.__draggableItems = items;
    }
    get visibleDraggableItems() {
        return  this.__draggableItems.filter(_ => _.visible);
    }
}
