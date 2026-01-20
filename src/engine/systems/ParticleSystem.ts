/**
 * =============================================================================
 * PARTICLE-SYSTEM.TS - Sistema per effetti particellari
 * =============================================================================
 */

import System from '../ecs/System';
import { IWorld, EntityId } from '../ecs/types';
import { createTransform, TransformComponent } from '../../game/components/Transform';
import { createVelocity, VelocityComponent } from '../../game/components/Velocity';
import { createRenderable, RenderableComponent } from '../../game/components/Renderable';
import { createLifetime, LifetimeComponent } from '../../game/components/Lifetime';
import { ShipEngineComponent } from '../../game/components/ShipEngine';

export class ParticleSystem extends System {
    constructor() {
        super('ParticleSystem', 90);
    }

    init(world: IWorld): void {
        super.init(world);
        
        this.on('combat:hit', (data: any) => this._spawnHitSparks(data));
        this.on('physics:collision', (data: any) => this._spawnCollisionDust(data));
        this.on('combat:explosion', (data: any) => this._spawnExplosion(data));
        
        console.log('[ParticleSystem] Inizializzato');
    }

    update(deltaTime: number): void {
        // 1. Gestione vita particelle
        const entities = this.queryEntities(['Lifetime']);
        
        for (const entityId of entities) {
            const lifetime = this.getComponent<LifetimeComponent>(entityId, 'Lifetime');
            if (!lifetime) continue;

            lifetime.remainingLife -= deltaTime;

            if (lifetime.remainingLife <= 0) {
                this.world!.destroyEntity(entityId);
                continue;
            }

            // Effetti visivi basati su vita
            const progress = lifetime.remainingLife / lifetime.totalLife;
            
            if (lifetime.fade) {
                const renderable = this.getComponent<RenderableComponent>(entityId, 'Renderable');
                if (renderable) {
                    renderable.alpha = progress;
                }
            }

            if (lifetime.shrink) {
                const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
                if (transform) {
                    transform.scale = progress;
                }
            }
        }

        // 2. Scia motori (Player)
        // Nota: Idealmente dovremmo iterare su tutti gli Engine attivi, non solo player
        // Per ora facciamo solo player per semplicità/performance o query 'ShipEngine'
        this._updateEngineTrails();
    }

    private _updateEngineTrails(): void {
        const ships = this.queryEntities(['ShipEngine', 'Transform', 'Velocity']);
        
        for (const entityId of ships) {
            const engine = this.getComponent<ShipEngineComponent>(entityId, 'ShipEngine');
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const velocity = this.getComponent<VelocityComponent>(entityId, 'Velocity');

            if (!engine || !transform || !velocity) continue;

            // Se c'è thrust (o velocità significativa per inerzia, ma meglio thrust)
            // Possiamo usare l'input o lo stato dell'engine se lo avesse.
            // ShipEngine non ha 'isThrusting'.
            // Usiamo la velocità come proxy o l'accelerazione se disponibile.
            // Ma aspetta, il movimento è gestito da input.
            
            // Hack: Se la velocità è alta, emetti particelle.
            // Oppure meglio: InputSystem setta 'currentThrust' su engine? No.
            
            // Per ora usiamo speed > 10
            const speed = Math.sqrt(velocity.vx**2 + velocity.vy**2);
            if (speed > 10 && Math.random() < 0.3) { // Non ogni frame
                this._spawnEngineParticle(transform, velocity);
            }
        }
    }

    private _spawnEngineParticle(transform: TransformComponent, parentVel: VelocityComponent): void {
        const id = this.world!.createEntity();
        
        // Offset posteriore (dipende dalla rotazione)
        const offset = -15; // Dietro
        const angle = transform.rotation + (Math.random() - 0.5) * 0.5;
        const x = transform.x + Math.cos(transform.rotation) * offset;
        const y = transform.y + Math.sin(transform.rotation) * offset;

        this.world!.addComponent(id, 'Transform', createTransform({
            x, y,
            rotation: Math.random() * Math.PI * 2,
            scale: 0.5 + Math.random() * 0.5
        }));

        this.world!.addComponent(id, 'Velocity', createVelocity({
            vx: parentVel.vx * 0.5 + (Math.random() - 0.5) * 20, // Inerzia parziale
            vy: parentVel.vy * 0.5 + (Math.random() - 0.5) * 20,
            drag: 2.0
        }));

        this.world!.addComponent(id, 'Renderable', createRenderable({
            type: 'circle',
            radius: 2 + Math.random() * 3,
            fillColor: '#3498db', // Blu motore
            alpha: 0.8,
            glowEnabled: true,
            glowColor: '#3498db',
            glowIntensity: 5,
            layer: -1 // Sotto la nave
        }));

        this.world!.addComponent(id, 'Lifetime', createLifetime({
            totalLife: 0.5,
            fade: true,
            shrink: true
        }));
    }

    private _spawnHitSparks(data: any): void {
        // data ha projectileId (opzionale) o collision point?
        // CombatSystem emette combat:hit con projectileId, targetId
        // Non abbiamo il punto esatto di impatto nell'evento hit facile.
        // Ma PhysicsSystem emette physics:collision con entityA, entityB.
        // Usiamo physics:collision per scintille da impatto fisico.
        // Per proiettili, CombatSystem crea già 'hit_effect' statico.
        
        // Miglioriamo hit_effect in CombatSystem o qui?
        // CombatSystem crea un 'hit_effect' che è un cerchio statico.
        // Qui facciamo scintille che volano via.
        
        // Non ho coordinate precise in combat:hit.
        // Quindi userò la posizione del target per ora.
        if (!data.targetId) return;
        
        const transform = this.getComponent<TransformComponent>(data.targetId, 'Transform');
        if (!transform) return;

        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            this._createSpark(transform.x, transform.y, '#ffff00');
        }
    }

    private _spawnCollisionDust(data: any): void {
        const { entityA, impactForce } = data;
        if (impactForce < 20) return; // Solo impatti forti

        const transform = this.getComponent<TransformComponent>(entityA, 'Transform');
        if (!transform) return;

        const count = Math.min(10, Math.floor(impactForce / 10));
        for (let i = 0; i < count; i++) {
            this._createSpark(transform.x, transform.y, '#aaaaaa', 2.0); // Grigio polvere
        }
    }

    private _spawnExplosion(data: any): void {
        const { x, y, radius } = data;
        
        const count = 10 + Math.floor(radius / 5);
        for (let i = 0; i < count; i++) {
            this._createSpark(x, y, '#ffaa00', 1.5); // Arancio esplosione
        }
    }

    private _createSpark(x: number, y: number, color: string, speedMult: number = 1.0): void {
        const id = this.world!.createEntity();
        
        const angle = Math.random() * Math.PI * 2;
        const speed = (50 + Math.random() * 100) * speedMult;
        
        // Offset random
        const ox = (Math.random() - 0.5) * 10;
        const oy = (Math.random() - 0.5) * 10;

        this.world!.addComponent(id, 'Transform', createTransform({
            x: x + ox,
            y: y + oy,
            rotation: angle,
            scale: 1
        }));

        this.world!.addComponent(id, 'Velocity', createVelocity({
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            drag: 3.0
        }));

        this.world!.addComponent(id, 'Renderable', createRenderable({
            type: 'rect', // Scintille quadrate o linee
            width: 3,
            height: 3,
            fillColor: color,
            glowEnabled: true,
            glowColor: color,
            glowIntensity: 10,
            layer: 20
        }));

        this.world!.addComponent(id, 'Lifetime', createLifetime({
            totalLife: 0.3 + Math.random() * 0.3,
            fade: true,
            shrink: true
        }));
    }
}

export default ParticleSystem;
