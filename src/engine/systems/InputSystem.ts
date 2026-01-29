/**
 * =============================================================================
 * INPUT-SYSTEM.TS - Sistema centralizzato per gestione input
 * =============================================================================
 */

import System from '../ecs/System';
import { IWorld } from '../ecs/types';

export const InputAction = {
    // Movimento
    THRUST_FORWARD: 'thrust_forward',
    THRUST_BACKWARD: 'thrust_backward',
    ROTATE_LEFT: 'rotate_left',
    ROTATE_RIGHT: 'rotate_right',
    STRAFE_LEFT: 'strafe_left',
    STRAFE_RIGHT: 'strafe_right',
    BRAKE: 'brake',

    // Combattimento
    FIRE_PRIMARY: 'fire_primary',
    FIRE_SECONDARY: 'fire_secondary',
    FIRE_MISSILE: 'fire_missile',
    CYCLE_WEAPON: 'cycle_weapon',
    TARGET_NEXT: 'target_next',
    TARGET_PREV: 'target_prev',

    // Interazione
    DOCK: 'dock',
    INVENTORY: 'inventory',
    MAP: 'map',

    // Sistema
    PAUSE: 'pause',
    DEBUG_TOGGLE: 'debug_toggle',
    SPEED_1: 'speed_1',
    SPEED_2: 'speed_2',
    SPEED_3: 'speed_3',
    SPEED_5: 'speed_5',
    STEP: 'step'
} as const;

export type InputActionType = typeof InputAction[keyof typeof InputAction];

const DEFAULT_KEY_BINDINGS: Record<string, string> = {
    'KeyW': InputAction.THRUST_FORWARD,
    'ArrowUp': InputAction.THRUST_FORWARD,
    'KeyS': InputAction.THRUST_BACKWARD,
    'ArrowDown': InputAction.THRUST_BACKWARD,
    'KeyA': InputAction.ROTATE_LEFT,
    'ArrowLeft': InputAction.ROTATE_LEFT,
    'KeyD': InputAction.ROTATE_RIGHT,
    'ArrowRight': InputAction.ROTATE_RIGHT,
    'KeyQ': InputAction.STRAFE_LEFT,
    'KeyE': InputAction.STRAFE_RIGHT,
    'Space': InputAction.BRAKE,
    'MouseLeft': InputAction.FIRE_PRIMARY,
    'MouseRight': InputAction.FIRE_SECONDARY,
    'KeyK': InputAction.FIRE_PRIMARY,
    'KeyL': InputAction.FIRE_MISSILE,
    'KeyR': InputAction.CYCLE_WEAPON,
    'Tab': InputAction.TARGET_NEXT,
    'ShiftLeft+Tab': InputAction.TARGET_PREV,
    'KeyT': InputAction.DOCK,
    'KeyI': InputAction.INVENTORY,
    'KeyM': InputAction.MAP,
    'Escape': InputAction.PAUSE,
    'KeyG': InputAction.DEBUG_TOGGLE,
    'Digit1': InputAction.SPEED_1,
    'Digit2': InputAction.SPEED_2,
    'Digit3': InputAction.SPEED_3,
    'Digit5': InputAction.SPEED_5,
    'KeyN': InputAction.STEP
};

export class InputSystem extends System {
    private _target: HTMLElement | Document;
    private _keyState: Map<string, boolean>;
    private _actionState: Map<string, boolean>;
    private _actionsJustPressed: Set<string>;
    private _actionsJustReleased: Set<string>;
    private _mouse: {
        x: number;
        y: number;
        worldX: number;
        worldY: number;
        deltaX: number;
        deltaY: number;
        buttons: Map<number, boolean>;
        wheel: number;
    };
    private _keyBindings: Map<string, string>;
    private _actionToKeys: Map<string, string[]>;
    private _hasFocus: boolean;

    constructor(targetElement: HTMLElement | Document = document) {
        super('InputSystem', 100);

        this._target = targetElement;
        this._keyState = new Map();
        this._actionState = new Map();
        this._actionsJustPressed = new Set();
        this._actionsJustReleased = new Set();

        this._mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            deltaX: 0,
            deltaY: 0,
            buttons: new Map(),
            wheel: 0
        };

        this._keyBindings = new Map();
        this._loadDefaultBindings();

        this._actionToKeys = new Map();
        this._buildReverseBindings();

        this._hasFocus = true;

        // Bindings
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onBlur = this._onBlur.bind(this);
        this._onFocus = this._onFocus.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
    }

    init(world: IWorld): void {
        super.init(world);

        this._target.addEventListener('keydown', this._onKeyDown as EventListener);
        this._target.addEventListener('keyup', this._onKeyUp as EventListener);
        this._target.addEventListener('mousemove', this._onMouseMove as EventListener);
        this._target.addEventListener('mousedown', this._onMouseDown as EventListener);
        this._target.addEventListener('mouseup', this._onMouseUp as EventListener);
        this._target.addEventListener('wheel', this._onWheel as EventListener, { passive: false });
        this._target.addEventListener('contextmenu', this._onContextMenu as EventListener);

        window.addEventListener('blur', this._onBlur);
        window.addEventListener('focus', this._onFocus);

        console.log('[InputSystem] Inizializzato - listeners registrati');
    }

    update(deltaTime: number): void {
        this._actionsJustPressed.clear();
        this._actionsJustReleased.clear();

        this._mouse.deltaX = 0;
        this._mouse.deltaY = 0;
        this._mouse.wheel = 0;
    }

    isActionPressed(action: string): boolean {
        return this._actionState.get(action) === true;
    }

    isActionJustPressed(action: string): boolean {
        return this._actionsJustPressed.has(action);
    }

    isActionJustReleased(action: string): boolean {
        return this._actionsJustReleased.has(action);
    }

    getMousePosition(): { x: number; y: number } {
        return { x: this._mouse.x, y: this._mouse.y };
    }

    getMouseWorldPosition(): { x: number; y: number } {
        return { x: this._mouse.worldX, y: this._mouse.worldY };
    }

    getMouseDelta(): { x: number; y: number } {
        return { x: this._mouse.deltaX, y: this._mouse.deltaY };
    }

    getWheelDelta(): number {
        return this._mouse.wheel;
    }

    isMouseButtonPressed(button: number): boolean {
        return this._mouse.buttons.get(button) === true;
    }

    setMouseWorldPosition(worldX: number, worldY: number): void {
        this._mouse.worldX = worldX;
        this._mouse.worldY = worldY;
    }

    getHorizontalAxis(): number {
        let value = 0;
        if (this.isActionPressed(InputAction.ROTATE_LEFT)) value -= 1;
        if (this.isActionPressed(InputAction.ROTATE_RIGHT)) value += 1;
        return value;
    }

    getVerticalAxis(): number {
        let value = 0;
        if (this.isActionPressed(InputAction.THRUST_BACKWARD)) value -= 1;
        if (this.isActionPressed(InputAction.THRUST_FORWARD)) value += 1;
        return value;
    }

    getStrafeAxis(): number {
        let value = 0;
        if (this.isActionPressed(InputAction.STRAFE_LEFT)) value -= 1;
        if (this.isActionPressed(InputAction.STRAFE_RIGHT)) value += 1;
        return value;
    }

    setBinding(keyCode: string, action: string): void {
        this._keyBindings.set(keyCode, action);
        this._buildReverseBindings();
    }

    getKeysForAction(action: string): string[] {
        return this._actionToKeys.get(action) || [];
    }

    resetToDefaultBindings(): void {
        this._keyBindings.clear();
        this._loadDefaultBindings();
        this._buildReverseBindings();
    }

    private _onKeyDown(event: KeyboardEvent): void {
        if (this._isTypingInInput(event)) return;

        const code = event.code;

        if (event.repeat) return;

        if (this._keyBindings.has(code)) {
            event.preventDefault();
        }

        this._keyState.set(code, true);

        const action = this._keyBindings.get(code);
        if (action) {
            if (!this._actionState.get(action)) {
                this._actionsJustPressed.add(action);
                this.emit('input:action:pressed', { action, keyCode: code });
            }
            this._actionState.set(action, true);
        }

        this.emit('input:keydown', { code, key: event.key });
    }

    private _onKeyUp(event: KeyboardEvent): void {
        const code = event.code;

        this._keyState.set(code, false);

        const action = this._keyBindings.get(code);
        if (action) {
            const otherKeysPressed = this._checkOtherKeysForAction(action, code);
            
            if (!otherKeysPressed) {
                this._actionState.set(action, false);
                this._actionsJustReleased.add(action);
                this.emit('input:action:released', { action, keyCode: code });
            }
        }

        this.emit('input:keyup', { code, key: event.key });
    }

    private _onMouseMove(event: MouseEvent): void {
        const prevX = this._mouse.x;
        const prevY = this._mouse.y;

        this._mouse.x = event.clientX;
        this._mouse.y = event.clientY;
        this._mouse.deltaX = event.clientX - prevX;
        this._mouse.deltaY = event.clientY - prevY;

        this.emit('input:mousemove', {
            x: this._mouse.x,
            y: this._mouse.y,
            deltaX: this._mouse.deltaX,
            deltaY: this._mouse.deltaY
        });
    }

    private _onMouseDown(event: MouseEvent): void {
        this._mouse.buttons.set(event.button, true);

        const actionMap: Record<number, string> = {
            0: InputAction.FIRE_PRIMARY,
            2: InputAction.FIRE_SECONDARY
        };

        const action = actionMap[event.button];

        if (action) {
            if (!this._actionState.get(action)) {
                this._actionsJustPressed.add(action);
            }
            this._actionState.set(action, true);
            this.emit('input:action:pressed', { action, button: event.button });
        }

        this.emit('input:mousedown', { button: event.button, x: event.clientX, y: event.clientY });
    }

    private _onMouseUp(event: MouseEvent): void {
        this._mouse.buttons.set(event.button, false);

        const actionMap: Record<number, string> = {
            0: InputAction.FIRE_PRIMARY,
            2: InputAction.FIRE_SECONDARY
        };

        const action = actionMap[event.button];
        if (action) {
            this._actionState.set(action, false);
            this._actionsJustReleased.add(action);
            this.emit('input:action:released', { action, button: event.button });
        }

        this.emit('input:mouseup', { button: event.button, x: event.clientX, y: event.clientY });
    }

    private _onWheel(event: WheelEvent): void {
        event.preventDefault();
        this._mouse.wheel = -Math.sign(event.deltaY);

        this.emit('input:wheel', { delta: this._mouse.wheel, raw: event.deltaY });
    }

    private _onBlur(): void {
        this._hasFocus = false;
        
        this._keyState.clear();
        this._actionState.clear();
        this._mouse.buttons.clear();

        this.emit('input:blur', {});
    }

    private _onFocus(): void {
        this._hasFocus = true;
        this.emit('input:focus', {});
    }

    private _onContextMenu(event: MouseEvent): void {
        event.preventDefault();
    }

    private _loadDefaultBindings(): void {
        for (const [key, action] of Object.entries(DEFAULT_KEY_BINDINGS)) {
            this._keyBindings.set(key, action);
        }
    }

    private _buildReverseBindings(): void {
        this._actionToKeys.clear();
        
        for (const [key, action] of this._keyBindings) {
            if (!this._actionToKeys.has(action)) {
                this._actionToKeys.set(action, []);
            }
            this._actionToKeys.get(action)!.push(key);
        }
    }

    private _checkOtherKeysForAction(action: string, excludeCode: string): boolean {
        const keys = this._actionToKeys.get(action) || [];
        
        for (const keyCode of keys) {
            if (keyCode !== excludeCode && this._keyState.get(keyCode)) {
                return true;
            }
        }
        
        return false;
    }

    private _isTypingInInput(event: KeyboardEvent): boolean {
        const target = event.target as HTMLElement;
        return target.tagName === 'INPUT' || 
               target.tagName === 'TEXTAREA' || 
               target.isContentEditable;
    }

    destroy(): void {
        this._target.removeEventListener('keydown', this._onKeyDown as EventListener);
        this._target.removeEventListener('keyup', this._onKeyUp as EventListener);
        this._target.removeEventListener('mousemove', this._onMouseMove as EventListener);
        this._target.removeEventListener('mousedown', this._onMouseDown as EventListener);
        this._target.removeEventListener('mouseup', this._onMouseUp as EventListener);
        this._target.removeEventListener('wheel', this._onWheel as EventListener);
        this._target.removeEventListener('contextmenu', this._onContextMenu as EventListener);

        window.removeEventListener('blur', this._onBlur);
        window.removeEventListener('focus', this._onFocus);

        super.destroy();
        console.log('[InputSystem] Distrutto');
    }

    getStats(): object {
        const pressedActions: string[] = [];
        for (const [action, pressed] of this._actionState) {
            if (pressed) pressedActions.push(action);
        }

        return {
            ...super.getStats(),
            hasFocus: this._hasFocus,
            pressedActions,
            mousePosition: { x: this._mouse.x, y: this._mouse.y }
        };
    }
}

export default InputSystem;
