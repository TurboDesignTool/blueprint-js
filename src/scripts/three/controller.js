import { EventDispatcher, Vector2, Vector3, Mesh, PlaneGeometry, MeshBasicMaterial, Raycaster } from 'three';
import { EVENT_ITEM_REMOVED, EVENT_ITEM_LOADED } from '../core/events.js';
import { Utils } from '../core/utils.js';

export const states = { UNSELECTED: 0, SELECTED: 1, DRAGGING: 2, ROTATING: 3, ROTATING_FREE: 4, PANNING: 5 };

// Controller is the class that maintains the items, floors, walls selection in
// the 3d scene
export class Controller extends EventDispatcher {
    constructor(three, model, camera, element, controls, hud) {
        super();
        this.three = three;
        this.model = model;
        this.camera = camera;
        this.element = element;
        this.controls = controls;
        this.hud = hud;

        this.enabled = true;
        this.scene = model.scene;

        this.plane = null;
        this.mouse = new Vector2(0, 0);
        this.alternateMouse = new Vector2(0, 0);

        this.intersectedObject = null;
        this.mouseoverObject = null;
        this.selectedObject = null;

        this.mouseDown = false;
        this.mouseMoved = false; // has mouse moved since down click
        this.rotateMouseOver = false;

        this.state = states.UNSELECTED;
        this.needsUpdate = true;

        const scope = this;
        this.itemremovedevent = (o) => { scope.itemRemoved(o.item); };
        this.itemloadedevent = (o) => { scope.itemLoaded(o.item); };

        this.mousedownevent = (event) => { scope.mouseDownEvent(event); };
        this.mouseupevent = (event) => { scope.mouseUpEvent(event); };
        this.mousemoveevent = (event) => { scope.mouseMoveEvent(event); };
        this.init();
    }


    init() {
        this.element.addEventListener('mousedown', this.mousedownevent);
        this.element.addEventListener('mousemove', this.mousemoveevent);
        this.element.addEventListener('mouseup', this.mouseupevent);

        this.scene.addEventListener(EVENT_ITEM_REMOVED, this.itemremovedevent);
        this.scene.addEventListener(EVENT_ITEM_LOADED, this.itemloadedevent);
        this.setGroundPlane();
    }

    itemRemoved(item) {
        // invoked as a callback to event in Scene
        if (item === this.selectedObject) {
            this.selectedObject.setUnselected();
            this.selectedObject.mouseOff();
            this.setSelectedObject(null);
        }
    }

    // invoked via callback when item is loaded
    itemLoaded(item) {
        const scope = this;
        if (!item.position_set) {
            scope.setSelectedObject(item);
            scope.switchState(states.DRAGGING);
            const pos = item.position.clone();
            pos.y = 0;
            const vec = scope.three.projectVector(pos);
            scope.clickPressed(vec);
        }
        item.position_set = true;
    }

    clickPressed(vec2) {
        this.mouse = vec2 || this.mouse;
        const intersection = this.itemIntersection(this.mouse, this.selectedObject);

        if (intersection) {
            this.selectedObject.clickPressed(intersection);
        }
    }

    clickDragged(vec2) {
        const scope = this;
        this.mouse = vec2 || this.mouse;
        const intersection = scope.itemIntersection(this.mouse, this.selectedObject);
        if (intersection) {
            if (scope.isRotating()) {
                this.selectedObject.rotate(intersection);
            } else {
                this.selectedObject.clickDragged(intersection);
            }
        }
    }

    showGroundPlane(flag) {
        this.plane.visible = flag;
    }

    setGroundPlane() {
        // ground plane used to find intersections
        const size = 10000;

        // The below line was originally setting the plane visibility to false
        // Now its setting visibility to true. This is necessary to be detected
        // with the raycaster objects to click walls and floors.
        this.plane = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ visible: false }));
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.visible = true;
        this.scene.add(this.plane);
    }

    checkWallsAndFloors() {
        // double click on a wall or floor brings up texture change modal
        if (this.state === states.UNSELECTED && this.mouseoverObject == null) {
            // check walls
            const wallEdgePlanes = this.model.floorplan.wallEdgePlanes();
            const wallIntersects = this.getIntersections(this.mouse, wallEdgePlanes, true);
            if (wallIntersects.length > 0) {
                const wall = wallIntersects[0].object.edge;
                // three.wallClicked.fire(wall);
                this.three.wallIsClicked(wall);
                return;
            }

            // check floors
            const floorPlanes = this.model.floorplan.floorPlanes();
            const floorIntersects = this.getIntersections(this.mouse, floorPlanes, false);
            if (floorIntersects.length > 0) {
                const room = floorIntersects[0].object.room;
                // this.three.floorClicked.fire(room);
                this.three.floorIsClicked(room);
                return;
            }
            // three.nothingClicked.fire();
            this.three.nothingIsClicked();
        }
    }

    isRotating() {
        return (this.state === states.ROTATING || this.state === states.ROTATING_FREE);
    }


    mouseDownEvent(event) {
        if (this.enabled) {
            event.preventDefault();

            this.mouseMoved = false;
            this.mouseDown = true;

            if (event.touches) {
                //In case if this is a touch device do the necessary to click and drag items
                this.mouse.x = event.touches[0].clientX;
                this.mouse.y = event.touches[0].clientY;
                this.alternateMouse.x = event.touches[0].clientX;
                this.alternateMouse.y = event.touches[0].clientY;
                this.updateIntersections();
                this.checkWallsAndFloors();
            }
            switch (this.state) {
                case states.SELECTED:
                    if (this.rotateMouseOver) {
                        this.switchState(states.ROTATING);
                    } else if (this.intersectedObject !== null) {
                        this.setSelectedObject(this.intersectedObject);
                        if (!this.intersectedObject.fixed) {
                            this.switchState(states.DRAGGING);
                        }
                    }
                    break;
                case states.UNSELECTED:
                    if (this.intersectedObject !== null) {
                        this.setSelectedObject(this.intersectedObject);
                        if (!this.intersectedObject.fixed) {
                            this.switchState(states.DRAGGING);
                        }
                    }
                    break;
                case states.DRAGGING:
                case states.ROTATING:
                    break;
                case states.ROTATING_FREE:
                    this.switchState(states.SELECTED);
                    break;
            }
        }
    }

    mouseMoveEvent(event) {
        if (this.enabled) {
            event.preventDefault();
            this.mouseMoved = true;

            this.mouse.x = event.clientX;
            this.mouse.y = event.clientY;
            this.alternateMouse.x = event.clientX;
            this.alternateMouse.y = event.clientY;

            if (event.touches) {
                this.mouse.x = event.touches[0].clientX;
                this.mouse.y = event.touches[0].clientY;
                this.alternateMouse.x = event.touches[0].clientX;
                this.alternateMouse.y = event.touches[0].clientY;
            }

            if (!this.mouseDown) {
                this.updateIntersections();
            }
            switch (this.state) {
                case states.UNSELECTED:
                    this.updateMouseover();
                    break;
                case states.SELECTED:
                    this.updateMouseover();
                    break;
                case states.DRAGGING:
                case states.ROTATING:
                case states.ROTATING_FREE:
                    this.clickDragged();
                    this.hud.update();
                    this.needsUpdate = true;
                    // Update position
                    this.setSelectedObject(this.intersectedObject);
                    break;
            }
        }
    }

    mouseUpEvent() {
        if (this.enabled) {
            this.mouseDown = false;

            switch (this.state) {
                case states.DRAGGING:
                    this.selectedObject.clickReleased();
                    this.switchState(states.SELECTED);
                    break;
                case states.ROTATING:
                    if (!this.mouseMoved) {
                        this.switchState(states.ROTATING_FREE);
                    } else {
                        this.switchState(states.SELECTED);
                    }
                    break;
                case states.UNSELECTED:
                    if (!this.mouseMoved) {
                        this.checkWallsAndFloors();
                    }
                    break;
                case states.SELECTED:
                    if (this.intersectedObject === null && !this.mouseMoved) {
                        this.switchState(states.UNSELECTED);
                        this.checkWallsAndFloors();
                    }
                    break;
                case states.ROTATING_FREE:
                    break;
            }
        }
    }

    switchState(newState) {
        if (newState !== this.state) {
            this.onExit(this.state);
            this.onEntry(newState);
        }
        this.state = newState;
        this.hud.setRotating(this.isRotating());
    }

    onEntry(state) {
        switch (state) {
            case states.UNSELECTED:
                this.setSelectedObject(null);
                break;
            case states.SELECTED:
                this.controls.enabled = true;
                break;
            case states.ROTATING:
            case states.ROTATING_FREE:
                this.controls.enabled = false;
                break;
            case states.DRAGGING:
                this.three.setCursorStyle('move');
                this.clickPressed();
                this.controls.enabled = false;
                break;
        }
    }

    onExit(state) {
        switch (state) {
            case states.UNSELECTED:
            case states.SELECTED:
                break;
            case states.DRAGGING:
                if (this.mouseoverObject) {
                    this.three.setCursorStyle('pointer');
                } else {
                    this.three.setCursorStyle('auto');
                }
                break;
            case states.ROTATING:
            case states.ROTATING_FREE:
                break;
        }
    }

    selectedObject() {
        return this.selectedObject;
    }

    // updates the vector of the intersection with the plane of a given
    // mouse position, and the intersected object
    // both may be set to null if no intersection found
    updateIntersections() {
        // check the rotate arrow
        const hudObject = this.hud.getObject();
        if (hudObject !== null) {
            const hudIntersects = this.getIntersections(this.mouse, hudObject, false, false, true);
            if (hudIntersects.length > 0) {
                this.rotateMouseOver = true;
                this.hud.setMouseover(true);
                this.intersectedObject = null;
                return;
            }
        }
        this.rotateMouseOver = false;
        this.hud.setMouseover(false);

        // check objects
        const items = this.model.scene.getItems();
        const intersects = this.getIntersections(this.mouse, items, false, true);
        if (intersects.length > 0) {
            this.intersectedObject = intersects[0].object;
        } else {
            this.intersectedObject = null;
        }
    }

    // returns the first intersection object
    itemIntersection(vec2, item) {
        const customIntersections = item.customIntersectionPlanes();
        if (item.freePosition) {
            return this.freeMouse3D(vec2);
        }
        let intersections = null;
        if (customIntersections && customIntersections.length > 0) {
            intersections = this.getIntersections(vec2, customIntersections, true);
        } else {
            intersections = this.getIntersections(vec2, this.plane);
        }
        if (intersections.length > 0) {
            return intersections[0];
        } else {
            return null;
        }
    }

    // sets coords to -1 to 1
    normalizeVector2(vec2) {
        const retVec = new Vector2();
        retVec.x = ((vec2.x - this.three.widthMargin) / (window.innerWidth - this.three.widthMargin)) * 2 - 1;
        retVec.y = -((vec2.y - this.three.heightMargin) / (window.innerHeight - this.three.heightMargin)) * 2 + 1;
        return retVec;
    }

    //
    mouseToVec3(vec2) {
        const normVec2 = this.normalizeVector2(vec2);
        const vector = new Vector3(normVec2.x, normVec2.y, 0.5);
        vector.unproject(this.camera);
        return vector;
    }

    freeMouse3D(vec2) {
        let distance;
        const pos = new Vector3();
        const vector = this.mouseToVec3(vec2);
        vector.sub(this.camera.position).normalize();
        distance = -this.camera.position.z / vector.z;
        pos.copy(this.camera.position).add(vector.multiplyScalar(distance));
        return { point: pos, distance: distance };
    }

    // filter by normals will only return objects facing the camera
    // objects can be an array of objects or a single object
    getIntersections(vec2, objects, filterByNormals, onlyVisible, recursive, linePrecision) {
        const vector = this.mouseToVec3(vec2);
        onlyVisible = onlyVisible || false;
        filterByNormals = filterByNormals || false;
        recursive = recursive || false;
        linePrecision = linePrecision || 20;

        const direction = vector.sub(this.camera.position).normalize();
        let raycaster = new Raycaster(this.camera.position, direction);
        // raycaster.linePrecision = linePrecision;
        raycaster.params.Line.threshold = linePrecision;

        raycaster = new Raycaster();
        raycaster.setFromCamera(this.normalizeVector2(this.alternateMouse), this.camera);

        let intersections;

        if (objects instanceof Array) {
            intersections = raycaster.intersectObjects(objects, recursive);
        } else {
            intersections = raycaster.intersectObject(objects, recursive);
        }
        // filter by visible, if true
        if (onlyVisible) {
            intersections = Utils.removeIf(intersections, function(intersection) { return !intersection.object.visible; });
        }

        // filter by normals, if true
        if (filterByNormals) {
            intersections = Utils.removeIf(intersections, function(intersection) { var dot = intersection.face.normal.dot(direction); return (dot > 0); });
        }
        return intersections;
    }

    // manage the selected object
    setSelectedObject(object) {
        if (this.state === states.UNSELECTED) {
            this.switchState(states.SELECTED);
        }
        if (this.selectedObject !== null) {
            this.selectedObject.setUnselected();
        }
        if (object !== null) {
            this.selectedObject = object;
            this.selectedObject.setSelected();
            this.three.itemIsSelected(object);
        } else {
            this.selectedObject = null;
            this.three.itemIsUnselected();
        }
        this.needsUpdate = true;
    }

    // TODO: there MUST be simpler logic for expressing this
    updateMouseover() {
        if (this.intersectedObject !== null) {
            if (this.mouseoverObject !== null) {
                if (this.mouseoverObject !== this.intersectedObject) {
                    this.mouseoverObject.mouseOff();
                    this.mouseoverObject = this.intersectedObject;
                    this.mouseoverObject.mouseOver();
                    this.needsUpdate = true;
                } else {
                    // do nothing, mouseover already set
                }
            } else {
                this.mouseoverObject = this.intersectedObject;
                this.mouseoverObject.mouseOver();
                this.three.setCursorStyle('pointer');
                this.needsUpdate = true;
            }
        } else if (this.mouseoverObject !== null) {
            this.mouseoverObject.mouseOff();
            this.three.setCursorStyle('auto');
            this.mouseoverObject = null;
            this.needsUpdate = true;
        }
    }

    changeCamera(newCamera) {
        this.camera = newCamera;
    }
}
