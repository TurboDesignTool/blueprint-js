import { WebGLRenderer, ImageUtils, PerspectiveCamera, AxesHelper, Scene, RGBFormat, LinearMipmapLinearFilter, sRGBEncoding } from 'three';
import { PCFSoftShadowMap, WebGLCubeRenderTarget, CubeCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

import { EVENT_LOADED, EVENT_ITEM_SELECTED, EVENT_ITEM_MOVE, EVENT_ITEM_MOVE_FINISH, EVENT_NO_ITEM_SELECTED, EVENT_WALL_CLICKED, EVENT_ROOM_CLICKED, EVENT_GLTF_READY, EVENT_NEW_ITEM, EVENT_NEW_ROOMS_ADDED, EVENT_MODE_RESET, EVENT_EXTERNAL_FLOORPLAN_LOADED } from '../core/events.js';

import { Skybox } from './Skybox.js';
import { Edge3D } from './Edge3d.js';
import { Floor3D } from './Floor3d.js';
import { Lights3D } from './Lights3d.js';
import { Physical3DItem } from './Physical3DItem.js';
import { DragRoomItemsControl3D } from './DragRoomItemsControl3D.js';
import { Configuration, viewBounds } from '../core/configuration.js';
import { BoundaryView3D } from './BoundaryView3D.js';
export class Viewer3D extends Scene {
    constructor(model, element, opts
    ) {
        super();
        let options = {
            occludedRoofs: false,
            occludedWalls: false,
            resize: true,
            pushHref: false,
            spin: true,
            spinSpeed: 0.00002,
            clickPan: true,
            canMoveFixedItems: false };
        for (let opt in options) {
            if (options.hasOwnProperty(opt) && opts.hasOwnProperty(opt)) {
                options[opt] = opts[opt];
            }
        }

        // console.log('VIEWER 3D ::: ', options);

        this.__physicalRoomItems = [];
        this.__enabled = true;
        this.model = model;
        this.floorplan = this.model.floorplan;
        this.__options = options;

        this.domElement = document.getElementById(element);

        this.perspectivecamera = null;
        this.camera = null;
        this.__environmentCamera = null;

        this.cameraNear = 10;
        this.cameraFar = 100000;
        this.orbitControl = null;

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

        this.__externalEdges3d = [];
        this.__externalFloors3d = [];

        this.__boundaryRegion3D = null;
        this.__currentItemSelected = null;

        this.needsUpdate = true;

        this.__newItemEvent = this.__addNewItem.bind(this);
        this.__wallSelectedEvent = this.__wallSelected.bind(this);
        this.__roomSelectedEvent = this.__roomSelected.bind(this);
        this.__roomItemSelectedEvent = this.__roomItemSelected.bind(this);
        this.__roomItemUnselectedEvent = this.__roomItemUnselected.bind(this);
        this.__roomItemDraggedEvent = this.__roomItemDragged.bind(this);
        this.__roomItemDragFinishEvent = this.__roomItemDragFinish.bind(this);

        this.__resetDesignEvent = this.__resetDesign.bind(this);

        this.init();
    }

    init() {
        let scope = this;

        ImageUtils.crossOrigin = '';

        scope.camera = new PerspectiveCamera(45, 10, scope.cameraNear, scope.cameraFar);

        let cubeRenderTarget = new WebGLCubeRenderTarget(16, { format: RGBFormat, generateMipmaps: true, minFilter: LinearMipmapLinearFilter });
        scope.__environmentCamera = new CubeCamera(1, 100000, cubeRenderTarget);
        scope.__environmentCamera.renderTarget.texture.encoding = sRGBEncoding;

        scope.renderer = scope.getARenderer();
        scope.domElement.appendChild(scope.renderer.domElement);

        scope.lights = new Lights3D(this, scope.floorplan);
        scope.dragControls = new DragRoomItemsControl3D(this.floorplan.wallPlanesForIntersection, this.floorplan.floorPlanesForIntersection, this.physicalRoomItems, scope.camera, scope.renderer.domElement, this);
        scope.orbitControl = new OrbitControls(scope.camera, scope.domElement);
        scope.orbitControl.enableDamping = false;
        scope.orbitControl.dampingFactor = 0.1;
        scope.orbitControl.maxPolarAngle = Math.PI * 0.5; // only see top
        scope.orbitControl.maxDistance = Configuration.getNumericValue(viewBounds);
        scope.orbitControl.minDistance = 100;
        scope.orbitControl.screenSpacePanning = true;
        scope.orbitControl.autoRotate = true;
        scope.skybox = new Skybox(this, scope.renderer);
        scope.camera.position.set(0, 600, 1500);
        scope.orbitControl.update();

        scope.axes = new AxesHelper(500);
        // scope.controls = new Controls(scope.camera, scope.domElement);

        // handle window resizing
        scope.updateWindowSize();

        if (scope.__options.resize) {
            window.addEventListener('resize', () => { scope.updateWindowSize(); });
            window.addEventListener('orientationchange', () => { scope.updateWindowSize(); });
        }

        scope.model.addEventListener(EVENT_NEW_ITEM, scope.__newItemEvent);
        scope.model.addEventListener(EVENT_MODE_RESET, scope.__resetDesignEvent);

        scope.model.addEventListener(EVENT_LOADED, scope.addRoomItems.bind(scope));

        scope.floorplan.addEventListener(EVENT_NEW_ROOMS_ADDED, scope.addRoomsAndWalls.bind(scope));
        scope.floorplan.addEventListener(EVENT_EXTERNAL_FLOORPLAN_LOADED, scope.addExternalRoomsAndWalls.bind(scope));

        this.orbitControl.addEventListener('change', () => { scope.needsUpdate = true; });


        scope.dragControls.addEventListener(EVENT_ITEM_SELECTED, this.__roomItemSelectedEvent);
        scope.dragControls.addEventListener(EVENT_ITEM_MOVE, this.__roomItemDraggedEvent);
        scope.dragControls.addEventListener(EVENT_ITEM_MOVE_FINISH, this.__roomItemDragFinishEvent);
        scope.dragControls.addEventListener(EVENT_NO_ITEM_SELECTED, this.__roomItemUnselectedEvent);

        scope.dragControls.addEventListener(EVENT_WALL_CLICKED, this.__wallSelectedEvent);
        scope.dragControls.addEventListener(EVENT_ROOM_CLICKED, this.__roomSelectedEvent);
        //Set the animation loop
        scope.renderer.setAnimationLoop(scope.render.bind(this));
        scope.render();
        this.mouseOver = false;
        this.hasClicked = false;
        scope.renderer.domElement.onmouseenter =()=> {
            this.mouseOver = true;
        };
        scope.renderer.domElement.onmouseleave =()=> {
            this.mouseOver = false;
        };
        scope.renderer.domElement.onclick = ()=> {
            this.hasClicked = true;
        };
    }

    __wallSelected(evt) {
        this.dispatchEvent(evt);
    }

    __roomSelected(evt) {
        this.dispatchEvent(evt);
    }

    __roomItemSelected(evt) {
        if (this.__currentItemSelected) {
            this.__currentItemSelected.selected = false;
        }
        this.__currentItemSelected = evt.item;
        this.__currentItemSelected.selected = true;
        this.needsUpdate = true;
        evt.itemModel = this.__currentItemSelected.itemModel;
        this.dispatchEvent(evt);
    }

    __roomItemDragged(evt) {
        this.orbitControl.enabled = false;
        this.needsUpdate = true;
    }

    __roomItemDragFinish(evt) {
        this.orbitControl.enabled = true;
        this.needsUpdate = true;
    }

    __roomItemUnselected(evt) {
        this.orbitControl.enabled = true;
        if (this.__currentItemSelected) {
            this.__currentItemSelected.selected = false;
            this.__currentItemSelected = null;
            this.needsUpdate = true;
        }
        this.dispatchEvent(evt);
    }

    __addNewItem(evt) {
        if (!evt.item) {
            return;
        }
        let physicalRoomItem = new Physical3DItem(evt.item, this.__options);
        this.add(physicalRoomItem);
        this.__physicalRoomItems.push(physicalRoomItem);
        this.__roomItemSelected({ type: EVENT_ITEM_SELECTED, item: physicalRoomItem });
    }

    __resetDesign(evt) {
        this.addRoomItems();
        this.addRoomsAndWalls();
        this.addExternalRoomsAndWalls();
    }

    addRoomItems(evt) {
        let i = 0;
        for (; i < this.__physicalRoomItems.length; i++) {
            this.__physicalRoomItems[i].dispose();
            this.remove(this.__physicalRoomItems[i]);
        }
        this.__physicalRoomItems.length = 0; //A cool way to clear an array in javascript
        let roomItems = this.model.roomItems;
        for (i = 0; i < roomItems.length; i++) {
            let physicalRoomItem = new Physical3DItem(roomItems[i], this.__options);
            this.add(physicalRoomItem);
            this.__physicalRoomItems.push(physicalRoomItem);
        }

    }


    __drawBoundary(){
        if(this.__boundaryRegion3D){
            this.__boundaryRegion3D.removeFromScene();
        }

        if(this.floorplan.boundary){
            if(this.floorplan.boundary.isValid){
                this.__boundaryRegion3D = new BoundaryView3D(this, this.floorplan, this.__options, this.floorplan.boundary);
            }
        }
    }

    addRoomsAndWalls() {
        let scope = this;
        let i = 0;

        // clear scene
        scope.floors3d.forEach((floor) => {
            floor.destroy();
            floor = null;
        });

        scope.edges3d.forEach((edge3d) => {
            edge3d.remove();
            edge3d = null;
        });

        scope.edges3d = [];
        scope.floors3d = [];
        let wallEdges = scope.floorplan.wallEdges();
        let rooms = scope.floorplan.getRooms();

        this.__drawBoundary();

        // draw floors
        for (i = 0; i < rooms.length; i++) {
            const threeFloor = new Floor3D(scope, rooms[i], scope.orbitControl, this.__options);
            scope.floors3d.push(threeFloor);
        }

        for (i = 0; i < wallEdges.length; i++) {
            let edge3d = new Edge3D(scope, wallEdges[i], scope.orbitControl, this.__options);
            scope.edges3d.push(edge3d);
        }

        scope.shouldRender = true;

        let floorplanCenter = scope.floorplan.getDimensions(true);
        scope.orbitControl.target = floorplanCenter.clone();
        scope.camera.position.set(floorplanCenter.x, 300, floorplanCenter.z * 5);
        scope.orbitControl.update();
    }


    addExternalRoomsAndWalls() {
        // console.trace('ADD EXTERNAL ROOMS AND WALLS');
        let scope = this;
        let i = 0;

        // clear scene
        scope.__externalFloors3d.forEach((floor) => {
            floor.destroy();
            floor = null;
        });

        scope.__externalEdges3d.forEach((edge3d) => {
            edge3d.remove();
            edge3d = null;
        });

        scope.__externalEdges3d = [];
        scope.__externalFloors3d = [];

        let wallEdges = scope.floorplan.externalWallEdges();
        let rooms = scope.floorplan.externalRooms;

        this.__drawBoundary();

        // draw floors
        for (i = 0; i < rooms.length; i++) {
            const threeFloor = new Floor3D(scope, rooms[i], scope.orbitControl, this.__options);
            scope.__externalFloors3d.push(threeFloor);
        }

        for (i = 0; i < wallEdges.length; i++) {
            let edge3d = new Edge3D(scope, wallEdges[i], scope.orbitControl, this.__options);
            scope.__externalEdges3d.push(edge3d);
        }

        scope.shouldRender = true;

        let floorplanCenter = scope.floorplan.getDimensions(true);
        scope.orbitControl.target = floorplanCenter.clone();
        scope.camera.position.set(floorplanCenter.x, 300, floorplanCenter.z * 5);
        scope.orbitControl.update();
    }

    getARenderer() {
        const renderer = new WebGLRenderer({antialias: true, alpha: true});
        renderer.shadowMap.enabled = false;
        renderer.shadowMapSoft = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.setClearColor(0xFFFFFF, 1);
        renderer.localClippingEnabled = false;
        renderer.outputEncoding = sRGBEncoding;
        renderer.setPixelRatio(window.devicePixelRatio);
        return renderer;
    }

    updateWindowSize() {
        let heightMargin = this.domElement.offsetTop;
        let widthMargin = this.domElement.offsetLeft;
        let elementWidth = (this.__options.resize) ? window.innerWidth - widthMargin : this.domElement.clientWidth;
        let elementHeight = (this.__options.resize) ? window.innerHeight - heightMargin : this.domElement.clientHeight;

        this.camera.aspect = elementWidth / elementHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(elementWidth, elementHeight);
        this.needsUpdate = true;
    }

    render() {
        this.spin();
        let scope = this;
        if (!this.enabled) {
            return;
        }
        if (!scope.needsUpdate) {
            return;
        }
        scope.renderer.render(scope, scope.camera);
        scope.lastRender = Date.now();
        this.needsUpdate = false;
    }

    spin() {
        const options = this.__options;
        const mouseOver = this.mouseOver;
        const  hasClicked = this.hasClicked;
        if (options.spin && (!mouseOver || !hasClicked)) {
            this.orbitControl.update();
        }
    }

    exportSceneAsGTLF() {
        let scope = this;
        let exporter = new GLTFExporter();
        exporter.parse(this, function(gltf) {
            scope.dispatchEvent({ type: EVENT_GLTF_READY, gltf: JSON.stringify(gltf) });
        });
    }

    forceRender() {
        let scope = this;
        scope.renderer.render(scope, scope.camera);
        scope.lastRender = Date.now();
    }

    addRoomplanListener(type, listener) {
        this.addEventListener(type, listener);
    }

    removeRoomplanListener(type, listener) {
        this.removeEventListener(type, listener);
    }

    get environmentCamera() {
        return this.__environmentCamera;
    }

    get physicalRoomItems() {
        return this.__physicalRoomItems;
    }

    get enabled() {
        return this.__enabled;
    }

    set enabled(flag) {
        this.__enabled = flag;
        this.orbitControl.enabled = flag;
        this.needsUpdate = false;
        if (!flag) {
            this.dragControls.deactivate();
        } else {
            this.dragControls.activate();
        }
    }

}
