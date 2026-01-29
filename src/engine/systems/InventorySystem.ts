/**
 * =============================================================================
 * INVENTORY-SYSTEM.TS - Gestione loot, cargo e raccolta
 * =============================================================================
 */

import System from '../ecs/System';
import { IWorld, EntityId } from '../ecs/types';
import { TransformComponent, createTransform } from '../../game/components/Transform';
import { VelocityComponent, createVelocity } from '../../game/components/Velocity';
import { RenderableComponent, createRenderable } from '../../game/components/Renderable';
import { ColliderComponent, createCollider, CollisionLayer } from '../../game/components/Collider';
import { PhysicsComponent, createPhysics } from '../../game/components/Physics';
import { HealthComponent } from '../../game/components/Health';
import { CargoComponent, CargoItem } from '../../game/components/Cargo';
import { PickupComponent, createPickup, RESOURCES, ResourceType } from '../../game/components/Pickup';
import { createLifetime } from '../../game/components/Lifetime';

export class InventorySystem extends System {
    constructor() {
        super('InventorySystem', 65); // Dopo Physics, prima di Collision (o parallelo)
    }

    init(world: IWorld): void {
        super.init(world);
        
        // Ascolta distruzione entità per drop loot
        this.on('combat:destroyed', (data: any) => this._handleEntityDestroyed(data));
        
        // Ascolta collisioni per raccolta (pickup vs nave)
        this.on('collision:enter', (data: any) => this._handleCollision(data));
        this.on('trigger:enter', (data: any) => this._handleCollision(data));

        console.log('[InventorySystem] Inizializzato');
    }

    update(deltaTime: number): void {
        // Magnetismo: attira pickup verso navi vicine
        this._updateMagnets(deltaTime);
    }

    private _updateMagnets(deltaTime: number): void {
        const pickups = this.queryEntities(['Pickup', 'Transform', 'Velocity']);
        const collectors = this.queryEntities(['Cargo', 'Transform']); // Solo navi con cargo

        for (const pickupId of pickups) {
            const pickup = this.getComponent<PickupComponent>(pickupId, 'Pickup');
            const pTransform = this.getComponent<TransformComponent>(pickupId, 'Transform');
            const pVelocity = this.getComponent<VelocityComponent>(pickupId, 'Velocity');

            if (!pickup || !pTransform || !pVelocity) continue;

            // Se è già raccolto o in fase di raccolta animata
            if (pickup.isBeingCollected && pickup.collectorId) {
                this._moveToCollector(pickupId, pickup.collectorId, pTransform, pVelocity, deltaTime);
                continue;
            }

            // Cerca collector vicino
            let closestDistSq = pickup.magnetRange * pickup.magnetRange;
            let targetId: EntityId | null = null;

            for (const collectorId of collectors) {
                const cTransform = this.getComponent<TransformComponent>(collectorId, 'Transform');
                if (!cTransform) continue;

                const dx = cTransform.x - pTransform.x;
                const dy = cTransform.y - pTransform.y;
                const distSq = dx*dx + dy*dy;

                if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    targetId = collectorId;
                }
            }

            if (targetId) {
                pickup.isBeingCollected = true;
                pickup.collectorId = targetId;
            }
        }
    }

    private _moveToCollector(pickupId: EntityId, collectorId: EntityId, pTransform: TransformComponent, pVelocity: VelocityComponent, deltaTime: number): void {
        const cTransform = this.getComponent<TransformComponent>(collectorId, 'Transform');
        
        // Se il collector non esiste più, rilascia
        if (!cTransform) {
            const pickup = this.getComponent<PickupComponent>(pickupId, 'Pickup');
            if (pickup) {
                pickup.isBeingCollected = false;
                pickup.collectorId = null;
            }
            return;
        }

        // Accelera verso il collector
        const dx = cTransform.x - pTransform.x;
        const dy = cTransform.y - pTransform.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Se molto vicino, la collisione fisica o logica lo raccoglierà.
        // Qui applichiamo solo forza magnetica.
        if (dist > 10) {
            const speed = 400; // Velocità attrazione
            const ax = (dx / dist) * speed;
            const ay = (dy / dist) * speed;

            // Sovrascrivi velocità fisica o aggiungi forza?
            // Sovrascriviamo per effetto "tractor beam" fluido
            // Lerp velocità attuale verso target
            pVelocity.vx += (ax - pVelocity.vx) * 5 * deltaTime;
            pVelocity.vy += (ay - pVelocity.vy) * 5 * deltaTime;
        }
    }

    private _handleCollision(data: any): void {
        const { entityA, entityB } = data;

        // Verifica se uno è pickup e l'altro ha cargo
        let pickupId = entityA;
        let collectorId = entityB;

        let pickup = this.getComponent<PickupComponent>(pickupId, 'Pickup');
        let cargo = this.getComponent<CargoComponent>(collectorId, 'Cargo');

        if (!pickup || !cargo) {
            // Prova a scambiare
            pickupId = entityB;
            collectorId = entityA;
            pickup = this.getComponent<PickupComponent>(pickupId, 'Pickup');
            cargo = this.getComponent<CargoComponent>(collectorId, 'Cargo');
        }

        if (pickup && cargo) {
            this._collectItem(collectorId, pickupId, pickup, cargo);
        }
    }

    private _collectItem(collectorId: EntityId, pickupId: EntityId, pickup: PickupComponent, cargo: CargoComponent): void {
        // Aggiungi a inventario usando sistema slot-based
        const resource = RESOURCES[pickup.resourceId];
        if (!resource) return;

        const slotCapacity = cargo.slotCapacity ?? 50;
        let remainingToAdd = pickup.quantity;

        // Trova slot esistente per questo tipo di risorsa che non è pieno
        const existingSlot = cargo.items.find(i => i.id === pickup.resourceId && i.quantity < slotCapacity);

        if (existingSlot) {
            // Aggiungi allo slot esistente
            const spaceInSlot = slotCapacity - existingSlot.quantity;
            const toAdd = Math.min(remainingToAdd, spaceInSlot);
            existingSlot.quantity += toAdd;
            remainingToAdd -= toAdd;
            cargo.currentVolume += toAdd;
        }

        // Se c'è ancora qualcosa da aggiungere e abbiamo slot liberi, crea nuovi slot
        while (remainingToAdd > 0 && cargo.items.length < cargo.maxItems) {
            const toAdd = Math.min(remainingToAdd, slotCapacity);
            cargo.items.push({
                id: pickup.resourceId,
                name: resource.name,
                quantity: toAdd,
                value: resource.value,
                maxQuantity: slotCapacity
            });
            remainingToAdd -= toAdd;
            cargo.currentVolume += toAdd;
        }

        // Se ancora qualcosa da aggiungere ma nessuno slot disponibile, perde il resto
        if (remainingToAdd > 0) {
            console.log(`[InventorySystem] Cargo full! Lost ${remainingToAdd} ${pickup.resourceId}`);
        }

        this.emit('inventory:collected', {
            collectorId,
            resourceId: pickup.resourceId,
            quantity: pickup.quantity - remainingToAdd
        });

        // Distruggi pickup
        this.world!.destroyEntity(pickupId);
    }

    private _handleEntityDestroyed(data: any): void {
        const { entityId } = data;

        const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
        if (!transform) return;

        const health = this.getComponent<HealthComponent>(entityId, 'Health');
        const maxHealth = health?.maxHealth || 100;
        const dropChance = 0.6 + (maxHealth / 500);

        if (Math.random() > dropChance) return;

        // Weighted random for resource type: Scrap 50%, Iron 30%, Gold 15%, Crystal 5%
        const roll = Math.random();
        let resourceId: string;
        if (roll < 0.50) {
            resourceId = ResourceType.SCRAP;
        } else if (roll < 0.80) {
            resourceId = ResourceType.IRON;
        } else if (roll < 0.95) {
            resourceId = ResourceType.GOLD;
        } else {
            resourceId = ResourceType.CRYSTAL;
        }

        // Random quantity 1-10, higher quantities are harder
        // Uses exponential distribution for rarity
        const baseRoll = Math.random();
        let quantity: number;
        if (baseRoll < 0.35) {
            quantity = 1; // 35% chance
        } else if (baseRoll < 0.60) {
            quantity = 2; // 25% chance
        } else if (baseRoll < 0.77) {
            quantity = 3; // 17% chance
        } else if (baseRoll < 0.88) {
            quantity = 4; // 11% chance
        } else if (baseRoll < 0.95) {
            quantity = 5; // 7% chance
        } else if (baseRoll < 0.98) {
            quantity = 6; // 3% chance
        } else if (baseRoll < 0.995) {
            quantity = 8; // 1.5% chance
        } else {
            quantity = 10; // 0.5% chance
        }

        // Crystals are always quantity 1 (most rare)
        if (resourceId === ResourceType.CRYSTAL) {
            quantity = 1;
        }
        // Gold rarely drops in high quantities
        else if (resourceId === ResourceType.GOLD && quantity > 3) {
            quantity = Math.floor(quantity / 2);
            if (quantity < 1) quantity = 1;
        }

        this._spawnPickup(transform.x, transform.y, resourceId, quantity);
    }

    private _spawnPickup(x: number, y: number, resourceId: string, quantity: number): void {
        const id = this.world!.createEntity('pickup');
        const resource = RESOURCES[resourceId];

        // Visual properties based on rarity and quantity
        let baseRadius: number;
        let baseGlow: number;
        let baseStroke: number;

        switch (resourceId) {
            case ResourceType.SCRAP:
                // Small, dim, barely visible
                baseRadius = 4;
                baseGlow = 5;
                baseStroke = 1;
                break;
            case ResourceType.IRON:
                // Medium, moderate glow
                baseRadius = 5;
                baseGlow = 12;
                baseStroke = 1.5;
                break;
            case ResourceType.GOLD:
                // Larger, bright glow
                baseRadius = 6;
                baseGlow = 25;
                baseStroke = 2;
                break;
            case ResourceType.CRYSTAL:
                // Largest, very bright, pulsing
                baseRadius = 8;
                baseGlow = 40;
                baseStroke = 3;
                break;
            default:
                baseRadius = 5;
                baseGlow = 15;
                baseStroke = 1.5;
        }

        // Scale radius and glow based on quantity
        const quantityScale = 1 + (Math.log10(quantity) * 0.15);
        const radius = baseRadius * quantityScale;
        const glowIntensity = Math.min(baseGlow * quantityScale, 60);
        const strokeWidth = baseStroke * Math.min(quantityScale, 1.5);

        this.world!.addComponent(id, 'Transform', createTransform({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            rotation: Math.random() * Math.PI * 2,
            scale: 0.8 * quantityScale
        }));

        this.world!.addComponent(id, 'Velocity', createVelocity({
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            drag: 0.5
        }));

        // Add pulsing animation for rare items
        const glowEnabled = resourceId !== ResourceType.SCRAP;
        const glowColor = resource.color;

        this.world!.addComponent(id, 'Renderable', createRenderable({
            type: 'circle',
            radius: radius,
            fillColor: resource.color,
            strokeColor: '#ffffff',
            strokeWidth: strokeWidth,
            glowEnabled: glowEnabled,
            glowColor: glowColor,
            glowIntensity: glowIntensity,
            layer: 5
        }));

        this.world!.addComponent(id, 'Collider', createCollider({
            type: 'circle',
            radius: radius + 4,
            layer: CollisionLayer.PICKUP,
            mask: CollisionLayer.PLAYER | CollisionLayer.ENEMY,
            isTrigger: true
        }));

        this.world!.addComponent(id, 'Pickup', createPickup({
            resourceId,
            quantity
        }));

        this.world!.addComponent(id, 'Lifetime', createLifetime({
            totalLife: 60,
            fade: true,
            shrink: true
        }));
    }
}

export default InventorySystem;
