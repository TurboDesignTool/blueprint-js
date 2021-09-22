import {
    EventDispatcher,
    WebGLRenderer,
    ImageUtils,
    PerspectiveCamera,
    AxesHelper,
    Vector3,
    Vector2,
    Plane
} from 'three';
import { PCFSoftShadowMap } from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';

import {
    EVENT_CAMERA_ACTIVE_STATUS,
    EVENT_CAMERA_VIEW_CHANGE, EVENT_FLOOR_CLICKED, EVENT_GLTF_READY, EVENT_ITEM_SELECTED, EVENT_ITEM_UNSELECTED,
    EVENT_NOTHING_CLICKED,
    EVENT_UPDATED, EVENT_WALL_CLICKED
} from '../core/events.js';

import { Skybox } from './skybox.js';
import { Edge3D } from './edge3d.js';
import { Floor3D } from './floor3d.js';
import { Lights3D } from './lights3d.js';
import {HUD} from '../three/hud';
import {Controller} from '../three/controller';
import {VIEW_FRONT, VIEW_ISOMETRY, VIEW_LEFT, VIEW_RIGHT, VIEW_TOP} from '../core/constants';
import {OrbitControls} from '../three/orbitcontrols';
export class Viewer3D extends EventDispatcher {
    constructor(model, element, opts) {
        super();
        const options = {
            resize: true,
            pushHref: false,
            spin: true,
            spinSpeed: 0.00002,
            clickPan: true,
            canMoveFixedItems: false
        };
        for (const opt in options) {
            if (options.hasOwnProperty(opt) && opts.hasOwnProperty(opt)) {
                options[opt] = opts[opt];
            }
        }
        this.model = model;
        this.floorplan = this.model.floorplan;
        this.scene = model.scene;
        this.options = options;

        this.domElement = document.getElementById(element);
        this.element = document.getElementById(element);
        console.log('QUERY DOM ELEMENT : ', element, this.domElement, element);
        this.perspectivecamera = null;
        this.camera = null;

        this.cameraNear = 10;
        this.cameraFar = 10000;

        this.controls = null;

        this.renderer = null;
        this.controller = null;

        this.needsUpdate = false;
        this.lastRender = Date.now();

        this.heightMargin = null;
        this.widthMargin = null;
        this.elementHeight = null;
        this.elementWidth = null;
        this.pauseRender = false;
        this.edges3d = [];
        this.floors3d = [];
        this.draggables = [];

        this.scene.needsUpdate = true;

        this.lastRender = Date.now();

        this.mouseOver = false;
        this.hasClicked = false;

        this.hud = null;

        this.heightMargin = null;
        this.widthMargin = null;
        this.elementHeight = null;
        this.elementWidth = null;
        const scope = this;
        this.updatedevent = () => { scope.centerCamera(); };
        this.gltfreadyevent = (o) => { scope.gltfReady(o); };

        this.clippingPlaneActive = new Plane(new Vector3(0, 0, 1), 0.0);
        this.clippingPlaneActive2 = new Plane(new Vector3(0, 0, -1), 0.0);
        this.globalClippingPlane = [this.clippingPlaneActive, this.clippingPlaneActive2];
        this.clippingEmpty = Object.freeze([]);
        this.clippingEnabled = false;
        this.init();
    }

    init() {
        const scope = this;
        ImageUtils.crossOrigin = '';

        scope.camera = new PerspectiveCamera(45, 10, scope.cameraNear, scope.cameraFar);

        scope.renderer = scope.getARenderer();
        scope.domElement.appendChild(scope.renderer.domElement);

        scope.lights = new Lights3D(scope.scene, scope.floorplan);
        scope.dragcontrols = new DragControls(scope.scene.items, scope.camera, scope.renderer.domElement);
        scope.controls = new OrbitControls(scope.camera, scope.domElement);
        scope.controls.autoRotate = this.options['spin'];
        scope.controls.enableDamping = false;
        scope.controls.dampingFactor = 0.1;
        scope.controls.maxPolarAngle = Math.PI; //Math.PI * 0.5; //Math.PI * 0.35;
        scope.controls.maxDistance = 2500; //2500
        scope.controls.minDistance = 10; //1000; //1000
        scope.controls.screenSpacePanning = true;

        scope.skybox = new Skybox(scope.scene, scope.renderer);
        scope.camera.position.set(0, 600, 1500);
        scope.controls.update();

        scope.axes = new AxesHelper(500);
        scope.scene.add(scope.axes);
        scope.hud = new HUD(scope, scope.scene);
        scope.controller = new Controller(scope, scope.model, scope.camera, scope.element, scope.controls, scope.hud);


        scope.dragcontrols.addEventListener('dragstart', () => { scope.controls.enabled = false; });
        scope.dragcontrols.addEventListener('drag', () => { scope.scene.needsUpdate = true; });
        scope.dragcontrols.addEventListener('dragend', () => { scope.controls.enabled = true; });

        // handle window resizing
        scope.updateWindowSize();

        if (scope.options.resize) {
            window.addEventListener('resize', () => { scope.updateWindowSize(); });
            window.addEventListener('orientationchange', () => { scope.updateWindowSize(); });
        }

        function animate() {
            scope.renderer.setAnimationLoop(function() { scope.render(); });
            scope.render();
        }
        scope.floorplan.addEventListener(EVENT_UPDATED, (evt) => scope.addWalls(evt));
        this.controls.addEventListener('change', () => { scope.scene.needsUpdate = true; });
        animate();
    }

    addWalls() {
        const scope = this;
        let i = 0;

        // clear scene
        scope.floors3d.forEach((floor) => {
            floor.removeFromScene();
        });

        scope.edges3d.forEach((edge3d) => {
            edge3d.remove();
        });

        scope.edges3d = [];
        let wallEdges = scope.floorplan.wallEdges();
        let rooms = scope.floorplan.getRooms();

        // draw floors
        for (i = 0; i < rooms.length; i++) {
            const threeFloor = new Floor3D(scope.scene, rooms[i]);
            scope.floors3d.push(threeFloor);
            threeFloor.addToScene();
        }

        for (i = 0; i < wallEdges.length; i++) {
            let edge3d = new Edge3D(scope.model.scene, wallEdges[i], scope.controls);
            scope.edges3d.push(edge3d);
        }

        scope.shouldRender = true;

        let floorplanCenter = scope.floorplan.getDimensions(true);
        scope.controls.target = floorplanCenter.clone();
        scope.camera.position.set(floorplanCenter.x, 300, floorplanCenter.z * 5);
        scope.controls.update();
    }

    getARenderer() {
        const renderer = new WebGLRenderer({antialias: true, alpha: true});

        renderer.shadowMap.enabled = true;
        renderer.shadowMapSoft = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.setClearColor(0xFFFFFF, 1);
        renderer.localClippingEnabled = false;
        return renderer;
    }

    updateWindowSize() {
        const scope = this;

        scope.heightMargin = scope.domElement.offsetTop;
        scope.widthMargin = scope.domElement.offsetLeft;
        scope.elementWidth = scope.domElement.clientWidth;

        if (scope.options.resize) {
            scope.elementHeight = window.innerHeight - scope.heightMargin;
        } else {
            scope.elementHeight = scope.domElement.clientHeight;
        }
        scope.camera.aspect = scope.elementWidth / scope.elementHeight;
        scope.camera.updateProjectionMatrix();
        scope.renderer.setSize(scope.elementWidth, scope.elementHeight);
        scope.scene.needsUpdate = true;
    }

    render() {
        const scope = this;
        if (!scope.scene.needsUpdate) {
            return;
        }
        scope.renderer.render(scope.scene.getScene(), scope.camera);
        scope.lastRender = Date.now();
        this.scene.needsUpdate = false;
    }

    exportForBlender() {
        this.skybox.setEnabled(false);
        this.controller.showGroundPlane(false);
        this.model.exportForBlender();
    }

    gltfReady(o) {
        this.dispatchEvent({ type: EVENT_GLTF_READY, item: this, gltf: o.gltf });
        this.skybox.setEnabled(true);
        this.controller.showGroundPlane(true);
    }

    itemIsSelected(item) {
        this.dispatchEvent({ type: EVENT_ITEM_SELECTED, item: item });
    }

    itemIsUnselected() {
        this.dispatchEvent({ type: EVENT_ITEM_UNSELECTED });
    }

    wallIsClicked(wall) {
        this.dispatchEvent({ type: EVENT_WALL_CLICKED, item: wall, wall: wall });
    }

    floorIsClicked(item) {
        this.dispatchEvent({ type: EVENT_FLOOR_CLICKED, item: item });
    }

    nothingIsClicked() {
        this.dispatchEvent({ type: EVENT_NOTHING_CLICKED });
    }

    spin() {
        const scope = this;
        scope.controls.autoRotate = scope.options.spin && !scope.mouseOver && !scope.hasClicked;
    }

    dataUrl() {
        const dataUrl = this.renderer.domElement.toDataURL('image/png');
        return dataUrl;
    }

    stopSpin() {
        this.hasClicked = true;
        this.controls.autoRotate = false;
    }

    options() {
        return this.options;
    }

    getModel() {
        return this.model;
    }

    getScene() {
        return this.scene;
    }

    getController() {
        return this.controller;
    }

    getCamera() {
        return this.camera;
    }


    /*
     * This method name conflicts with a variable so changing it to a different
     * name needsUpdate() { this.needsUpdate = true; }
     */

    ensureNeedsUpdate() {
        this.needsUpdate = true;
    }

    rotatePressed() {
        this.controller.rotatePressed();
    }

    rotateReleased() {
        this.controller.rotateReleased();
    }

    setCursorStyle(cursorStyle) {
        this.domElement.style.cursor = cursorStyle;
    }

    centerCamera() {
        const scope = this;
        const yOffset = 150.0;
        const pan = scope.model.floorplan.getCenter();
        pan.y = yOffset;
        scope.controls.target = pan;
        const distance = scope.model.floorplan.getSize().z * 1.5;
        const offset = pan.clone().add(new Vector3(0, distance, distance));
        scope.camera.position.copy(offset);
        scope.controls.update();
    }

    // projects the object's center point into x,y screen coords
    // x,y are relative to top left corner of viewer
    projectVector(vec3, ignoreMargin) {
        const scope = this;
        ignoreMargin = ignoreMargin || false;
        const widthHalf = scope.elementWidth / 2;
        const heightHalf = scope.elementHeight / 2;
        const vector = new Vector3();
        vector.copy(vec3);
        vector.project(scope.camera);

        const vec2 = new Vector2();
        vec2.x = (vector.x * widthHalf) + widthHalf;
        vec2.y = -(vector.y * heightHalf) + heightHalf;
        if (!ignoreMargin) {
            vec2.x += scope.widthMargin;
            vec2.y += scope.heightMargin;
        }
        return vec2;
    }

    sceneGraph(obj) {
        console.group(' <%o> ' + obj.name, obj);
        obj.children.forEach(this.sceneGraph);
        console.groupEnd();
    }

    switchWireframe(flag) {
        this.model.switchWireframe(flag);
        this.floorplan.switchWireframe(flag);
        this.render(true);
    }

    pauseTheRendering(flag) {
        this.pauseRender = flag;
    }

    switchView(viewpoint) {
        const center = this.model.floorplan.getCenter();
        const size = this.model.floorplan.getSize();
        const distance = this.controls.object.position.distanceTo(this.controls.target);
        this.controls.target.copy(center);

        switch (viewpoint) {
            case VIEW_TOP:
                center.y = 1000;
                this.dispatchEvent({ type: EVENT_CAMERA_VIEW_CHANGE, view: VIEW_TOP });
                break;
            case VIEW_FRONT:
                center.z = center.z - (size.z * 0.5) - distance;
                this.dispatchEvent({ type: EVENT_CAMERA_VIEW_CHANGE, view: VIEW_FRONT });
                break;
            case VIEW_RIGHT:
                center.x = center.x + (size.x * 0.5) + distance;
                this.dispatchEvent({ type: EVENT_CAMERA_VIEW_CHANGE, view: VIEW_RIGHT });
                break;
            case VIEW_LEFT:
                center.x = center.x - (size.x * 0.5) - distance;
                this.dispatchEvent({ type: EVENT_CAMERA_VIEW_CHANGE, view: VIEW_LEFT });
                break;
            case VIEW_ISOMETRY:
            default:
                center.x += distance;
                center.y += distance;
                center.z += distance;
                this.dispatchEvent({ type: EVENT_CAMERA_VIEW_CHANGE, view: VIEW_ISOMETRY });
        }
        this.camera.position.copy(center);
        this.controls.dispatchEvent({ type: EVENT_CAMERA_ACTIVE_STATUS });
        this.controls.needsUpdate = true;
        this.controls.update();
        this.render(true);
    }

    lockView(locked) {
        this.controls.enableRotate = locked;
        this.render(true);
    }

    // Send in a value between -1 to 1
    changeClippingPlanes(clipRatio, clipRatio2) {
        const size = this.model.floorplan.getSize();
        size.z = size.z + (size.z * 0.25);
        size.z = size.z * 0.5;
        this.clippingPlaneActive.constant = (this.model.floorplan.getSize().z * clipRatio);
        this.clippingPlaneActive2.constant = (this.model.floorplan.getSize().z * clipRatio2);

        if (!this.clippingEnabled) {
            this.clippingEnabled = true;
            this.renderer.clippingPlanes = this.globalClippingPlane;
        }
        this.controls.dispatchEvent({ type: EVENT_CAMERA_ACTIVE_STATUS });
        this.controls.needsUpdate = true;
        this.controls.update();
        this.render(true);
    }

    resetClipping() {
        this.clippingEnabled = false;
        this.renderer.clippingPlanes = this.clippingEmpty;
        this.controls.needsUpdate = true;
        this.controls.update();
        this.render(true);
    }

    shouldRender() {
        const scope = this;
        // Do we need to draw a new frame
        if (scope.controls.needsUpdate || scope.controller.needsUpdate || scope.needsUpdate || scope.model.scene.needsUpdate) {
            scope.controls.needsUpdate = false;
            scope.controller.needsUpdate = false;
            scope.needsUpdate = false;
            scope.model.scene.needsUpdate = false;
            return true;
        } else {
            return false;
        }
    }

    rendervr() {

    }
}
