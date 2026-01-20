/**
 * =============================================================================
 * ECS/INDEX.TS - Export centralizzato del modulo ECS
 * =============================================================================
 */

export { Entity, resetEntityIdCounter, peekNextEntityId } from './Entity';
export { EntityManager } from './EntityManager';
export { ComponentManager } from './ComponentManager';
export { System } from './System';
export { SystemManager } from './SystemManager';
export { World } from './World';
export * from './types';
