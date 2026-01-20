/**
 * =============================================================================
 * COLLISION-SYSTEM.TS - Sistema per rilevamento e risposta alle collisioni
 * =============================================================================
 */

import System from '../ecs/System';
import { TransformComponent } from '../../game/components/Transform';
import { ColliderComponent } from '../../game/components/Collider';
import { EntityId, IWorld } from '../ecs/types';

// ============================================================================
// SPATIAL HASH GRID - Ottimizzazione Broad Phase
// ============================================================================

class SpatialHashGrid {
    private cellSize: number;
    private cells: Map<string, Set<EntityId>>;
    private entityCells: Map<EntityId, Set<string>>;

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.entityCells = new Map();
    }

    private _getCellKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    private _getCellsForBounds(minX: number, minY: number, maxX: number, maxY: number): string[] {
        const cells: string[] = [];
        const startX = Math.floor(minX / this.cellSize);
        const startY = Math.floor(minY / this.cellSize);
        const endX = Math.floor(maxX / this.cellSize);
        const endY = Math.floor(maxY / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                cells.push(`${x},${y}`);
            }
        }
        return cells;
    }

    insert(entityId: EntityId, x: number, y: number, radius: number): void {
        this.remove(entityId);

        const cells = this._getCellsForBounds(
            x - radius, y - radius,
            x + radius, y + radius
        );

        const entityCellSet = new Set<string>();
        for (const cellKey of cells) {
            if (!this.cells.has(cellKey)) {
                this.cells.set(cellKey, new Set());
            }
            this.cells.get(cellKey)!.add(entityId);
            entityCellSet.add(cellKey);
        }

        this.entityCells.set(entityId, entityCellSet);
    }

    remove(entityId: EntityId): void {
        const cells = this.entityCells.get(entityId);
        if (!cells) return;

        for (const cellKey of cells) {
            const cell = this.cells.get(cellKey);
            if (cell) {
                cell.delete(entityId);
                if (cell.size === 0) {
                    this.cells.delete(cellKey);
                }
            }
        }

        this.entityCells.delete(entityId);
    }

    query(entityId: EntityId, x: number, y: number, radius: number): Set<EntityId> {
        const result = new Set<EntityId>();
        const cells = this._getCellsForBounds(
            x - radius, y - radius,
            x + radius, y + radius
        );

        for (const cellKey of cells) {
            const cell = this.cells.get(cellKey);
            if (cell) {
                for (const otherId of cell) {
                    if (otherId !== entityId) {
                        result.add(otherId);
                    }
                }
            }
        }

        return result;
    }

    clear(): void {
        this.cells.clear();
        this.entityCells.clear();
    }
}

// ============================================================================
// COLLISION SYSTEM
// ============================================================================

interface CollisionData {
    entityA: EntityId;
    entityB: EntityId;
    normal: { x: number, y: number };
    depth: number;
    isTrigger: boolean;
}

interface CollisionResult {
    colliding: boolean;
    normal?: { x: number, y: number };
    depth?: number;
}

export class CollisionSystem extends System {
    private _spatialGrid: SpatialHashGrid;
    private _previousCollisions: Map<string, CollisionData>;
    private _currentCollisions: Map<string, CollisionData>;
    private _requiredComponents: string[];
    private _stats: {
        broadPhaseChecks: number;
        narrowPhaseChecks: number;
        collisionsDetected: number;
    };

    constructor() {
        super('CollisionSystem', 70);

        this._spatialGrid = new SpatialHashGrid(100);
        this._previousCollisions = new Map();
        this._currentCollisions = new Map();
        this._requiredComponents = ['Transform', 'Collider'];

        this._stats = {
            broadPhaseChecks: 0,
            narrowPhaseChecks: 0,
            collisionsDetected: 0
        };
    }

    init(world: IWorld): void {
        super.init(world);
        console.log('[CollisionSystem] Inizializzato');
    }

    update(deltaTime: number): void {
        this._stats.broadPhaseChecks = 0;
        this._stats.narrowPhaseChecks = 0;
        this._stats.collisionsDetected = 0;

        this._previousCollisions = new Map(this._currentCollisions);
        this._currentCollisions = new Map();

        const entities = this.queryEntities(this._requiredComponents);

        this._spatialGrid.clear();
        this._updateSpatialGrid(entities);

        const processedPairs = new Set<string>();

        for (const entityId of entities) {
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');

            if (!transform || !collider || !collider.enabled) continue;

            collider._isColliding = false;
            collider._collidingWith = [];

            const radius = this._getBoundingRadius(collider);
            const potentialCollisions = this._spatialGrid.query(
                entityId, transform.x, transform.y, radius
            );

            this._stats.broadPhaseChecks += potentialCollisions.size;

            for (const otherId of potentialCollisions) {
                const pairKey = entityId < otherId 
                    ? `${entityId},${otherId}` 
                    : `${otherId},${entityId}`;

                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);

                this._checkCollision(entityId, otherId);
            }
        }

        this._generateExitEvents();
    }

    private _updateSpatialGrid(entities: EntityId[]): void {
        for (const entityId of entities) {
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');

            if (!transform || !collider) continue;

            if (!collider.enabled) {
                this._spatialGrid.remove(entityId);
                continue;
            }

            const radius = this._getBoundingRadius(collider);
            this._spatialGrid.insert(entityId, transform.x, transform.y, radius);
        }
    }

    private _getBoundingRadius(collider: ColliderComponent): number {
        switch (collider.type) {
            case 'circle':
                return collider.radius;
            case 'aabb':
                return Math.sqrt(collider.width ** 2 + collider.height ** 2) / 2;
            case 'polygon':
                if (!collider.vertices) return 10;
                let maxR = 0;
                for (const [x, y] of collider.vertices) {
                    maxR = Math.max(maxR, Math.sqrt(x * x + y * y));
                }
                return maxR;
            default:
                return 10;
        }
    }

    private _checkCollision(entityA: EntityId, entityB: EntityId): void {
        const transformA = this.getComponent<TransformComponent>(entityA, 'Transform');
        const transformB = this.getComponent<TransformComponent>(entityB, 'Transform');
        const colliderA = this.getComponent<ColliderComponent>(entityA, 'Collider');
        const colliderB = this.getComponent<ColliderComponent>(entityB, 'Collider');

        if (!transformA || !transformB || !colliderA || !colliderB) return;
        if (!colliderA.enabled || !colliderB.enabled) return;

        if (colliderA.isStatic && colliderB.isStatic) return;

        if (!this._layersCanCollide(colliderA, colliderB)) return;

        this._stats.narrowPhaseChecks++;

        const collision = this._testCollision(
            transformA, colliderA,
            transformB, colliderB
        );

        if (collision.colliding && collision.normal && collision.depth !== undefined) {
            this._stats.collisionsDetected++;

            colliderA._isColliding = true;
            colliderB._isColliding = true;
            
            if (!colliderA._collidingWith) colliderA._collidingWith = [];
            if (!colliderB._collidingWith) colliderB._collidingWith = [];
            
            colliderA._collidingWith.push(entityB);
            colliderB._collidingWith.push(entityA);
            
            colliderA._lastCollisionNormal = collision.normal;
            colliderB._lastCollisionNormal = { 
                x: -collision.normal.x, 
                y: -collision.normal.y 
            };

            const pairKey = `${Math.min(entityA, entityB)},${Math.max(entityA, entityB)}`;
            this._currentCollisions.set(pairKey, {
                entityA,
                entityB,
                normal: collision.normal,
                depth: collision.depth,
                isTrigger: colliderA.isTrigger || colliderB.isTrigger
            });

            const wasColliding = this._previousCollisions.has(pairKey);
            const isTrigger = colliderA.isTrigger || colliderB.isTrigger;

            if (!wasColliding) {
                const eventType = isTrigger ? 'trigger:enter' : 'collision:enter';
                this.emit(eventType, {
                    entityA,
                    entityB,
                    normal: collision.normal,
                    depth: collision.depth
                });
            } else {
                if (isTrigger) {
                    this.emit('trigger:stay', {
                        entityA,
                        entityB,
                        normal: collision.normal,
                        depth: collision.depth
                    });
                } else {
                    this.emit('collision:stay', {
                        entityA,
                        entityB,
                        normal: collision.normal,
                        depth: collision.depth
                    });
                }
            }
        }
    }

    private _layersCanCollide(colliderA: ColliderComponent, colliderB: ColliderComponent): boolean {
        return (colliderA.layer & colliderB.mask) !== 0 &&
               (colliderB.layer & colliderA.mask) !== 0;
    }

    private _testCollision(transformA: TransformComponent, colliderA: ColliderComponent, transformB: TransformComponent, colliderB: ColliderComponent): CollisionResult {
        const posA = {
            x: transformA.x + (colliderA.offsetX || 0),
            y: transformA.y + (colliderA.offsetY || 0)
        };
        const posB = {
            x: transformB.x + (colliderB.offsetX || 0),
            y: transformB.y + (colliderB.offsetY || 0)
        };

        const typeA = colliderA.type;
        const typeB = colliderB.type;
        
        if (typeA === 'circle' && typeB === 'circle') {
            return this._circleVsCircle(posA, colliderA.radius || 1, posB, colliderB.radius || 1);
        }

        if (typeA === 'aabb' && typeB === 'aabb') {
            return this._aabbVsAabb(
                posA, colliderA.width, colliderA.height,
                posB, colliderB.width, colliderB.height
            );
        }

        if ((typeA === 'circle' && typeB === 'aabb') || 
            (typeA === 'aabb' && typeB === 'circle')) {
            if (typeA === 'aabb') {
                return this._circleVsAabb(posB, colliderB.radius, posA, colliderA.width, colliderA.height);
            }
            return this._circleVsAabb(posA, colliderA.radius, posB, colliderB.width, colliderB.height);
        }

        if ((typeA === 'circle' && typeB === 'polygon') ||
            (typeA === 'polygon' && typeB === 'circle')) {
            if (typeA === 'circle') {
                return this._circleVsPolygon(
                    posA, colliderA.radius,
                    posB, colliderB.vertices, transformB.scale, transformB.rotation
                );
            } else {
                const result = this._circleVsPolygon(
                    posB, colliderB.radius,
                    posA, colliderA.vertices, transformA.scale, transformA.rotation
                );
                if (result.colliding && result.normal) {
                    result.normal.x = -result.normal.x;
                    result.normal.y = -result.normal.y;
                }
                return result;
            }
        }

        return this._circleVsCircle(
            posA, this._getBoundingRadius(colliderA),
            posB, this._getBoundingRadius(colliderB)
        );
    }

    private _circleVsCircle(posA: {x: number, y: number}, radiusA: number, posB: {x: number, y: number}, radiusB: number): CollisionResult {
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = radiusA + radiusB;

        if (distSq >= radiusSum * radiusSum) {
            return { colliding: false };
        }

        const dist = Math.sqrt(distSq);
        const depth = radiusSum - dist;

        let nx = 0, ny = 0;
        if (dist > 0) {
            nx = dx / dist;
            ny = dy / dist;
        } else {
            nx = 1;
            ny = 0;
        }

        return {
            colliding: true,
            normal: { x: nx, y: ny },
            depth: depth
        };
    }

    private _aabbVsAabb(posA: {x: number, y: number}, widthA: number, heightA: number, posB: {x: number, y: number}, widthB: number, heightB: number): CollisionResult {
        const halfWidthA = widthA / 2;
        const halfHeightA = heightA / 2;
        const halfWidthB = widthB / 2;
        const halfHeightB = heightB / 2;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;

        const overlapX = halfWidthA + halfWidthB - Math.abs(dx);
        const overlapY = halfHeightA + halfHeightB - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) {
            return { colliding: false };
        }

        let nx, ny, depth;
        if (overlapX < overlapY) {
            depth = overlapX;
            nx = dx > 0 ? 1 : -1;
            ny = 0;
        } else {
            depth = overlapY;
            nx = 0;
            ny = dy > 0 ? 1 : -1;
        }

        return {
            colliding: true,
            normal: { x: nx, y: ny },
            depth: depth
        };
    }

    private _circleVsAabb(circlePos: {x: number, y: number}, radius: number, aabbPos: {x: number, y: number}, width: number, height: number): CollisionResult {
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        const closestX = Math.max(aabbPos.x - halfWidth, 
                         Math.min(circlePos.x, aabbPos.x + halfWidth));
        const closestY = Math.max(aabbPos.y - halfHeight, 
                         Math.min(circlePos.y, aabbPos.y + halfHeight));

        const dx = circlePos.x - closestX;
        const dy = circlePos.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq >= radius * radius) {
            return { colliding: false };
        }

        const dist = Math.sqrt(distSq);
        const depth = radius - dist;

        let nx = 0, ny = 0;
        if (dist > 0) {
            nx = dx / dist;
            ny = dy / dist;
        } else {
            nx = 1;
            ny = 0;
        }

        return {
            colliding: true,
            normal: { x: nx, y: ny },
            depth: depth
        };
    }

    private _circleVsPolygon(circlePos: {x: number, y: number}, radius: number, polyPos: {x: number, y: number}, vertices: number[][] | null, scale: number = 1, rotation: number = 0): CollisionResult {
        if (!vertices || vertices.length < 3) {
            return { colliding: false };
        }

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const worldVertices = vertices.map(([x, y]) => {
            const sx = x * scale;
            const sy = y * scale;
            return [
                polyPos.x + sx * cos - sy * sin,
                polyPos.y + sx * sin + sy * cos
            ];
        });

        let closestDist = Infinity;
        let closestNormal = { x: 0, y: 0 };

        for (let i = 0; i < worldVertices.length; i++) {
            const v1 = worldVertices[i];
            const v2 = worldVertices[(i + 1) % worldVertices.length];

            const edgeX = v2[0] - v1[0];
            const edgeY = v2[1] - v1[1];
            const edgeLenSq = edgeX * edgeX + edgeY * edgeY;

            if (edgeLenSq === 0) continue;

            const toCircleX = circlePos.x - v1[0];
            const toCircleY = circlePos.y - v1[1];

            let t = (toCircleX * edgeX + toCircleY * edgeY) / edgeLenSq;
            t = Math.max(0, Math.min(1, t));

            const closestOnEdgeX = v1[0] + t * edgeX;
            const closestOnEdgeY = v1[1] + t * edgeY;

            const dx = circlePos.x - closestOnEdgeX;
            const dy = circlePos.y - closestOnEdgeY;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDist) {
                closestDist = distSq;
                
                const dist = Math.sqrt(distSq);
                if (dist > 0) {
                    closestNormal = { x: dx / dist, y: dy / dist };
                } else {
                    const edgeLen = Math.sqrt(edgeLenSq);
                    closestNormal = { x: -edgeY / edgeLen, y: edgeX / edgeLen };
                }
            }
        }

        const dist = Math.sqrt(closestDist);
        const inside = this._pointInPolygon(circlePos.x, circlePos.y, worldVertices);

        if (inside) {
            return {
                colliding: true,
                normal: { x: -closestNormal.x, y: -closestNormal.y },
                depth: radius + dist
            };
        } else if (dist < radius) {
            return {
                colliding: true,
                normal: closestNormal,
                depth: radius - dist
            };
        }

        return { colliding: false };
    }

    private _pointInPolygon(px: number, py: number, vertices: number[][]): boolean {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i][0], yi = vertices[i][1];
            const xj = vertices[j][0], yj = vertices[j][1];
            
            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private _generateExitEvents(): void {
        for (const [pairKey, data] of this._previousCollisions) {
            if (!this._currentCollisions.has(pairKey)) {
                const eventType = data.isTrigger ? 'trigger:exit' : 'collision:exit';
                this.emit(eventType, {
                    entityA: data.entityA,
                    entityB: data.entityB
                });
            }
        }
    }

    getStats(): object {
        return {
            ...super.getStats(),
            ...this._stats,
            activeCollisions: this._currentCollisions.size
        };
    }

    destroy(): void {
        this._spatialGrid.clear();
        this._previousCollisions.clear();
        this._currentCollisions.clear();
        super.destroy();
    }
}

export default CollisionSystem;
