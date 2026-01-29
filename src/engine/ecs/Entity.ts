/**
 * =============================================================================
 * ENTITY.TS - Definizione base di un'entità nel sistema ECS
 * =============================================================================
 */

import { EntityId } from './types';

// Contatore globale per ID univoci
let nextEntityId: EntityId = 1;

/**
 * Classe Entity - Rappresenta un oggetto nel mondo di gioco
 */
export class Entity {
    public readonly id: EntityId;
    public tag: string;
    public createdAt: number;
    public markedForRemoval: boolean;

    /**
     * Crea una nuova entità con ID univoco
     * 
     * @param {string} [tag=''] - Tag opzionale per identificazione (es: 'player', 'asteroid')
     */
    constructor(tag: string = '') {
        this.id = nextEntityId++;
        this.tag = tag;
        this.createdAt = performance.now();
        this.markedForRemoval = false;
    }

    /**
     * Restituisce rappresentazione stringa per debug
     */
    toString(): string {
        return `Entity[${this.id}${this.tag ? `:${this.tag}` : ''}]`;
    }
}

/**
 * Resetta il contatore degli ID
 */
export function resetEntityIdCounter(): void {
    nextEntityId = 1;
}

/**
 * Ottiene il prossimo ID che verrà assegnato
 */
export function peekNextEntityId(): number {
    return nextEntityId;
}

export default Entity;
