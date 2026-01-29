/**
 * =============================================================================
 * MOVEMENT-SYSTEM.TS - Sistema per il movimento delle entità
 * =============================================================================
 */

import System from '../ecs/System';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { EntityId, IWorld } from '../ecs/types';

export class MovementSystem extends System {
    private _entitiesProcessed: number;
    private _requiredComponents: string[];

    constructor() {
        super('MovementSystem', 80);
        this._requiredComponents = ['Transform', 'Velocity'];
        this._entitiesProcessed = 0;
    }

    init(world: IWorld): void {
        super.init(world);
        console.log('[MovementSystem] Inizializzato');
        this.on('entity:teleport', (data: any) => this._handleTeleport(data));
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(this._requiredComponents);
        this._entitiesProcessed = 0;

        for (const entityId of entities) {
            this._processEntity(entityId, deltaTime);
            this._entitiesProcessed++;
        }
    }

    private _processEntity(entityId: EntityId, deltaTime: number): void {
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        const velocity = this.getComponent<VelocityComponent>(entityId, 'Velocity');

        if (!transform || !velocity) {
            return;
        }

        transform.prevX = transform.x;
        transform.prevY = transform.y;
        transform.prevRotation = transform.rotation;

        if (velocity.drag > 0) {
            this._applyDrag(velocity, deltaTime);
        }

        this._clampVelocity(velocity);

        transform.x += velocity.vx * deltaTime;
        transform.y += velocity.vy * deltaTime;

        if (velocity.angularDrag > 0) {
            this._applyAngularDrag(velocity, deltaTime);
        }
        
        velocity.angularVelocity = this._clamp(
            velocity.angularVelocity,
            -velocity.maxAngularSpeed,
            velocity.maxAngularSpeed
        );

        transform.rotation += velocity.angularVelocity * deltaTime;
        transform.rotation = this._normalizeAngle(transform.rotation);
    }

    private _applyDrag(velocity: VelocityComponent, deltaTime: number): void {
        const dragFactor = 1 - velocity.drag * deltaTime;
        
        velocity.vx *= dragFactor;
        velocity.vy *= dragFactor;

        const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
        if (speed < 0.01) {
            velocity.vx = 0;
            velocity.vy = 0;
        }
    }

    private _applyAngularDrag(velocity: VelocityComponent, deltaTime: number): void {
        const dragFactor = 1 - velocity.angularDrag * deltaTime;
        velocity.angularVelocity *= dragFactor;

        if (Math.abs(velocity.angularVelocity) < 0.001) {
            velocity.angularVelocity = 0;
        }
    }

    private _clampVelocity(velocity: VelocityComponent): void {
        const speed = Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2);
        
        if (speed > velocity.maxSpeed) {
            const scale = velocity.maxSpeed / speed;
            velocity.vx *= scale;
            velocity.vy *= scale;
        }
    }

    private _normalizeAngle(angle: number): number {
        const TWO_PI = Math.PI * 2;
        while (angle < 0) angle += TWO_PI;
        while (angle >= TWO_PI) angle -= TWO_PI;
        return angle;
    }

    private _clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private _handleTeleport(data: any): void {
        const transform = this.getComponent<TransformComponent>(data.entityId, 'Transform');
        if (!transform) return;

        transform.x = data.x;
        transform.y = data.y;
        transform.prevX = data.x;
        transform.prevY = data.y;

        if (data.rotation !== undefined) {
            transform.rotation = data.rotation;
            transform.prevRotation = data.rotation;
        }

        console.log(`[MovementSystem] Teleport entità ${data.entityId} a (${data.x}, ${data.y})`);
    }

    getStats(): object {
        const base = super.getStats();
        return {
            ...base,
            entitiesProcessed: this._entitiesProcessed
        };
    }
}

export default MovementSystem;
