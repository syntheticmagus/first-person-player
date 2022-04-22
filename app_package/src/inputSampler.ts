import { DeviceType } from "@babylonjs/core/DeviceInput/InputDevices/deviceEnums";
import { DeviceSource } from "@babylonjs/core/DeviceInput/InputDevices/deviceSource";
import { DeviceSourceManager } from "@babylonjs/core/DeviceInput/InputDevices/deviceSourceManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { IKeyboardEvent, IPointerEvent, IWheelEvent } from "@babylonjs/core/Events/deviceInputEvents";
import { Observer } from "@babylonjs/core/Misc/observable";
import { Nullable } from "@babylonjs/core/types";

export enum InputSamplerAxis {
    W,
    A,
    S,
    D,
    Space,
    Shift,
    MouseX,
    MouseY,
    _temporalValuesStart,
    MouseDX,
    MouseDY,
    _count,
}

export class InputSampler {
    private _deviceSourceManager: DeviceSourceManager;
    private _ownsDeviceSourceManager: boolean;

    private _keyboard: Nullable<DeviceSource<DeviceType.Keyboard>> = null;
    private _keyboardObserver: Nullable<Observer<IKeyboardEvent>> = null;

    private _mouse: Nullable<DeviceSource<DeviceType.Mouse>> = null;
    private _mouseObserver: Nullable<Observer<IWheelEvent | IPointerEvent>> = null;

    private _values: Float32Array;
    private _nextValues: Float32Array;

    constructor (engine: Engine, deviceSourceManager?: DeviceSourceManager) {
        this._deviceSourceManager = deviceSourceManager ?? new DeviceSourceManager(engine);
        this._ownsDeviceSourceManager = deviceSourceManager ? true : false;

        this._values = new Float32Array(InputSamplerAxis._count);
        this._nextValues = new Float32Array(InputSamplerAxis._count);

        const setDeviceSourcesCallback = () => { this._setDeviceSources(); };
        this._deviceSourceManager.onDeviceConnectedObservable.add(setDeviceSourcesCallback);
        this._deviceSourceManager.onDeviceDisconnectedObservable.add(setDeviceSourcesCallback);
        this._setDeviceSources();

        engine.onEndFrameObservable.add(() => {
            this._values.set(this._nextValues);
            this._nextValues.fill(0, InputSamplerAxis._temporalValuesStart);
        });
    }

    private _setDeviceSources(): void {
        this._keyboard?.onInputChangedObservable?.remove(this._keyboardObserver!);
        this._mouse?.onInputChangedObservable?.remove(this._mouseObserver!);

        this._keyboard = this._deviceSourceManager.getDeviceSource(DeviceType.Keyboard)!;
        this._mouse = this._deviceSourceManager.getDeviceSource(DeviceType.Mouse)!;

        if (this._keyboard) {
            this._keyboardObserver = this._keyboard.onInputChangedObservable.add((eventData) => {
                let key;
                switch (eventData.key.toLowerCase()) {
                    case "w":
                        key = InputSamplerAxis.W;
                        break;
                    case "a":
                        key = InputSamplerAxis.A;
                        break;
                    case "s":
                        key = InputSamplerAxis.S;
                        break;
                    case "d":
                        key = InputSamplerAxis.D;
                        break;
                    case " ":
                        key = InputSamplerAxis.Space;
                        break;
                    case "shift":
                        key = InputSamplerAxis.Shift;
                        break;
                    default:
                        return;
                }
                
                switch (eventData.type) {
                    case "keydown":
                        this._nextValues[key] = 1;
                        break;
                    case "keyup":
                        this._nextValues[key] = 0;
                        break;
                    default:
                        return;
                }
            });
        }

        if (this._mouse) {
            this._mouseObserver = this._mouse.onInputChangedObservable.add((eventData) => {
                let pointerEvent = eventData as PointerEvent;
                if (pointerEvent) {
                    this._nextValues[InputSamplerAxis.MouseX] = pointerEvent.clientX ?? this._nextValues[InputSamplerAxis.MouseX];
                    this._nextValues[InputSamplerAxis.MouseY] = pointerEvent.clientY ?? this._nextValues[InputSamplerAxis.MouseY];
                    this._nextValues[InputSamplerAxis.MouseDY] += pointerEvent.movementX ?? 0;
                    this._nextValues[InputSamplerAxis.MouseDX] += pointerEvent.movementY ?? 0;
                }
            });
        }
    }

    public get(axis: InputSamplerAxis): number {
        return this._values[axis];
    }

    public dispose(): void {
        if (this._ownsDeviceSourceManager) {
            this._deviceSourceManager.dispose();
        }
    }
}
