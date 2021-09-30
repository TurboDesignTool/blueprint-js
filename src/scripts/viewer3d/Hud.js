import {EventDispatcher, Scene as ThreeScene, Geometry, Vector3, LineBasicMaterial, CylinderGeometry, MeshBasicMaterial, Mesh, SphereGeometry, Object3D, LineSegments} from 'three';

import {EVENT_ITEM_SELECTED, EVENT_ITEM_UNSELECTED} from '../core/events.js';

export class RotationHelper extends Object3D
{
	constructor(item)
	{
		super();

		this.selectedItem = item;

		this.highlight = false;

		this.tolerance = 10;
		this.height = 5;
		this.distance = 20;

		this.color = '#ffffff';
		this.hoverColor = '#f1c40f';
		this.makeObject(item);
	}

	getColor()
	{
		return this.highlight ? this.hoverColor : this.color;
	}

	update(item = this.selectedItem)
	{
		this.rotation.y = item.rotation.y;
		this.position.x = item.position.x;
		this.position.z = item.position.z;
	}

	makeLineGeometry(item)
	{
		const geometry = new Geometry();
		geometry.vertices.push(new Vector3(0, 0, 0),this.rotateVector(item));
		return geometry;
	}

	rotateVector(item)
	{
		const vec = new Vector3(0, 0, Math.max(item.halfSize.x, item.halfSize.z) + 1.4 + this.distance);
		return vec;
	}

	makeLineMaterial()
	{
		const mat = new LineBasicMaterial({color: this.getColor(), linewidth: 3});
		return mat;
	}

	makeCone(item)
	{
		const coneGeo = new CylinderGeometry(5, 0, 10);
		const coneMat = new MeshBasicMaterial({color: this.getColor()});
		const cone = new Mesh(coneGeo, coneMat);
		cone.position.copy(this.rotateVector(item));
		cone.rotation.x = -Math.PI / 2.0;
		return cone;
	}

	makeSphere()
	{
		const geometry = new SphereGeometry(4, 16, 16);
		const material = new MeshBasicMaterial({color: this.getColor()});
		const sphere = new Mesh(geometry, material);
		return sphere;
	}

	makeObject(item)
	{
		const line = new LineSegments(this.makeLineGeometry(item), this.makeLineMaterial());
		const cone = this.makeCone(item);
		const sphere = this.makeSphere(item);
		this.add(line);
		this.add(cone);
		this.add(sphere);
		this.rotation.y = item.rotation.y;
		this.position.x = item.position.x;
		this.position.z = item.position.z;
		this.position.y = this.height;
	}
	 setColor() {
		 this.children.forEach((obj) => {
			 obj.material.color.set(this.getColor());
		 });
	}
	press() {
		this.highlight = true;
		this.setColor();
	}
	release() {
		this.highlight = false;
		this.setColor();
	}
}
