/**
 * =============================================================================
 * ENGINE/INDEX.TS - Export principale dell'engine
 * =============================================================================
 */

// ECS Core
export { 
    Entity, 
    EntityManager, 
    ComponentManager, 
    System, 
    SystemManager, 
    World 
} from './ecs';

// Eventi
export { EventBus } from './events';

// Game Loop
export { GameLoop, LoopState } from './loop';

// Sistemi base
export { MovementSystem } from './systems';
