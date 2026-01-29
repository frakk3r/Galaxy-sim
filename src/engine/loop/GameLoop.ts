/**
 * =============================================================================
 * GAME-LOOP.TS - Loop di gioco professionale con fixed timestep
 * =============================================================================
 */

export const LoopState = {
    STOPPED: 'stopped',
    RUNNING: 'running',
    PAUSED: 'paused',
    STEPPING: 'stepping'
} as const;

export type LoopStateType = typeof LoopState[keyof typeof LoopState];

export interface GameLoopOptions {
    update?: (deltaTime: number) => void;
    render?: (interpolation: number) => void;
    targetFPS?: number;
    maxUpdatesPerFrame?: number;
}

export interface LoopStats {
    fps: number;
    frameTime: number;
    updateTime: number;
    renderTime: number;
    updatesThisFrame: number;
    frameCount: number;
    updateCount: number;
}

export class GameLoop {
    private _updateCallback: (deltaTime: number) => void;
    private _renderCallback: (interpolation: number) => void;
    private _targetFPS: number;
    private _fixedDeltaTime: number;
    private _fixedDeltaMs: number;
    private _maxUpdatesPerFrame: number;
    private _state: LoopStateType;
    private _animationFrameId: number | null;
    private _lastTime: number;
    private _accumulator: number;
    private _totalTime: number;
    private _simulationSpeed: number;
    private _previousSimulationSpeed: number;
    private _stats: LoopStats;
    private _fpsHistory: number[];
    private _fpsHistorySize: number;

    constructor(options: GameLoopOptions = {}) {
        this._updateCallback = options.update || (() => {});
        this._renderCallback = options.render || (() => {});

        this._targetFPS = options.targetFPS || 60;
        this._fixedDeltaTime = 1 / this._targetFPS;
        this._fixedDeltaMs = 1000 / this._targetFPS;

        this._maxUpdatesPerFrame = options.maxUpdatesPerFrame || 3;

        this._state = LoopState.STOPPED;
        this._animationFrameId = null;

        this._lastTime = 0;
        this._accumulator = 0;
        this._totalTime = 0;

        this._simulationSpeed = 1;
        this._previousSimulationSpeed = 1;

        this._stats = {
            fps: 0,
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            updatesThisFrame: 0,
            frameCount: 0,
            updateCount: 0
        };

        this._fpsHistory = [];
        this._fpsHistorySize = 60;

        this._tick = this._tick.bind(this);
    }

    start(): void {
        if (this._state === LoopState.RUNNING) {
            console.warn('[GameLoop] Già in esecuzione');
            return;
        }

        console.log('[GameLoop] Avvio...');

        this._state = LoopState.RUNNING;
        this._lastTime = performance.now();
        this._accumulator = 0;

        this._animationFrameId = requestAnimationFrame(this._tick);
    }

    stop(): void {
        if (this._state === LoopState.STOPPED) {
            return;
        }

        console.log('[GameLoop] Arresto...');

        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }

        this._state = LoopState.STOPPED;
    }

    pause(): void {
        if (this._state !== LoopState.RUNNING) {
            return;
        }

        console.log('[GameLoop] Pausa');

        this._previousSimulationSpeed = this._simulationSpeed;
        this._state = LoopState.PAUSED;
    }

    resume(): void {
        if (this._state !== LoopState.PAUSED) {
            return;
        }

        console.log('[GameLoop] Ripresa');

        this._lastTime = performance.now();
        this._accumulator = 0;

        this._state = LoopState.RUNNING;
    }

    togglePause(): void {
        if (this._state === LoopState.PAUSED) {
            this.resume();
        } else if (this._state === LoopState.RUNNING) {
            this.pause();
        }
    }

    step(): void {
        if (this._state === LoopState.STOPPED) {
            console.warn('[GameLoop] Impossibile fare step - loop fermo');
            return;
        }

        console.log('[GameLoop] Step singolo');

        this._performUpdate(this._fixedDeltaTime);
        this._stats.updateCount++;

        this._performRender(1.0);
        this._stats.frameCount++;
    }

    setSpeed(speed: number): void {
        if (speed <= 0) {
            console.warn('[GameLoop] Velocità deve essere > 0');
            return;
        }

        console.log(`[GameLoop] Velocità: ${speed}x`);
        this._simulationSpeed = speed;
    }

    private _tick(currentTime: number): void {
        this._animationFrameId = requestAnimationFrame(this._tick);

        const deltaMs = currentTime - this._lastTime;
        this._lastTime = currentTime;

        this._updateFpsStats(deltaMs);

        if (this._state === LoopState.PAUSED) {
            const renderStart = performance.now();
            this._performRender(0);
            this._stats.renderTime = performance.now() - renderStart;
            this._stats.frameCount++;
            return;
        }

        const scaledDeltaMs = deltaMs * this._simulationSpeed;
        this._accumulator += scaledDeltaMs;

        const updateStart = performance.now();
        let updatesThisFrame = 0;

        while (this._accumulator >= this._fixedDeltaMs && updatesThisFrame < this._maxUpdatesPerFrame) {
            this._performUpdate(this._fixedDeltaTime);
            
            this._accumulator -= this._fixedDeltaMs;
            this._totalTime += this._fixedDeltaTime;
            
            updatesThisFrame++;
            this._stats.updateCount++;
        }

        if (this._accumulator > this._fixedDeltaMs * this._maxUpdatesPerFrame) {
            console.warn('[GameLoop] Troppo accumulo - scarto tempo in eccesso');
            this._accumulator = 0;
        }

        this._stats.updateTime = performance.now() - updateStart;
        this._stats.updatesThisFrame = updatesThisFrame;

        const interpolation = this._accumulator / this._fixedDeltaMs;

        const renderStart = performance.now();
        this._performRender(interpolation);
        this._stats.renderTime = performance.now() - renderStart;

        this._stats.frameCount++;
        this._stats.frameTime = deltaMs;
    }

    private _performUpdate(deltaTime: number): void {
        try {
            this._updateCallback(deltaTime);
        } catch (error) {
            console.error('[GameLoop] Errore in update:', error);
        }
    }

    private _performRender(interpolation: number): void {
        try {
            this._renderCallback(interpolation);
        } catch (error) {
            console.error('[GameLoop] Errore in render:', error);
        }
    }

    private _updateFpsStats(deltaMs: number): void {
        const fps = deltaMs > 0 ? 1000 / deltaMs : 0;

        this._fpsHistory.push(fps);
        if (this._fpsHistory.length > this._fpsHistorySize) {
            this._fpsHistory.shift();
        }

        const sum = this._fpsHistory.reduce((a, b) => a + b, 0);
        this._stats.fps = Math.round(sum / this._fpsHistory.length);
    }

    setUpdateCallback(callback: (deltaTime: number) => void): void {
        this._updateCallback = callback;
    }

    setRenderCallback(callback: (interpolation: number) => void): void {
        this._renderCallback = callback;
    }

    get isRunning(): boolean {
        return this._state === LoopState.RUNNING;
    }

    get isPaused(): boolean {
        return this._state === LoopState.PAUSED;
    }

    get state(): string {
        return this._state;
    }

    get speed(): number {
        return this._simulationSpeed;
    }

    get totalTime(): number {
        return this._totalTime;
    }

    get fixedDeltaTime(): number {
        return this._fixedDeltaTime;
    }

    getStats(): LoopStats {
        return { ...this._stats };
    }

    resetStats(): void {
        this._stats = {
            fps: 0,
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            updatesThisFrame: 0,
            frameCount: 0,
            updateCount: 0
        };
        this._fpsHistory = [];
    }
}

export default GameLoop;
