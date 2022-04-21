import * as BABYLON from "@babylonjs/core";

class Input {
    private _deviceSourceManager: BABYLON.DeviceSourceManager;
    private _keyboard?: BABYLON.DeviceSource<BABYLON.DeviceType.Keyboard>;
    private _mouse?: BABYLON.DeviceSource<BABYLON.DeviceType.Mouse>;

    constructor (engine: BABYLON.Engine) {
        this._deviceSourceManager = new BABYLON.DeviceSourceManager(engine);

        const setDeviceSourcesCallback = () => { this._setDeviceSources(); };
        this._deviceSourceManager.onDeviceConnectedObservable.add(setDeviceSourcesCallback);
        this._deviceSourceManager.onDeviceDisconnectedObservable.add(setDeviceSourcesCallback);
        this._setDeviceSources();
    }

    private _setDeviceSources(): void {
        this._keyboard = this._deviceSourceManager.getDeviceSource(BABYLON.DeviceType.Keyboard)!;
        this._mouse = this._deviceSourceManager.getDeviceSource(BABYLON.DeviceType.Mouse)!;
    }

    public get W(): number {
        return this._keyboard ? this._keyboard.getInput(87) : 0;
    }

    public get A(): number {
        return this._keyboard ? this._keyboard.getInput(65) : 0;
    }

    public get S(): number {
        return this._keyboard ? this._keyboard.getInput(83) : 0;
    }

    public get D(): number {
        return this._keyboard ? this._keyboard.getInput(68) : 0;
    }

    public get Space(): number {
        return this._keyboard ? this._keyboard.getInput(32) : 0;
    }

    public get Shift(): number {
        return this._keyboard ? this._keyboard.getInput(16) : 0;
    }

    public get MouseX(): number {
        return this._mouse ? this._mouse.getInput(BABYLON.PointerInput.Horizontal) : 0;
    }

    public get MouseY(): number {
        return this._mouse ? this._mouse.getInput(BABYLON.PointerInput.Vertical) : 0;
    }

    public get MouseDX(): number {
        return 0;//this._mouse ? this._mouse.getInput(BABYLON.PointerInput.DeltaHorizontal) : 0;
    }

    public get MouseDY(): number {
        return 0;//this._mouse ? this._mouse.getInput(BABYLON.PointerInput.DeltaVertical) : 0;
    }
}

class Playground {
    private static CreateRandomMaterial(scene: BABYLON.Scene, name: string) {
        const mat = new BABYLON.StandardMaterial(name, scene);
        mat.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        return mat;
    }

    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        const scene = new BABYLON.Scene(engine);
        const physicsPlugin = new BABYLON.AmmoJSPlugin();
        scene.enablePhysics(undefined, physicsPlugin);

        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(), scene);
        camera.position.y = 0.6;
        camera.minZ = 0.05;
        camera.maxZ = 100;

        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        const sphere = BABYLON.MeshBuilder.CreateSphere("sphere1", { segments: 8, diameter: 1 }, scene);
        sphere.position.y = 1;
        sphere.scaling.y = 2;
        sphere.isVisible = false;
        sphere.physicsImpostor = new BABYLON.PhysicsImpostor(sphere, BABYLON.PhysicsImpostor.SphereImpostor, { mass: 10, restitution: 0, friction: 10000 }, scene);
        {
            // Works great for preventing sliding, but also causes side collisions to fail. Hack-ish alternative: use ridiculous friction.
            //const linearFactor = sphere.physicsImpostor.physicsBody.getLinearFactor();
            //linearFactor.setX(0);
            //linearFactor.setY(1);
            //linearFactor.setZ(0);
            const angularFactor = sphere.physicsImpostor.physicsBody.getAngularFactor();
            angularFactor.setX(0);
            angularFactor.setY(0);
            angularFactor.setZ(0);
        }

        const box = BABYLON.MeshBuilder.CreateBox("box", { size: 5 }, scene);
        box.position.set(12, 2.5, 7);
        box.physicsImpostor = new BABYLON.PhysicsImpostor(box, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 1 }, scene);
        box.material = Playground.CreateRandomMaterial(scene, "box_mat");

        const ramp = BABYLON.MeshBuilder.CreateBox("ramp", { size: 1 }, scene);
        ramp.scaling.set(13, 0.2, 2);
        ramp.rotation.z = Math.PI / 5;
        ramp.position.set(4.3, 1.095, 7)
        ramp.physicsImpostor = new BABYLON.PhysicsImpostor(ramp, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.5 }, scene);
        ramp.material = Playground.CreateRandomMaterial(scene, "ramp_mat");
        
        const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 30, height: 30, subdivisions: 2 }, scene);
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.PlaneImpostor, { mass: 0, restitution: 0.5 }, scene);
        ground.material = Playground.CreateRandomMaterial(scene, "ground1_mat");

        for (let idx = 1; idx < 6; ++idx) {
            const block = BABYLON.MeshBuilder.CreateBox("block_" + idx, { size: 1 }, scene);
            block.position.set(-5, idx, -6);
            block.physicsImpostor = new BABYLON.PhysicsImpostor(block, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 1, restitution: 0.5, friction: 10 }, scene);
            block.material = Playground.CreateRandomMaterial(scene, "block_" + idx + "_mat");
        };

        const right = new BABYLON.Vector3();
        const forward = new BABYLON.Vector3();
        const movement = new BABYLON.Vector3();
        const raycastFrom = new BABYLON.Vector3();
        const raycastTo = new BABYLON.Vector3();
        const floorRotationQuaternion = new BABYLON.Quaternion();
        const floorRotationTransform = new BABYLON.Matrix();
        let m: BABYLON.Matrix;

        const input = new Input(engine);
        scene.onBeforePhysicsObservable.add(() => {
            const SLIDE_THRESHOLD = Math.PI / 3;

            raycastFrom.copyFrom(sphere.position);
            raycastFrom.y -= 0.8;
            raycastTo.copyFrom(sphere.position);
            raycastTo.y -= 1.2;
            const raycastResult = physicsPlugin.raycast(sphere.position, sphere.position.subtract(BABYLON.Vector3.Up().scale(1.1)));

            floorRotationTransform.copyFrom(BABYLON.Matrix.IdentityReadOnly);
            const floorAngle = raycastResult.hasHit ? Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.UpReadOnly, raycastResult.hitNormalWorld)) : 0;
            if (raycastResult.hasHit && floorAngle > 0.01) {
                const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.UpReadOnly, raycastResult.hitNormalWorld);
                axis.normalize();
                BABYLON.Quaternion.RotationAxisToRef(axis, floorAngle, floorRotationQuaternion);
                floorRotationQuaternion.toRotationMatrix(floorRotationTransform);
            }

            if (floorAngle < SLIDE_THRESHOLD) {
                sphere.physicsImpostor!.friction = 10000;
                m = camera.getWorldMatrix();
                right.copyFromFloats(m.m[0], m.m[1], m.m[2]);
                forward.copyFromFloats(m.m[8], m.m[9], m.m[10]);
                right.y = 0;
                right.normalize();
                forward.y = 0;
                forward.normalize();
                movement.set(0, 0, 0);
                forward.scaleAndAddToRef(input.W - input.S, movement);
                right.scaleAndAddToRef(input.D - input.A, movement);
                movement.normalize();
                BABYLON.Vector3.TransformNormalToRef(movement, floorRotationTransform, movement);
                movement.scaleAndAddToRef(0.08 + 0.08 * input.Shift, sphere.position);

                if (raycastResult.hasHit && input.Space > 0) {
                    sphere.physicsImpostor!.applyImpulse(BABYLON.Vector3.UpReadOnly.scale(10), BABYLON.Vector3.ZeroReadOnly);
                }
            } else {
                sphere.physicsImpostor!.friction = 0;
            }

            camera.rotation.y += input.MouseDX / 200;
            camera.rotation.x += input.MouseDY / 200;
            camera.rotation.x = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 3, camera.rotation.x));
        });

        const cameraParent = new BABYLON.TransformNode("cameraParent", scene);
        camera.parent = cameraParent;
        scene.onAfterPhysicsObservable.add(() => {
            cameraParent.position.copyFrom(sphere.position);
        });

        canvas.onclick = () => {
            canvas.requestPointerLock();
            canvas.requestFullscreen();
        };

        return scene;
    }
}

export function CreatePlaygroundScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
    return Playground.CreateScene(engine, canvas);
}
