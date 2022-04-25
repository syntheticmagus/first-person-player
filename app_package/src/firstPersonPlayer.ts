import { IPhysicsEngine } from "@babylonjs/core";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Matrix, Quaternion, TmpVectors, Vector3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Misc/observableCoroutine";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { Scene } from "@babylonjs/core/scene";
import { InputSampler, InputSamplerAxis } from "./inputSampler";

export class FirstPersonPlayer {
    private readonly _scene: Scene;
    private readonly _physicsEngine: IPhysicsEngine;

    private readonly _camera: FreeCamera;
    private readonly _collision: Mesh;

    public constructor(scene: Scene) {
        this._scene = scene;
        this._physicsEngine = scene.getPhysicsEngine()!;
        
        this._collision = MeshBuilder.CreateSphere("player", { segments: 3, diameterX: 0.4, diameterY: 1.7, diameterZ: 0.4 }, scene);
        this._collision.position.y = 1;
        this._collision.physicsImpostor = new PhysicsImpostor(this._collision, PhysicsImpostor.SphereImpostor, { mass: 10, restitution: 0, friction: 10000 }, scene);
        {
            const angularFactor = this._collision.physicsImpostor.physicsBody.getAngularFactor();
            angularFactor.setX(0);
            angularFactor.setY(0);
            angularFactor.setZ(0);
        }

        this._camera = new FreeCamera("firstPersonPlayerCamera", new Vector3(), scene);
        this._camera.minZ = 0.01;
        this._camera.maxZ = 100;
        this._camera.position.y = 0.5
        this._camera.parent = this._collision;

        this._scene.onBeforeRenderObservable.runCoroutineAsync(this._perFrameUpdateCoroutine());
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

        const input = new InputSampler(this._scene.getEngine());
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
            forward.scaleAndAddToRef(input.get(InputSamplerAxis.W) - input.get(InputSamplerAxis.S), movement);
            right.scaleAndAddToRef(input.get(InputSamplerAxis.D) - input.get(InputSamplerAxis.A), movement);
            movement.normalize();
            Vector3.TransformNormalToRef(movement, floorRotationTransform, movement);
            movement.scaleAndAddToRef(0.08 + 0.08 * input.get(InputSamplerAxis.Shift), this._collision.position);

            if (floorAngle < SLIDE_THRESHOLD) {
                this._collision.physicsImpostor!.friction = 10000;

                if (raycastResult.hasHit && raycastResult.hitDistance < 0.9 && input.get(InputSamplerAxis.Space) > 0) {
                    this._collision.physicsImpostor!.applyImpulse(Vector3.UpReadOnly.scale(10), Vector3.ZeroReadOnly);
                }
            } else {
                this._collision.physicsImpostor!.friction = 0;
            }

            this._camera.rotation.y += input.get(InputSamplerAxis.MouseDY) / 200;
            this._camera.rotation.x += input.get(InputSamplerAxis.MouseDX) / 200;
            this._camera.rotation.x = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 3, this._camera.rotation.x));

            yield;
        }
    }
}
