/**
 * =============================================================================
 * RENDER-SYSTEM.TS - Sistema per il rendering su Canvas
 * =============================================================================
 */

import System from '../engine/ecs/System';
import { IWorld, EntityId } from '../engine/ecs/types';
import { TransformComponent } from '../../game/components/Transform';
import { RenderableComponent } from '../../game/components/Renderable';
import { ColliderComponent } from '../../game/components/Collider';
import { HealthComponent } from '../../game/components/Health';

interface RenderItem {
    entityId: EntityId;
    transform: TransformComponent;
    renderable: RenderableComponent;
    layer: number;
}

interface Star {
    x: number;
    y: number;
    z: number; // Fattore parallasse (0.1 - 0.5)
    size: number;
    alpha: number;
}

export class RenderSystem extends System {
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _camera: { x: number; y: number; zoom: number; rotation: number };
    private _backgroundColor: string;
    private _debugMode: boolean;
    private _renderQueue: RenderItem[];
    private _requiredComponents: string[];
    private _stars: Star[];
    private _rotationTime: number;

    constructor(canvas: HTMLCanvasElement) {
        super('RenderSystem', 0);

        this._canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas 2D context not available');
        }
        this._ctx = ctx;

        this._camera = {
            x: 0,
            y: 0,
            zoom: 1,
            rotation: 0
        };

        this._backgroundColor = '#0a0a0f';
        this._debugMode = false;
        this._renderQueue = [];
        this._requiredComponents = ['Transform', 'Renderable'];
        this._stars = [];
        this._rotationTime = 0;

        this._initStarfield();

        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
        this._handleResize();
    }

    private _initStarfield(): void {
        const starCount = 200;
        // Area virtuale grande per evitare pattern ripetitivi troppo evidenti
        const width = 2000; 
        const height = 2000;

        for (let i = 0; i < starCount; i++) {
            this._stars.push({
                x: (Math.random() - 0.5) * width,
                y: (Math.random() - 0.5) * height,
                z: 0.1 + Math.random() * 0.4, // Profondità: più basso = più lontano/lento
                size: 0.5 + Math.random() * 1.5,
                alpha: 0.3 + Math.random() * 0.7
            });
        }
    }

    init(world: IWorld): void {
        super.init(world);

        this.on('camera:move', (data: any) => {
            this._camera.x = data.x ?? this._camera.x;
            this._camera.y = data.y ?? this._camera.y;
        });

        this.on('camera:zoom', (data: any) => {
            this._camera.zoom = Math.max(0.1, Math.min(5, data.zoom));
        });

        console.log('[RenderSystem] Inizializzato');
    }

    render(interpolation: number): void {
        const ctx = this._ctx;
        const canvas = this._canvas;

        this._rotationTime += interpolation * 0.001;

        ctx.fillStyle = this._backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // STEP 0: Disegna campo stellare (sfondo)
        this._renderStarfield(ctx, canvas.width, canvas.height);

        ctx.save();
        this._applyCameraTransform(ctx);

        this._buildRenderQueue();

        for (const item of this._renderQueue) {
            this._renderEntity(item.entityId, item.transform, item.renderable, interpolation);
        }

        if (this._debugMode) {
            this._renderDebugInfo();
        }

        ctx.restore();
    }

    private _renderStarfield(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const cx = width / 2;
        const cy = height / 2;

        ctx.fillStyle = '#ffffff';

        for (const star of this._stars) {
            // Calcola posizione con parallasse
            // La stella si muove in direzione opposta alla camera, scalata da Z
            let x = (star.x - this._camera.x * star.z);
            let y = (star.y - this._camera.y * star.z);

            // Wrap around (modulo)
            // Aggiungiamo un offset grande per gestire coordinate negative
            const wrapW = width * 1.5; // Area di wrap più larga dello schermo
            const wrapH = height * 1.5;
            
            x = ((x % wrapW) + wrapW) % wrapW - (wrapW - width) / 2;
            y = ((y % wrapH) + wrapH) % wrapH - (wrapH - height) / 2;

            // Disegna solo se nello schermo
            if (x >= -2 && x <= width + 2 && y >= -2 && y <= height + 2) {
                ctx.globalAlpha = star.alpha;
                ctx.beginPath();
                ctx.arc(x, y, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.globalAlpha = 1.0;
    }

    private _applyCameraTransform(ctx: CanvasRenderingContext2D): void {
        const canvas = this._canvas;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this._camera.zoom, this._camera.zoom);

        if (this._camera.rotation !== 0) {
            ctx.rotate(-this._camera.rotation);
        }

        ctx.translate(-this._camera.x, -this._camera.y);
    }

    private _buildRenderQueue(): void {
        this._renderQueue = [];

        const entities = this.queryEntities(this._requiredComponents);

        for (const entityId of entities) {
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const renderable = this.getComponent<RenderableComponent>(entityId, 'Renderable');

            if (!transform || !renderable) {
                continue;
            }
            
            if (renderable.visible === false) {
                continue;
            }

            this._renderQueue.push({
                entityId,
                transform,
                renderable,
                layer: renderable.layer ?? 0
            });
        }

        this._renderQueue.sort((a, b) => a.layer - b.layer);
    }

    private _renderEntity(entityId: EntityId, transform: TransformComponent, renderable: RenderableComponent, interpolation: number): void {
        const ctx = this._ctx;

        const x = this._lerp(transform.prevX, transform.x, interpolation);
        const y = this._lerp(transform.prevY, transform.y, interpolation);
        const rotation = this._lerpAngle(transform.prevRotation, transform.rotation, interpolation);

        ctx.save();

        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(transform.scale, transform.scale);

        ctx.globalAlpha = renderable.alpha;

        let damageFlash = 0;
        const health = this.getComponent<HealthComponent>(entityId, 'Health');
        if (health && health.lastDamageTime) {
            const timeSinceDamage = performance.now() - health.lastDamageTime;
            if (timeSinceDamage < 150) { 
                damageFlash = 1 - (timeSinceDamage / 150);
            }
        }

        switch (renderable.type) {
            case 'circle':
                this._drawCircle(ctx, renderable, damageFlash);
                break;
            case 'rect':
                this._drawRect(ctx, renderable, damageFlash);
                break;
            case 'polygon':
                this._drawPolygon(ctx, renderable, damageFlash);
                break;
            case 'rotatingText':
                this._drawRotatingText(ctx, renderable);
                break;
            default:
                this._drawCircle(ctx, renderable, damageFlash);
        }

        if (renderable.glowEnabled) {
            this._drawGlow(ctx, renderable);
        }

        ctx.restore();

        if (this._debugMode) {
            this._drawDebugCollider(entityId, x, y);
        }
    }

    private _drawCircle(ctx: CanvasRenderingContext2D, renderable: RenderableComponent, damageFlash: number = 0): void {
        ctx.beginPath();
        ctx.arc(0, 0, renderable.radius, 0, Math.PI * 2);
        
        if (renderable.fillColor) {
            ctx.fillStyle = damageFlash > 0 
                ? this._blendWithWhite(renderable.fillColor, damageFlash)
                : renderable.fillColor;
            ctx.fill();
        }
        
        if (renderable.strokeWidth > 0 && renderable.strokeColor) {
            ctx.strokeStyle = damageFlash > 0
                ? this._blendWithWhite(renderable.strokeColor, damageFlash)
                : renderable.strokeColor;
            ctx.lineWidth = renderable.strokeWidth;
            ctx.stroke();
        }
    }

    private _drawRect(ctx: CanvasRenderingContext2D, renderable: RenderableComponent, damageFlash: number = 0): void {
        const halfW = renderable.width / 2;
        const halfH = renderable.height / 2;

        if (renderable.fillColor) {
            ctx.fillStyle = damageFlash > 0
                ? this._blendWithWhite(renderable.fillColor, damageFlash)
                : renderable.fillColor;
            ctx.fillRect(-halfW, -halfH, renderable.width, renderable.height);
        }

        if (renderable.strokeWidth > 0 && renderable.strokeColor) {
            ctx.strokeStyle = damageFlash > 0
                ? this._blendWithWhite(renderable.strokeColor, damageFlash)
                : renderable.strokeColor;
            ctx.lineWidth = renderable.strokeWidth;
            ctx.strokeRect(-halfW, -halfH, renderable.width, renderable.height);
        }
    }

    private _drawPolygon(ctx: CanvasRenderingContext2D, renderable: RenderableComponent, damageFlash: number = 0): void {
        const vertices = renderable.vertices;
        if (!vertices || vertices.length < 3) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(vertices[0][0], vertices[0][1]);

        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i][0], vertices[i][1]);
        }

        ctx.closePath();

        if (renderable.fillColor) {
            ctx.fillStyle = damageFlash > 0
                ? this._blendWithWhite(renderable.fillColor, damageFlash)
                : renderable.fillColor;
            ctx.fill();
        }

        if (renderable.strokeWidth > 0 && renderable.strokeColor) {
            ctx.strokeStyle = damageFlash > 0
                ? this._blendWithWhite(renderable.strokeColor, damageFlash)
                : renderable.strokeColor;
            ctx.lineWidth = renderable.strokeWidth;
            ctx.stroke();
        }
    }

    private _drawRotatingText(ctx: CanvasRenderingContext2D, renderable: RenderableComponent): void {
        if (!renderable.text) return;

        const text = renderable.text;
        const fontSize = renderable.textSize ?? 32;
        const offsetRadius = renderable.textOffsetRadius ?? renderable.radius - 40;
        const rotationSpeed = renderable.textRotationSpeed ?? 0.2;
        const textColor = renderable.textColor ?? renderable.strokeColor ?? '#ffffff';

        ctx.font = `bold ${fontSize}px ${renderable.textFont ?? 'Arial'}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const baseAngle = this._rotationTime * rotationSpeed;
        const charCount = text.length;
        const charSpacing = fontSize * 0.65;
        const totalArcLength = charCount * charSpacing;
        const angleSpan = totalArcLength / offsetRadius;
        const startAngle = baseAngle - angleSpan / 2;

        for (let i = 0; i < charCount; i++) {
            const char = text[charCount - 1 - i];
            const charAngle = startAngle + i * (angleSpan / charCount);

            const charX = Math.cos(charAngle) * offsetRadius;
            const charY = Math.sin(charAngle) * offsetRadius;

            ctx.save();
            ctx.translate(charX, charY);
            ctx.rotate(charAngle - Math.PI / 2);

            ctx.fillStyle = textColor;
            ctx.shadowColor = textColor;
            ctx.shadowBlur = 10;
            ctx.fillText(char, 0, 0);
            ctx.restore();
        }
    }

    private _blendWithWhite(color: string, intensity: number): string {
        let r = 0, g = 0, b = 0;
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } else {
            return color;
        }
        
        const targetR = 255;
        const targetG = 200;
        const targetB = 200;
        
        r = Math.round(r + (targetR - r) * intensity);
        g = Math.round(g + (targetG - g) * intensity);
        b = Math.round(b + (targetB - b) * intensity);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    private _drawGlow(ctx: CanvasRenderingContext2D, renderable: RenderableComponent): void {
        ctx.save();
        
        ctx.shadowColor = renderable.glowColor;
        ctx.shadowBlur = renderable.glowIntensity;
        
        if (renderable.type === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, renderable.radius, 0, Math.PI * 2);
            
            // Disegna riempimento glow solo se l'oggetto ha un fill originale
            if (renderable.fillColor) {
                ctx.fillStyle = renderable.glowColor;
                ctx.globalAlpha = 0.05; // Molto sottile per evitare effetto nebbia
                ctx.fill();
            }
            
            // Disegna sempre il bordo del glow
            ctx.strokeStyle = renderable.glowColor;
            ctx.lineWidth = renderable.strokeWidth || 1;
            ctx.stroke();
            
            // Core bianco solo se piccolo (per proiettili)
            if (renderable.radius < 20) {
                ctx.shadowBlur = renderable.glowIntensity * 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, renderable.radius * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.8;
                ctx.fill();
            }
        } else if (renderable.type === 'rect') {
            const halfW = renderable.width / 2;
            const halfH = renderable.height / 2;
            ctx.fillStyle = renderable.glowColor;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(-halfW, -halfH, renderable.width, renderable.height);
        }
        
        ctx.restore();
    }

    private _drawDebugCollider(entityId: EntityId, x: number, y: number): void {
        const collider = this.getComponent<ColliderComponent>(entityId, 'Collider');
        if (!collider) return;

        const ctx = this._ctx;
        ctx.save();
        ctx.translate(x, y);
        
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        if (collider.type === 'circle') {
            ctx.beginPath();
            ctx.arc(collider.offsetX || 0, collider.offsetY || 0, collider.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (collider.type === 'aabb') {
            const halfW = collider.width / 2;
            const halfH = collider.height / 2;
            ctx.strokeRect(-halfW, -halfH, collider.width, collider.height);
        } else if (collider.type === 'polygon' && collider.vertices) {
            const transform = this.getComponent<TransformComponent>(entityId, 'Transform');
            const scale = transform?.scale || 1;
            ctx.beginPath();
            const v = collider.vertices;
            ctx.moveTo(v[0][0] * scale, v[0][1] * scale);
            for (let i = 1; i < v.length; i++) {
                ctx.lineTo(v[i][0] * scale, v[i][1] * scale);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    private _renderDebugInfo(): void {
        const ctx = this._ctx;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        const gridSize = 100;
        const startX = Math.floor((this._camera.x - 1000) / gridSize) * gridSize;
        const startY = Math.floor((this._camera.y - 1000) / gridSize) * gridSize;

        for (let x = startX; x < this._camera.x + 1000; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, this._camera.y - 1000);
            ctx.lineTo(x, this._camera.y + 1000);
            ctx.stroke();
        }

        for (let y = startY; y < this._camera.y + 1000; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(this._camera.x - 1000, y);
            ctx.lineTo(this._camera.x + 1000, y);
            ctx.stroke();
        }

        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    private _lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private _lerpAngle(a: number, b: number, t: number): number {
        const diff = b - a;
        const TWO_PI = Math.PI * 2;

        let delta = ((diff % TWO_PI) + TWO_PI) % TWO_PI;
        if (delta > Math.PI) {
            delta -= TWO_PI;
        }

        return a + delta * t;
    }

    private _handleResize(): void {
        const dpr = window.devicePixelRatio || 1;
        
        this._canvas.width = window.innerWidth * dpr;
        this._canvas.height = window.innerHeight * dpr;
        
        this._canvas.style.width = window.innerWidth + 'px';
        this._canvas.style.height = window.innerHeight + 'px';
        
        this._ctx.scale(dpr, dpr);
    }

    setCameraPosition(x: number, y: number): void {
        this._camera.x = x;
        this._camera.y = y;
    }

    setCameraZoom(zoom: number): void {
        this._camera.zoom = Math.max(0.1, Math.min(5, zoom));
    }

    setDebugMode(enabled: boolean): void {
        this._debugMode = enabled;
    }

    toggleDebugMode(): void {
        this._debugMode = !this._debugMode;
        console.log(`[RenderSystem] Debug mode: ${this._debugMode}`);
    }

    destroy(): void {
        window.removeEventListener('resize', this._handleResize);
        super.destroy();
    }
}

export default RenderSystem;
