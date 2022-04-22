import { DeviceType, PointerInput } from "@babylonjs/core/DeviceInput/InputDevices/deviceEnums";
import { DeviceSource } from "@babylonjs/core/DeviceInput/InputDevices/deviceSource";
import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/Plugins/ammoJSPlugin";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/physicsEngineComponent";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { InputSampler, InputSamplerAxis } from "./inputSampler";

class Playground {
    private static CreateRandomMaterial(scene: Scene, name: string) {
        const mat = new StandardMaterial(name, scene);
        mat.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
        return mat;
    }

    public static CreateScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
        const scene = new Scene(engine);
        const physicsPlugin = new AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const camera = new FreeCamera("camera1", new Vector3(), scene);
        camera.position.y = 0.6;
        camera.minZ = 0.05;
        camera.maxZ = 100;

        const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        //const sphere = MeshBuilder.CreateSphere("sphere1", { segments: 8, diameter: 1 }, scene);
        //sphere.position.y = 1;
        //sphere.scaling.y = 2;
        //sphere.isVisible = false;
        const capsule = MeshBuilder.CreateCapsule("player", { radius: 0.25, height: 1.7 }, scene);
        capsule.position.y = 1;
        capsule.physicsImpostor = new PhysicsImpostor(capsule, PhysicsImpostor.SphereImpostor, { mass: 10, restitution: 0, friction: 10000 }, scene);
        {
            // Works great for preventing sliding, but also causes side collisions to fail. Hack-ish alternative: use ridiculous friction.
            //const linearFactor = sphere.physicsImpostor.physicsBody.getLinearFactor();
            //linearFactor.setX(0);
            //linearFactor.setY(1);
            //linearFactor.setZ(0);
            const angularFactor = capsule.physicsImpostor.physicsBody.getAngularFactor();
            angularFactor.setX(0);
            angularFactor.setY(0);
            angularFactor.setZ(0);
        }

        const box = MeshBuilder.CreateBox("box", { size: 5 }, scene);
        box.position.set(12, 2.5, 7);
        box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 1 }, scene);
        box.material = Playground.CreateRandomMaterial(scene, "box_mat");

        const ramp = MeshBuilder.CreateBox("ramp", { size: 1 }, scene);
        ramp.scaling.set(13, 0.2, 2);
        ramp.rotation.z = Math.PI / 5;
        ramp.position.set(4.3, 1.095, 7)
        ramp.physicsImpostor = new PhysicsImpostor(ramp, PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.5 }, scene);
        ramp.material = Playground.CreateRandomMaterial(scene, "ramp_mat");
        
        const ground = MeshBuilder.CreateGround("ground1", { width: 30, height: 30, subdivisions: 2 }, scene);
        ground.physicsImpostor = new PhysicsImpostor(ground, PhysicsImpostor.PlaneImpostor, { mass: 0, restitution: 0.5 }, scene);
        ground.material = Playground.CreateRandomMaterial(scene, "ground1_mat");

        for (let idx = 1; idx < 6; ++idx) {
            const block = MeshBuilder.CreateBox("block_" + idx, { size: 0.8 }, scene);
            block.position.set(-5, idx * 0.8, -6);
            block.physicsImpostor = new PhysicsImpostor(block, PhysicsImpostor.BoxImpostor, { mass: 1, restitution: 0.5, friction: 10 }, scene);
            block.material = Playground.CreateRandomMaterial(scene, "block_" + idx + "_mat");
        };

        const right = new Vector3();
        const forward = new Vector3();
        const movement = new Vector3();
        const raycastFrom = new Vector3();
        const raycastTo = new Vector3();
        const floorRotationQuaternion = new Quaternion();
        const floorRotationTransform = new Matrix();
        let m: Matrix;

        const input = new InputSampler(engine);
        scene.onBeforePhysicsObservable.add(() => {
            const SLIDE_THRESHOLD = Math.PI / 3;

            raycastFrom.copyFrom(capsule.position);
            raycastFrom.y -= 0.8;
            raycastTo.copyFrom(capsule.position);
            raycastTo.y -= 1.2;
            const raycastResult = physicsPlugin.raycast(capsule.position, capsule.position.subtract(Vector3.Up().scale(1.1)));

            floorRotationTransform.copyFrom(Matrix.IdentityReadOnly);
            const floorAngle = raycastResult.hasHit ? Math.acos(Vector3.Dot(Vector3.UpReadOnly, raycastResult.hitNormalWorld)) : 0;
            if (raycastResult.hasHit && floorAngle > 0.01) {
                const axis = Vector3.Cross(Vector3.UpReadOnly, raycastResult.hitNormalWorld);
                axis.normalize();
                Quaternion.RotationAxisToRef(axis, floorAngle, floorRotationQuaternion);
                floorRotationQuaternion.toRotationMatrix(floorRotationTransform);
            }

            if (floorAngle < SLIDE_THRESHOLD) {
                capsule.physicsImpostor!.friction = 10000;
                m = camera.getWorldMatrix();
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
                movement.scaleAndAddToRef(0.08 + 0.08 * input.get(InputSamplerAxis.Shift), capsule.position);

                if (raycastResult.hasHit && input.get(InputSamplerAxis.Space) > 0) {
                    capsule.physicsImpostor!.applyImpulse(Vector3.UpReadOnly.scale(10), Vector3.ZeroReadOnly);
                }
            } else {
                capsule.physicsImpostor!.friction = 0;
            }

            camera.rotation.y += input.get(InputSamplerAxis.MouseDY) / 200;
            camera.rotation.x += input.get(InputSamplerAxis.MouseDX) / 200;
            camera.rotation.x = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 3, camera.rotation.x));
        });

        const cameraParent = new TransformNode("cameraParent", scene);
        camera.parent = cameraParent;
        scene.onAfterPhysicsObservable.add(() => {
            cameraParent.position.copyFrom(capsule.position);
        });

        canvas.onclick = () => {
            canvas.requestPointerLock();
            canvas.requestFullscreen();
        };

        return scene;
    }
}

export interface InitializeBabylonAppOptions {
    canvas: HTMLCanvasElement;
    assetsHostUrl?: string;
}

export function initializeBabylonApp(options: InitializeBabylonAppOptions) {
    if (options.assetsHostUrl) {
        console.log("Assets host URL: " + options.assetsHostUrl!);
    } else {
        console.log("No assets host URL provided");
    }

    const canvas = options.canvas;
    const engine = new Engine(canvas);
    const scene = Playground.CreateScene(engine, canvas);
    engine.runRenderLoop(() => {
        scene.render();
    });
    window.addEventListener("resize", () => {
        engine.resize();
    });
}

