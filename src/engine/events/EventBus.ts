/**
 * =============================================================================
 * EVENT-BUS.TS - Sistema di eventi pub/sub disaccoppiato
 * =============================================================================
 */

type EventCallback = (data: any) => void;

interface QueuedEvent {
    type: string;
    data: any;
}

interface EventRecord {
    type: string;
    data: any;
    timestamp: number;
}

export class EventBus {
    private _listeners: Map<string, Set<EventCallback>>;
    private _wildcardListeners: Set<(type: string, data: any) => void>;
    private _queue: QueuedEvent[];
    private _isEmitting: boolean;
    private _emitDepth: number;
    private _maxEmitDepth: number;
    private _emitCount: number;
    private _queuedCount: number;
    private _eventHistory: EventRecord[];
    private _historyEnabled: boolean;
    private _maxHistorySize: number;

    constructor() {
        this._listeners = new Map();
        this._wildcardListeners = new Set();
        this._queue = [];
        this._isEmitting = false;
        this._emitDepth = 0;
        this._maxEmitDepth = 10;
        this._emitCount = 0;
        this._queuedCount = 0;
        this._eventHistory = [];
        this._historyEnabled = false;
        this._maxHistorySize = 1000;
    }

    on(eventType: string, callback: EventCallback): () => void {
        if (typeof callback !== 'function') {
            throw new Error(`Callback deve essere una funzione, ricevuto: ${typeof callback}`);
        }

        if (!this._listeners.has(eventType)) {
            this._listeners.set(eventType, new Set());
        }

        this._listeners.get(eventType)!.add(callback);

        return () => this.off(eventType, callback);
    }

    once(eventType: string, callback: EventCallback): () => void {
        const wrapper = (data: any) => {
            this.off(eventType, wrapper);
            callback(data);
        };

        return this.on(eventType, wrapper);
    }

    off(eventType: string, callback: EventCallback): boolean {
        const listeners = this._listeners.get(eventType);
        if (!listeners) {
            return false;
        }

        return listeners.delete(callback);
    }

    offAll(eventType: string): void {
        this._listeners.delete(eventType);
    }

    onAny(callback: (type: string, data: any) => void): () => void {
        this._wildcardListeners.add(callback);
        return () => this._wildcardListeners.delete(callback);
    }

    emit(eventType: string, data: any = {}): void {
        this._emitDepth++;
        if (this._emitDepth > this._maxEmitDepth) {
            console.error(`[EventBus] Troppi emit ricorsivi (${this._emitDepth}). Possibile loop infinito.`);
            this._emitDepth--;
            return;
        }

        this._emitCount++;

        const event: EventRecord = {
            type: eventType,
            data: data,
            timestamp: performance.now()
        };

        if (this._historyEnabled) {
            this._addToHistory(event);
        }

        for (const callback of this._wildcardListeners) {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error(`[EventBus] Errore in wildcard listener:`, error);
            }
        }

        const listeners = this._listeners.get(eventType);
        if (listeners) {
            const listenersCopy = Array.from(listeners);
            
            for (const callback of listenersCopy) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Errore in listener per "${eventType}":`, error);
                }
            }
        }

        this._emitDepth--;
    }

    queue(eventType: string, data: any = {}): void {
        this._queue.push({ type: eventType, data: data });
        this._queuedCount++;
    }

    flush(): number {
        let processed = 0;

        while (this._queue.length > 0) {
            const event = this._queue.shift();
            if (event) {
                this.emit(event.type, event.data);
                processed++;

                if (processed > 10000) {
                    console.error('[EventBus] Troppi eventi in coda. Possibile loop.');
                    this._queue = [];
                    break;
                }
            }
        }

        return processed;
    }

    hasListeners(eventType: string): boolean {
        const listeners = this._listeners.get(eventType);
        return listeners ? listeners.size > 0 : false;
    }

    listenerCount(eventType: string): number {
        const listeners = this._listeners.get(eventType);
        return listeners ? listeners.size : 0;
    }

    setHistoryEnabled(enabled: boolean): void {
        this._historyEnabled = enabled;
        if (!enabled) {
            this._eventHistory = [];
        }
    }

    getHistory(limit: number = 100): EventRecord[] {
        return this._eventHistory.slice(-limit);
    }

    private _addToHistory(event: EventRecord): void {
        this._eventHistory.push(event);
        
        if (this._eventHistory.length > this._maxHistorySize) {
            this._eventHistory = this._eventHistory.slice(-this._maxHistorySize / 2);
        }
    }

    getStats(): object {
        const listenerCounts: Record<string, number> = {};
        for (const [type, listeners] of this._listeners) {
            listenerCounts[type] = listeners.size;
        }

        return {
            emitCount: this._emitCount,
            queuedCount: this._queuedCount,
            currentQueueSize: this._queue.length,
            wildcardListenerCount: this._wildcardListeners.size,
            listenerCounts: listenerCounts,
            historyEnabled: this._historyEnabled,
            historySize: this._eventHistory.length
        };
    }

    clear(): void {
        this._listeners.clear();
        this._wildcardListeners.clear();
        this._queue = [];
        this._eventHistory = [];
        this._emitCount = 0;
        this._queuedCount = 0;
        this._emitDepth = 0;
    }
}

export default EventBus;
