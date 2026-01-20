/**
 * =============================================================================
 * COMPONENTS/INDEX.TS - Export centralizzato dei componenti
 * =============================================================================
 */

// Componenti base
export { createTransform, TRANSFORM_DEFAULTS } from './Transform';
export { createVelocity, VELOCITY_DEFAULTS } from './Velocity';
export { createRenderable, SHAPE_PRESETS } from './Renderable';
export { createCollider, CollisionLayer, COLLIDER_PRESETS } from './Collider';
export { createPhysics, PHYSICS_PRESETS } from './Physics';
export { createHealth, HEALTH_PRESETS } from './Health';
export { createLifetime } from './Lifetime';
export { createCargo, CARGO_PRESETS } from './Cargo';
export { createPickup, RESOURCES, ResourceType } from './Pickup';

// Componenti nave modulare
export { createShipHull, HullClass, ModuleSlotType, HULL_PRESETS } from './ShipHull';
export { createShipEngine, ENGINE_PRESETS } from './ShipEngine';
export { createShipReactor, REACTOR_PRESETS } from './ShipReactor';
export { createShipShield, SHIELD_PRESETS } from './ShipShield';
export { createShipWeapon, WeaponType, DamageType, WEAPON_PRESETS } from './ShipWeapon';
export { createStationComponent } from './Station';
export { createDocking, DockStatus } from './Docking';
export { createForceField } from './ForceField';

// AI e combattimento
export { createAIController, AIState, AITargetType } from './AIController';
export { createProjectile } from './Projectile';
export { createFaction, FactionRelation, FACTIONS } from './Faction';
export { createTradeShip, type TradeState } from './TradeShip';

/**
 * Registry dei tipi di componenti
 */
export const COMPONENT_TYPES = {
    // Base
    TRANSFORM: 'Transform',
    VELOCITY: 'Velocity',
    RENDERABLE: 'Renderable',
    COLLIDER: 'Collider',
    PHYSICS: 'Physics',
    HEALTH: 'Health',
    CARGO: 'Cargo',
    PICKUP: 'Pickup',
    
    // Nave
    SHIP_HULL: 'ShipHull',
    SHIP_ENGINE: 'ShipEngine',
    SHIP_REACTOR: 'ShipReactor',
    SHIP_SHIELD: 'ShipShield',
    SHIP_WEAPON: 'ShipWeapon',
    STATION: 'Station',
    DOCKING: 'Docking',
    FORCE_FIELD: 'ForceField',
    
    // AI e combattimento
    AI_CONTROLLER: 'AIController',
    PROJECTILE: 'Projectile',
    FACTION: 'Faction'
};
