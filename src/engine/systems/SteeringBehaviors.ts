/**
 * =============================================================================
 * STEERING-BEHAVIORS.TS - Sistema di navigazione e avoidance
 * =============================================================================
 * Include: Arrival, Pursuit, Obstacle Avoidance con raycasts
 */

import { EntityId, IWorld } from '../ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { VelocityComponent } from '../../game/components/Velocity';
import { ColliderComponent } from '../../game/components/Collider';

export interface SteeringOutput {
    linear: { x: number; y: number };
    angular: number;
}

export interface RaycastHit {
    entityId: EntityId;
    distance: number;
    point: { x: number; y: number };
    normal: { x: number; y: number };
}

export interface RaycastResult {
    hit: boolean;
    hitInfo: RaycastHit | null;
}

export class SteeringBehaviors {
    private world: IWorld;
    private rayAngleSpread: number;
    private rayCount: number;
    private rayLength: number;

    constructor(world: IWorld, options: {
        rayAngleSpread?: number;
        rayCount?: number;
        rayLength?: number;
    } = {}) {
        this.world = world;
        this.rayAngleSpread = options.rayAngleSpread ?? Math.PI / 3;
        this.rayCount = options.rayCount ?? 7;
        this.rayLength = options.rayLength ?? 300;
    }

    arrive(
        transform: TransformComponent,
        velocity: VelocityComponent,
        targetPos: { x: number; y: number },
        maxSpeed: number,
        maxForce: number,
        slowingRadius: number = 100
    ): SteeringOutput {
        const desiredX = targetPos.x - transform.x;
        const desiredY = targetPos.y - transform.y;
        const desiredDist = Math.sqrt(desiredX * desiredX + desiredY * desiredY);

        let speed = maxSpeed;
        if (desiredDist < slowingRadius) {
            speed = maxSpeed * (desiredDist / slowingRadius);
        }

        if (desiredDist < 10) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        const desiredVx = (desiredX / desiredDist) * speed;
        const desiredVy = (desiredY / desiredDist) * speed;

        const steerX = desiredVx - velocity.vx;
        const steerY = desiredVy - velocity.vy;

        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxForce) {
            const scale = maxForce / steerMag;
            return { linear: { x: steerX * scale, y: steerY * scale }, angular: 0 };
        }

        return { linear: { x: steerX, y: steerY }, angular: 0 };
    }

    pursuit(
        transform: TransformComponent,
        velocity: VelocityComponent,
        targetTransform: TransformComponent,
        targetVelocity: VelocityComponent,
        maxSpeed: number,
        maxForce: number
    ): SteeringOutput {
        const toTargetX = targetTransform.x - transform.x;
        const toTargetY = targetTransform.y - transform.y;
        const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

        if (distance < 10) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        const predictedTime = distance / maxSpeed;
        const predictedX = targetTransform.x + targetVelocity.vx * predictedTime;
        const predictedY = targetTransform.y + targetVelocity.vy * predictedTime;

        return this.arrive(transform, velocity, { x: predictedX, y: predictedY }, maxSpeed, maxForce, 100);
    }

    evade(
        transform: TransformComponent,
        velocity: VelocityComponent,
        threatTransform: TransformComponent,
        threatVelocity: VelocityComponent,
        maxSpeed: number,
        maxForce: number
    ): SteeringOutput {
        const toThreatX = threatTransform.x - transform.x;
        const toThreatY = threatTransform.y - transform.y;
        const distance = Math.sqrt(toThreatX * toThreatX + toThreatY * toThreatY);

        const predictedTime = distance / maxSpeed;
        const predictedX = threatTransform.x + threatVelocity.vx * predictedTime;
        const predictedY = threatTransform.y + threatVelocity.vy * predictedTime;

        const fleeX = transform.x - predictedX;
        const fleeY = transform.y - predictedY;
        const fleeDist = Math.sqrt(fleeX * fleeX + fleeY * fleeY);

        if (fleeDist < 10) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        const desiredVx = (fleeX / fleeDist) * maxSpeed;
        const desiredVy = (fleeY / fleeDist) * maxSpeed;

        const steerX = desiredVx - velocity.vx;
        const steerY = desiredVy - velocity.vy;

        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxForce) {
            const scale = maxForce / steerMag;
            return { linear: { x: steerX * scale, y: steerY * scale }, angular: 0 };
        }

        return { linear: { x: steerX, y: steerY }, angular: 0 };
    }

    obstacleAvoidance(
        transform: TransformComponent,
        velocity: VelocityComponent,
        obstacles: Array<{ entityId: EntityId; distance: number; angle: number }>,
        maxForce: number = 800
    ): SteeringOutput {
        if (obstacles.length === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        let steeringX = 0;
        let steeringY = 0;
        let avoidanceCount = 0;

        for (const obstacle of obstacles) {
            if (obstacle.distance < 200) {
                const avoidanceStrength = Math.pow(1 - (obstacle.distance / 200), 2);
                const avoidanceAngle = obstacle.angle + Math.PI / 2;

                steeringX += Math.cos(avoidanceAngle) * avoidanceStrength * 2;
                steeringY += Math.sin(avoidanceAngle) * avoidanceStrength * 2;
                avoidanceCount++;
            }
        }

        if (avoidanceCount === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        steeringX /= avoidanceCount;
        steeringY /= avoidanceCount;

        const steerMag = Math.sqrt(steeringX * steeringX + steeringY * steeringY);
        if (steerMag > maxForce) {
            const scale = maxForce / steerMag;
            steeringX *= scale;
            steeringY *= scale;
        }

        return { linear: { x: steeringX, y: steeringY }, angular: 0 };
    }

    castRays(
        transform: TransformComponent,
        collider: ColliderComponent | null,
        entityFilter: (entityId: EntityId) => boolean
    ): Array<{ entityId: EntityId; distance: number; angle: number }> {
        const results: Array<{ entityId: EntityId; distance: number; angle: number }> = [];
        const shipRadius = collider?.radius ?? 20;

        const startAngle = transform.rotation - this.rayAngleSpread / 2;
        const angleStep = this.rayAngleSpread / (this.rayCount - 1);

        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = startAngle + angleStep * i;
            const rayDirX = Math.cos(rayAngle);
            const rayDirY = Math.sin(rayAngle);

            const result = this.raycastSingle(
                transform.x,
                transform.y,
                rayDirX,
                rayDirY,
                shipRadius,
                entityFilter
            );

            if (result.hit) {
                const relAngle = rayAngle - transform.rotation;
                results.push({
                    entityId: result.hitInfo!.entityId,
                    distance: result.hitInfo!.distance,
                    angle: relAngle
                });
            }
        }

        return results;
    }

    private raycastSingle(
        startX: number,
        startY: number,
        dirX: number,
        dirY: number,
        shipRadius: number,
        entityFilter: (entityId: EntityId) => boolean
    ): RaycastResult {
        const maxDist = this.rayLength + shipRadius;
        let closestDist = maxDist;
        let closestEntity: EntityId | null = null;

        const colliderEntities = (this.world as any).queryEntities(['Collider']) as EntityId[];
        const playerEntities = (this.world as any).getEntitiesByTag('player') as EntityId[];

        for (const entityId of colliderEntities) {
            if (entityFilter && !entityFilter(entityId)) continue;
            if (playerEntities.includes(entityId)) continue;

            const eTransform = this.world.getComponent<TransformComponent>(entityId, 'Transform');
            const eCollider = this.world.getComponent<ColliderComponent>(entityId, 'Collider');

            if (!eTransform || !eCollider) continue;

            const toEntityX = eTransform.x - startX;
            const toEntityY = eTransform.y - startY;
            const distToCenter = Math.sqrt(toEntityX * toEntityX + toEntityY * toEntityY);

            const effectiveRadius = eCollider.radius + shipRadius;

            if (distToCenter < effectiveRadius) {
                const hitDist = distToCenter - effectiveRadius + shipRadius;
                if (hitDist < closestDist) {
                    closestDist = hitDist;
                    closestEntity = entityId;
                }
            } else {
                const dot = (toEntityX * dirX + toEntityY * dirY) / distToCenter;
                if (dot > 0) {
                    const closestX = startX + dirX * distToCenter * dot;
                    const closestY = startY + dirY * distToCenter * dot;
                    const offsetX = closestX - eTransform.x;
                    const offsetY = closestY - eTransform.y;
                    const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

                    if (offsetDist < effectiveRadius) {
                        const hitDist = distToCenter * dot - Math.sqrt(
                            effectiveRadius * effectiveRadius - offsetDist * offsetDist
                        );

                        if (hitDist < closestDist && hitDist > 0) {
                            closestDist = hitDist;
                            closestEntity = entityId;
                        }
                    }
                }
            }
        }

        if (closestEntity !== null) {
            const hitX = startX + dirX * closestDist;
            const hitY = startY + dirY * closestDist;
            const normalX = hitX - startX;
            const normalY = hitY - startY;
            const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);

            return {
                hit: true,
                hitInfo: {
                    entityId: closestEntity,
                    distance: closestDist,
                    point: { x: hitX, y: hitY },
                    normal: { x: normalX / normalLen, y: normalY / normalLen }
                }
            };
        }

        return { hit: false, hitInfo: null };
    }

    separate(
        transform: TransformComponent,
        velocity: VelocityComponent,
        neighbors: Array<{ x: number; y: number; radius: number }>,
        maxSpeed: number,
        maxForce: number,
        separationRadius: number = 100
    ): SteeringOutput {
        if (neighbors.length === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        let steerX = 0;
        let steerY = 0;
        let count = 0;

        for (const neighbor of neighbors) {
            const dx = transform.x - neighbor.x;
            const dy = transform.y - neighbor.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0 && dist < separationRadius + neighbor.radius) {
                const diffX = dx / (dist * dist);
                const diffY = dy / (dist * dist);
                steerX += diffX;
                steerY += diffY;
                count++;
            }
        }

        if (count === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        steerX /= count;
        steerY /= count;

        const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
        if (steerMag > maxForce) {
            const scale = maxForce / steerMag;
            steerX *= scale;
            steerY *= scale;
        }

        return { linear: { x: steerX, y: steerY }, angular: 0 };
    }

    align(
        transform: TransformComponent,
        neighbors: Array<{ rotation: number }>,
        maxForce: number = 100
    ): SteeringOutput {
        if (neighbors.length === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        let avgAngle = 0;
        let count = 0;

        for (const neighbor of neighbors) {
            let diff = neighbor.rotation - transform.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            avgAngle += diff;
            count++;
        }

        if (count === 0) {
            return { linear: { x: 0, y: 0 }, angular: 0 };
        }

        avgAngle /= count;

        let angularSteer = avgAngle * 5;
        if (angularSteer > maxForce) angularSteer = maxForce;
        if (angularSteer < -maxForce) angularSteer = -maxForce;

        return { linear: { x: 0, y: 0 }, angular: angularSteer };
    }

    wander(
        transform: TransformComponent,
        velocity: VelocityComponent,
        maxSpeed: number,
        maxForce: number,
        wanderRadius: number = 30,
        wanderDistance: number = 50
    ): SteeringOutput {
        const wanderAngle = (Math.random() - 0.5) * 2;

        const circleCenterX = velocity.vx * (wanderDistance / maxSpeed);
        const circleCenterY = velocity.vy * (wanderDistance / maxSpeed);

        const displacementX = Math.cos(wanderAngle) * wanderRadius;
        const displacementY = Math.sin(wanderAngle) * wanderRadius;

        const targetX = circleCenterX + displacementX;
        const targetY = circleCenterY + displacementY;

        const steerMag = Math.sqrt(targetX * targetX + targetY * targetY);
        if (steerMag > maxForce) {
            const scale = maxForce / steerMag;
            return { linear: { x: targetX * scale, y: targetY * scale }, angular: 0 };
        }

        return { linear: { x: targetX, y: targetY }, angular: 0 };
    }

    flock(
        transform: TransformComponent,
        velocity: VelocityComponent,
        neighbors: Array<{ x: number; y: number; rotation: number; radius: number }>,
        maxSpeed: number,
        maxForce: number,
        weights: { separation: number; alignment: number; cohesion: number } = {
            separation: 1.5,
            alignment: 1.0,
            cohesion: 1.0
        }
    ): SteeringOutput {
        const separation = this.separate(transform, velocity, neighbors, maxSpeed, maxForce);
        const alignment = this.align(transform, neighbors, maxForce);

        let cohesionX = 0;
        let cohesionY = 0;
        let count = 0;

        for (const neighbor of neighbors) {
            cohesionX += neighbor.x;
            cohesionY += neighbor.y;
            count++;
        }

        let cohesion: SteeringOutput = { linear: { x: 0, y: 0 }, angular: 0 };
        if (count > 0) {
            cohesionX /= count;
            cohesionY /= count;
            cohesion = this.arrive(transform, velocity, { x: cohesionX, y: cohesionY }, maxSpeed, maxForce, 50);
        }

        return {
            linear: {
                x: separation.linear.x * weights.separation +
                    cohesion.linear.x * weights.cohesion,
                y: separation.linear.y * weights.separation +
                    cohesion.linear.y * weights.cohesion
            },
            angular: alignment.angular * weights.alignment
        };
    }
}

export default SteeringBehaviors;
