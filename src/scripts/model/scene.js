import { EventDispatcher, Color } from 'three';
import { Geometry } from 'three';
// import {JSONLoader} from 'three'
// import GLTFLoader from 'three-gltf-loader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Scene as ThreeScene } from 'three';
import { Utils } from '../core/utils.js';
import { Factory } from '../items/factory.js';
import { EVENT_ITEM_LOADING, EVENT_ITEM_LOADED, EVENT_ITEM_REMOVED } from '../core/events.js';

/**
 * The Scene is a manager of Items and also links to a ThreeJS scene.
 */
export class Scene extends EventDispatcher {
    /**
     * Constructs a scene.
     * @param model The associated model.
     * @param textureDir The directory from which to load the textures.
     */
    constructor(model, textureDir) {
        super();
        this.model = model;
        this.textureDir = textureDir;

        //		var grid = new GridHelper(4000, 200);

        this.scene = new ThreeScene();
        this.scene.background = new Color(0xffffff);
        //		this.scene.fog = new Fog(0xFAFAFA, 0.001, 6000);
        this.items = [];
        this.needsUpdate = false;
        // init item loader
        // this.loader = new JSONLoader();
        // this.loader.setCrossOrigin('');

        this.gltfloader = new GLTFLoader();
        // this.gltfloader.setCrossOrigin('');
        //		this.add(grid);

    }

    /** Adds a non-item, basically a mesh, to the scene.
     * @param mesh The mesh to be added.
     */
    add(mesh) {
        this.scene.add(mesh);
    }

    /** Removes a non-item, basically a mesh, from the scene.
     * @param mesh The mesh to be removed.
     */
    remove(mesh) {
        this.scene.remove(mesh);
        Utils.removeValue(this.items, mesh);
    }

    /** Gets the scene.
     * @returns The scene.
     */
    getScene() {
        return this.scene;
    }

    /** Gets the items.
     * @returns The items.
     */
    getItems() {
        return this.items;
    }

    /** Gets the count of items.
     * @returns The count.
     */
    itemCount() {
        return this.items.length;
    }

    /** Removes all items. */
    clearItems() {
        // var items_copy = this.items ;
        var scope = this;
        this.items.forEach((item) => {
            scope.removeItem(item, true);
        });
        this.items = [];
    }

    /**
     * Removes an item.
     * @param item The item to be removed.
     * @param dontRemove If not set, also remove the item from the items list.
     */
    removeItem(item, keepInList) {
        keepInList = keepInList || false;
        // use this for item meshes
        this.dispatchEvent({ type: EVENT_ITEM_REMOVED, item: item });
        //this.itemRemovedCallbacks.fire(item);
        item.removed();
        this.scene.remove(item);
        if (!keepInList) {
            Utils.removeValue(this.items, item);
        }
    }

    switchWireframe(flag) {
        this.items.forEach((item) => {
            item.switchWireframe(flag);
        });
    }

    /**
     * Creates an item and adds it to the scene.
     * @param itemType The type of the item given by an enumerator.
     * @param fileName The name of the file to load.
     * @param metadata TODO
     * @param position The initial position.
     * @param rotation The initial rotation around the y axis.
     * @param scale The initial scaling.
     * @param fixed True if fixed.
     * @param newItemDefinitions - Object with position and 'edge' attribute if it is a wall item
     */
    addItem(itemType, fileName, metadata, position, rotation, scale, fixed, newItemDefinitions) {
        if (itemType === undefined) {
            itemType = 1;
        }

        const scope = this;

        function addToMaterials(materials, newmaterial) {
            for (let i = 0; i < materials.length; i++) {
                const mat = materials[i];
                if (mat.name === newmaterial.name) {
                    return [materials, i];
                }
            }
            materials.push(newmaterial);
            return [materials, materials.length - 1];
        }

        const loaderCallback = function (geometry, materials, gltf_entity) {
            const item = new (Factory.getClass(itemType))(scope.model, metadata, geometry, materials, position, rotation, scale, gltf_entity);
            item.fixed = fixed || false;
            scope.items.push(item);
            scope.add(item);
            item.initObject();
            scope.dispatchEvent({type: EVENT_ITEM_LOADED, item: item});
            if (newItemDefinitions) {
                item.moveToPosition(newItemDefinitions.position, newItemDefinitions.edge);
                item.placeInRoom();
            }
        };
        const gltfCallback = function (gltfModel) {
            let newmaterials = [];
            const newGeometry = new Geometry();

            gltfModel.scene.traverse(function (child) {
                let newItems;
                if (child.type === 'Mesh') {
                    const materialindices = [];
                    if (child.material.length) {
                        for (let k = 0; k < child.material.length; k++) {
                            newItems = addToMaterials(newmaterials, child.material[k]);
                            newmaterials = newItems[0];
                            materialindices.push(newItems[1]);
                        }
                    } else {
                        newItems = addToMaterials(newmaterials, child.material); //materials.push(child.material);
                        newmaterials = newItems[0];
                        materialindices.push(newItems[1]);
                    }

                    if (child.geometry.isBufferGeometry) {
                        const tGeometry = new Geometry().fromBufferGeometry(child.geometry);
                        tGeometry.faces.forEach((face) => {
                            face.materialIndex = materialindices[face.materialIndex];
                        });
                        child.updateMatrix();
                        newGeometry.merge(tGeometry, child.matrix);
                    } else {
                        child.geometry.faces.forEach((face) => {
                            face.materialIndex = materialindices[face.materialIndex];
                        });
                        child.updateMatrix();
                        newGeometry.mergeMesh(child);
                    }
                }
            });
            loaderCallback(newGeometry, newmaterials, gltfModel);
        };
        this.dispatchEvent({ type: EVENT_ITEM_LOADING });
        this.gltfloader.load(fileName, gltfCallback, null, null);
    }
}
