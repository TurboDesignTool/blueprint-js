import { Mesh, Box3, Vector3, Matrix4 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EVENT_ITEM_LOADED, EVENT_ITEM_LOADING, EVENT_UPDATED, EVENT_PARAMETRIC_GEOMETRY_UPATED } from '../core/events';
import { BoxBufferGeometry, LineBasicMaterial, LineSegments, EdgesGeometry } from 'three';
export class Physical3DItem extends Mesh {
    constructor(itemModel, opts) {
        super();
        this.__itemModel = itemModel;
        this.__box = null;
        this.__center = null;
        this.__size = null;
        this.__selected = false;


        this.__options = opts;

        this.__selectedMaterial = new LineBasicMaterial({ color: 0x0000F0, linewidth: 5 });

        this.__boxhelper = new LineSegments(new EdgesGeometry(new BoxBufferGeometry(1, 1, 1)), this.__selectedMaterial);
        this.__customIntersectionPlanes = []; // Useful for intersecting only wall planes, only floorplanes, only ceiling planes etc

        this.__gltfLoader = new GLTFLoader();
        this.__gltfLoadingProgressEvent = this.__gltfLoadingProgress.bind(this);
        this.__gltfLoadedEvent = this.__gltfLoaded.bind(this);
        this.__itemUpdatedEvent = this.__itemUpdated.bind(this);
        this.__parametricGeometryUpdateEvent = this.__parametricGeometryUpdate.bind(this);


        this.__itemModel.addEventListener(EVENT_UPDATED, this.__itemUpdatedEvent);
        this.add(this.__boxhelper);
        this.__boxhelper.material.linewidth = 5;
        this.selected = false;
        this.position.copy(this.__itemModel.position);
        if (this.__itemModel.isParametric) {
            this.__createParametricItem();
        } else {
            this.__loadItemModel();
        }
    }

    __parametricGeometryUpdate(evt) {
        let mLocal = new Matrix4().getInverse(this.matrixWorld);
        this.__loadedItem.geometry = this.__itemModel.parametricClass.geometry;
        this.parent.needsUpdate = true;


        this.__box = this.__loadedItem.geometry.boundingBox.clone();
        this.__center = this.__box.getCenter(new Vector3());
        this.__size = this.__box.getSize(new Vector3());
        let localCenter = this.__center.clone().applyMatrix4(mLocal);
        let m = new Matrix4();
        m = m.makeTranslation(-localCenter.x, -localCenter.y, -localCenter.z);

        this.__boxhelper.geometry = new EdgesGeometry(new BoxBufferGeometry(this.__size.x, this.__size.y, this.__size.z));
        this.__boxhelper.rotation.x = this.__itemModel.rotation.x;
        this.__boxhelper.rotation.y = this.__itemModel.rotation.y;
        this.__boxhelper.rotation.z = this.__itemModel.rotation.z;

    }
    __itemUpdated(evt) {
        let scope = this;
        if (!scope.parent) {
            return;
        }
        if (evt.property === 'position') {
            this.position.set(this.__itemModel.position.x, this.__itemModel.position.y, this.__itemModel.position.z);
        }
        if (evt.property === 'rotation') {
            this.__loadedItem.rotation.set(this.__itemModel.rotation.x, this.__itemModel.rotation.y, this.__itemModel.rotation.z);
            this.__boxhelper.rotation.set(this.__itemModel.rotation.x, this.__itemModel.rotation.y, this.__itemModel.rotation.z);
        }
        if (evt.property === 'visible') {
            this.visible = this.__itemModel.visible;
        }
    }

    __initializeChildItem() {
        this.__box = new Box3().setFromObject(this.__loadedItem);
        this.__center = this.__box.getCenter(new Vector3());
        this.__size = this.__box.getSize(new Vector3());

        this.__boxhelper.geometry = new EdgesGeometry(new BoxBufferGeometry(this.__size.x, this.__size.y, this.__size.z));
        this.add(this.__loadedItem);

        this.geometry = new BoxBufferGeometry(this.__size.x, this.__size.y, this.__size.z, 1, 1, 1);
        this.geometry.computeBoundingBox();

        this.material.visible = false;
        this.__loadedItem.rotation.x = this.__itemModel.rotation.x;
        this.__loadedItem.rotation.y = this.__itemModel.rotation.y;
        this.__loadedItem.rotation.z = this.__itemModel.rotation.z;
        this.__boxhelper.rotation.x = this.__itemModel.rotation.x;
        this.__boxhelper.rotation.y = this.__itemModel.rotation.y;
        this.__boxhelper.rotation.z = this.__itemModel.rotation.z;
    }

    __loadItemModel() {
        if (!this.__itemModel.modelURL || this.__itemModel.modelURL === 'undefined') {
            return;
        }

        if (this.__loadedItem) {
            this.remove(this.__loadedItem);
        }

        this.__gltfLoader.load(this.__itemModel.modelURL, this.__gltfLoadedEvent, this.__gltfLoadingProgressEvent);
    }

    __gltfLoaded(gltfModel) {
        this.__loadedItem = gltfModel.scene;
        this.__initializeChildItem();
        this.dispatchEvent({ type: EVENT_ITEM_LOADED });
    }

    __gltfLoadingProgress(xhr) {
        this.dispatchEvent({ type: EVENT_ITEM_LOADING, loaded: xhr.loaded, total: xhr.total, percent: (xhr.loaded / xhr.total) * 100, jsraw: xhr });
    }

    __createParametricItem() {
        let parametricData = this.__itemModel.parametricClass;
        if (parametricData) {
            this.__loadedItem = new Mesh(parametricData.geometry, parametricData.material);
            this.__itemModel.parametricClass.addEventListener(EVENT_PARAMETRIC_GEOMETRY_UPATED, this.__parametricGeometryUpdateEvent);
            this.__initializeChildItem();
            this.dispatchEvent({ type: EVENT_ITEM_LOADED });
        }
    }

    dispose() {
        this.__itemModel.dispose();
        this.__itemModel.removeEventListener(EVENT_UPDATED, this.__itemUpdatedEvent);
        this.parent.remove(this);
    }

    snapToPoint(coordinate3d, normal, intersectingPlane) {
        this.__itemModel.snapToPoint(coordinate3d, normal, intersectingPlane);
    }

    snapToWall(coordinate3d, wall, wallEdge) {
        this.__itemModel.snapToWall(coordinate3d, wall, wallEdge);
    }

    rotate(point) {
        this.__itemModel.rotate(point);
    }

    get selected() {
        return this.__selected;
    }

    set selected(flag) {
        this.__selected = flag;
        this.__boxhelper.visible = flag;
    }

    set location(coordinate3d) {
        this.__itemModel.position = coordinate3d;
    }

    get location() {
        return this.__itemModel.position.clone();
    }

    get intersectionPlanes() {
        return this.__itemModel.intersectionPlanes;
    }

    get itemModel() {
        return this.__itemModel;
    }
}
