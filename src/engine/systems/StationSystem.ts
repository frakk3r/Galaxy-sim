/**
 * =============================================================================
 * STATION-SYSTEM.TS - Gestione attracco e stazioni
 * =============================================================================
 */

import System from '../ecs/System';
import { IWorld, EntityId, Entity } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { StationComponent } from '../../game/components/Station';
import { DockingComponent, createDocking, DockStatus } from '../../game/components/Docking';
import { ColliderComponent, CollisionLayer } from '../../game/components/Collider';

export class StationSystem extends System {
    constructor() {
        super('StationSystem', 60); // Priority alta per sovrascrivere input
    }

    init(world: IWorld): void {
        super.init(world);
        
        this.on('input:action:pressed', (data: any) => {
            if (data.action === 'dock') {
                this._handleDockPress();
            }
        });

        this.on('input:action:released', (data: any) => {
            if (data.action === 'dock') {
                this._handleDockRelease();
            }
        });

        console.log('[StationSystem] Inizializzato');
    }

    update(deltaTime: number): void {
        const entities = this.queryEntities(['Docking', 'Transform']);

        for (const entityId of entities) {
            this._updateEntity(entityId, deltaTime);
        }
    }

    private _handleDockPress(): void {
        const players = (this.world as any).getEntitiesByTag('player') as Entity[];
        if (players.length === 0) return;
        const playerId = players[0].id;

        const docking = this.getComponent<DockingComponent>(playerId, 'Docking');
        
        if (docking) {
            // Se già docked, inizia sgancio
            if (docking.status === DockStatus.DOCKED) {
                docking.status = DockStatus.UNDOCKING;
                console.log('[Station] Inizio sgancio...');
            }
        } else {
            // Prova ad attraccare
            this._tryDock(playerId);
        }
    }

    private _handleDockRelease(): void {
        const players = (this.world as any).getEntitiesByTag('player') as Entity[];
        if (players.length === 0) return;
        const playerId = players[0].id;

        const docking = this.getComponent<DockingComponent>(playerId, 'Docking');
        
        if (docking && docking.status === DockStatus.APPROACHING) {
            this.world!.removeComponent(playerId, 'Docking');
            
            // Ripristina collisioni
            const pCollider = this.getComponent<ColliderComponent>(playerId, 'Collider');
            if (pCollider) {
                pCollider.mask = pCollider.mask | CollisionLayer.STATION;
            }

            console.log('[Station] Attracco interrotto (tasto rilasciato)');
        }
    }

    private _tryDock(entityId: EntityId): void {
        const pTransform = this.getComponent<TransformComponent>(entityId, 'Transform');
        if (!pTransform) return;

        // Cerca stazioni vicine
        const stations = this.queryEntities(['Station', 'Transform']);
        let targetStationId: EntityId | null = null;
        let minDistSq = Infinity;

        for (const stationId of stations) {
            const sTransform = this.getComponent<TransformComponent>(stationId, 'Transform');
            const station = this.getComponent<StationComponent>(stationId, 'Station');
            
            if (!sTransform || !station) continue;

            const dx = sTransform.x - pTransform.x;
            const dy = sTransform.y - pTransform.y;
            const distSq = dx*dx + dy*dy;

            // Raggio di attivazione
            const activationRadius = station.dockingRadius * 1.5; 
            if (distSq < activationRadius * activationRadius && distSq < minDistSq) {
                minDistSq = distSq;
                targetStationId = stationId;
            }
        }

        if (targetStationId !== null) {
            const dockingPoint = this._getDockingPoint(targetStationId);
            
            if (dockingPoint) {
                // Disabilita collisione con STAZIONE durante l'attracco
                const pCollider = this.getComponent<ColliderComponent>(entityId, 'Collider');
                if (pCollider) {
                    pCollider.mask = pCollider.mask & ~CollisionLayer.STATION;
                }

                this.world!.addComponent(entityId, 'Docking', createDocking({
                    stationId: targetStationId,
                    status: DockStatus.APPROACHING,
                    targetX: dockingPoint.x,
                    targetY: dockingPoint.y,
                    targetRotation: dockingPoint.rotation
                }));

                console.log(`[Station] Iniziato attracco alla stazione ${targetStationId}`);
                this.emit('station:docking_start', { entityId, stationId: targetStationId });
            }
        }
    }

    private _getDockingPoint(stationId: EntityId): { x: number, y: number, rotation: number } | null {
        const sTransform = this.getComponent<TransformComponent>(stationId, 'Transform');
        const station = this.getComponent<StationComponent>(stationId, 'Station');
        
        if (!sTransform || !station) return null;

        const relX = station.dockingPort.x;
        const relY = station.dockingPort.y;
        const angle = station.dockingPort.angle;
        
        const cos = Math.cos(sTransform.rotation);
        const sin = Math.sin(sTransform.rotation);
        
        // Rotazione 2D punto locale
        const globalX = sTransform.x + (relX * cos - relY * sin);
        const globalY = sTransform.y + (relX * sin + relY * cos);
        
        // Angolo globale nave (rotazione stazione + angolo attracco)
        const globalAngle = sTransform.rotation + angle;
        
        return { x: globalX, y: globalY, rotation: globalAngle };
    }

    private _updateEntity(entityId: EntityId, deltaTime: number): void {
        const docking = this.getComponent<DockingComponent>(entityId, 'Docking');
        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        let velocity = this.getComponent<VelocityComponent>(entityId, 'Velocity');

        if (!docking || !transform) return;

        let localVelocity: VelocityComponent = velocity ?? { vx: 0, vy: 0, angularVelocity: 0, maxSpeed: 1000, maxAngularSpeed: Math.PI * 2, drag: 0, angularDrag: 0 };

        // Aggiorna target point ogni frame (se la stazione si muove/ruota)
        const currentPoint = this._getDockingPoint(docking.stationId);
        if (currentPoint) {
            docking.targetX = currentPoint.x;
            docking.targetY = currentPoint.y;
            docking.targetRotation = currentPoint.rotation;
        } else {
            this._handleUndocking(entityId, docking, transform, localVelocity, deltaTime);
            
            if (velocity) {
                velocity.vx = localVelocity.vx;
                velocity.vy = localVelocity.vy;
                velocity.angularVelocity = localVelocity.angularVelocity;
            }
            return;
        }

        switch (docking.status) {
            case DockStatus.APPROACHING:
                this._handleApproaching(entityId, docking, transform, localVelocity, deltaTime);
                break;
            case DockStatus.DOCKED:
                // Don't handle if transitioning to UNDOCKING (let _handleUndocking run)
                this._handleDocked(entityId, docking, transform, localVelocity);
                break;
            case DockStatus.UNDOCKING:
                this._handleUndocking(entityId, docking, transform, localVelocity, deltaTime);
                break;
        }

        // Only copy velocity back if NOT docked (docked sets velocity to 0)
        if (velocity && docking.status !== DockStatus.DOCKED) {
            velocity.vx = localVelocity.vx;
            velocity.vy = localVelocity.vy;
            velocity.angularVelocity = localVelocity.angularVelocity;
        }
    }

    private _handleApproaching(entityId: EntityId, docking: DockingComponent, transform: TransformComponent, velocity: VelocityComponent, deltaTime: number): void {
        const dx = docking.targetX - transform.x;
        const dy = docking.targetY - transform.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);

        // Se siamo molto vicini, completiamo attracco
        if (dist < 10) { // Tolleranza 10px
            docking.status = DockStatus.DOCKED;
            // Snap immediato
            this._handleDocked(entityId, docking, transform, velocity);
            console.log('[Station] Attracco completato!');
            this.emit('station:docked', { entityId, stationId: docking.stationId });
            return;
        }

        // Calcola velocità desiderata
        const approachSpeed = Math.min(dist * 3, 200);
        const targetVx = (dx / dist) * approachSpeed;
        const targetVy = (dy / dist) * approachSpeed;

        // Lerp velocità (guida assistita)
        const lerpFactor = 10 * deltaTime;
        velocity.vx += (targetVx - velocity.vx) * lerpFactor;
        velocity.vy += (targetVy - velocity.vy) * lerpFactor;

        // Ruota verso l'angolo di attracco
        let angleDiff = docking.targetRotation - transform.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        transform.rotation += angleDiff * 10 * deltaTime;
        velocity.angularVelocity = 0;
    }

    private _handleDocked(entityId: EntityId, docking: DockingComponent, transform: TransformComponent, velocity: VelocityComponent): void {
        transform.x = docking.targetX;
        transform.y = docking.targetY;
        transform.rotation = docking.targetRotation;
        velocity.vx = 0;
        velocity.vy = 0;
        velocity.angularVelocity = 0;
    }

    private _handleUndocking(entityId: EntityId, docking: DockingComponent, transform: TransformComponent, velocity: VelocityComponent, deltaTime: number): void {
        const undockSpeed = 300;
        
        const dx = transform.x - docking.targetX;
        const dy = transform.y - docking.targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Only push if velocity is very small (initial push)
        if (Math.abs(velocity.vx) < 10 && Math.abs(velocity.vy) < 10) {
            const exitAngle = Math.atan2(-dy, -dx);
            velocity.vx = Math.cos(exitAngle) * undockSpeed;
            velocity.vy = Math.sin(exitAngle) * undockSpeed;
            transform.rotation = exitAngle;
            velocity.angularVelocity = 0;
        }
        
        if (dist > 350) {
            this.world!.removeComponent(entityId, 'Docking');
            
            const pCollider = this.getComponent<ColliderComponent>(entityId, 'Collider');
            if (pCollider) {
                pCollider.mask = pCollider.mask | CollisionLayer.STATION;
            }

            console.log('[Station] Sganciato e controlli restituiti.');
            this.emit('station:undocked', { entityId, stationId: docking.stationId });
        }
    }
}

export default StationSystem;
