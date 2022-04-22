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
import { FirstPersonPlayer } from "./firstPersonPlayer";

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

        const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

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
            block.physicsImpostor = new PhysicsImpostor(block, PhysicsImpostor.BoxImpostor, { mass: 20, restitution: 0.5, friction: 10 }, scene);
            block.material = Playground.CreateRandomMaterial(scene, "block_" + idx + "_mat");
        };

        const player = new FirstPersonPlayer(scene);

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

