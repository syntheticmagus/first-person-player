import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Matrix, Quaternion, TmpVectors, Vector3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable } from "@babylonjs/core/Misc/observable";
import "@babylonjs/core/Misc/observableCoroutine";
import { IPhysicsEngine } from "@babylonjs/core/Physics/IPhysicsEngine";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { Scene } from "@babylonjs/core/scene";
import { InputSampler, InputSamplerAxis } from "./inputSampler";

export class FirstPersonPlayer {
    private readonly _scene: Scene;
    private readonly _physicsEngine: IPhysicsEngine;

    private readonly _camera: FreeCamera;
    private readonly _cameraParent: TransformNode;
    private readonly _collision: Mesh;

    private readonly _updateObservable: Observable<Scene>;

    private readonly _inputSampler: InputSampler;

    public get camera(): TargetCamera {
        return this._camera;
    }

    public moveSpeed: number;
    public sprintSpeed: number;
    public jumpForce: number;
    public lookSensitivity: number;

    public setKeyBinding(axis: InputSamplerAxis, key: string) {
        this._inputSampler.setKeyBinding(axis, key);
    }

    public constructor(scene: Scene, position: Vector3, updateObservable?: Observable<Scene>) {
        this._scene = scene;
        this._physicsEngine = scene.getPhysicsEngine()!;
        this._updateObservable = updateObservable ?? scene.onBeforePhysicsObservable;

        this._inputSampler = new InputSampler(scene.getEngine());
        
        this._collision = MeshBuilder.CreateSphere("player", { segments: 3, diameterX: 0.4, diameterY: 1.8, diameterZ: 0.4 }, scene);
        this._collision.position.copyFrom(position);
        this._collision.position.y += 1;
        this._collision.physicsImpostor = new PhysicsImpostor(this._collision, PhysicsImpostor.SphereImpostor, { mass: 10, restitution: 0, friction: 10000 }, scene);
        {
            const angularFactor = this._collision.physicsImpostor.physicsBody.getAngularFactor();
            angularFactor.setX(0);
            angularFactor.setY(0);
            angularFactor.setZ(0);
        }

        this._cameraParent = new TransformNode("firstPersonPlayerCameraParent", this._scene);
        this._cameraParent.position.copyFrom(this._collision.position);
        this._scene.onAfterPhysicsObservable.add(() => {
            this._cameraParent.position.copyFrom(this._collision.position);
        });

        this._camera = new FreeCamera("firstPersonPlayerCamera", new Vector3(), scene);
        this._camera.minZ = 0.01;
        this._camera.maxZ = 100;
        this._camera.position.y = 0.5
        this._camera.parent = this._cameraParent;

        this._updateObservable.runCoroutineAsync(this._perFrameUpdateCoroutine());

        this.moveSpeed = 0.06;
        this.sprintSpeed = 0.05;
        this.jumpForce = 30;
        this.lookSensitivity = 1 / 300;
    }
    
    private *_perFrameUpdateCoroutine() {
        const right = TmpVectors.Vector3[0];
        const forward = TmpVectors.Vector3[1];
        const movement = TmpVectors.Vector3[2];
        const raycastFrom = TmpVectors.Vector3[0];
        const raycastTo = TmpVectors.Vector3[1];
        const floorRotationQuaternion = new Quaternion();
        const floorRotationTransform = new Matrix();
        let m: Matrix;

        const impostor = this._collision.physicsImpostor!;
        let jumpFrameDelay = 0;
        while (true) {
            const SLIDE_THRESHOLD = Math.PI / 3;

            raycastFrom.copyFrom(this._collision.position);
            raycastTo.copyFrom(this._collision.position);
            raycastTo.y -= 1;
            const raycastResult = this._physicsEngine.raycast(raycastFrom, raycastTo);

            floorRotationTransform.copyFrom(Matrix.IdentityReadOnly);
            const floorAngle = raycastResult.hasHit ? Math.acos(Vector3.Dot(Vector3.UpReadOnly, raycastResult.hitNormalWorld)) : 0;
            if (raycastResult.hasHit && floorAngle > 0.01) {
                const axis = Vector3.Cross(Vector3.UpReadOnly, raycastResult.hitNormalWorld);
                axis.normalize();
                Quaternion.RotationAxisToRef(axis, floorAngle, floorRotationQuaternion);
                floorRotationQuaternion.toRotationMatrix(floorRotationTransform);
            }

            m = this._camera.getWorldMatrix();
            right.copyFromFloats(m.m[0], m.m[1], m.m[2]);
            forward.copyFromFloats(m.m[8], m.m[9], m.m[10]);
            right.y = 0;
            right.normalize();
            forward.y = 0;
            forward.normalize();
            movement.set(0, 0, 0);
            forward.scaleAndAddToRef(this._inputSampler.get(InputSamplerAxis.Forward) - this._inputSampler.get(InputSamplerAxis.Backward), movement);
            right.scaleAndAddToRef(this._inputSampler.get(InputSamplerAxis.Right) - this._inputSampler.get(InputSamplerAxis.Left), movement);
            movement.normalize();
            Vector3.TransformNormalToRef(movement, floorRotationTransform, movement);
            movement.scaleAndAddToRef(this.moveSpeed + this.sprintSpeed * this._inputSampler.get(InputSamplerAxis.Sprint), this._collision.position);

            if (jumpFrameDelay > 0) {
                --jumpFrameDelay;
            }

            if (floorAngle < SLIDE_THRESHOLD) {
                impostor.friction = 10000;

                if (jumpFrameDelay < 1 && raycastResult.hasHit && raycastResult.hitDistance < 0.9 && this._inputSampler.get(InputSamplerAxis.Jump) > 0) {
                    impostor.applyImpulse(Vector3.UpReadOnly.scale(this.jumpForce), Vector3.ZeroReadOnly);
                    jumpFrameDelay = 5;
                }
            } else {
                impostor.friction = 0;
            }

            this._camera.rotation.y += this._inputSampler.get(InputSamplerAxis.MouseDY) * this.lookSensitivity;
            this._camera.rotation.x += this._inputSampler.get(InputSamplerAxis.MouseDX) * this.lookSensitivity;
            this._camera.rotation.x = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 3, this._camera.rotation.x));

            yield;
        }
    }
}
