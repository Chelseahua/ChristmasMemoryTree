import * as THREE from 'three';

export type FrameStyle = 'white' | 'colorful' | 'gold' | 'heart' | 'christmas';

export interface FrameConfig {
    borderGeometry: THREE.PlaneGeometry | THREE.ShapeGeometry;
    borderMaterial: (texture?: THREE.Texture) => THREE.MeshStandardMaterial;
    photoGeometry: THREE.PlaneGeometry;
    scale: number;
    needsCustomTexture?: boolean;
}

// Heart shape generator for frame
const createHeartShape = (): THREE.Shape => {
    const shape = new THREE.Shape();
    const x = 0, y = 0;
    shape.moveTo(x, y);
    shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.5, y, x + 0.5, y - 0.3);
    shape.bezierCurveTo(x + 0.5, y - 0.55, x + 0.25, y - 0.77, x, y - 1);
    shape.bezierCurveTo(x - 0.25, y - 0.77, x - 0.5, y - 0.55, x - 0.5, y - 0.3);
    shape.bezierCurveTo(x - 0.5, y, x - 0.25, y + 0.25, x, y);
    return shape;
};

export const FRAME_PRESETS: Record<FrameStyle, FrameConfig> = {
    white: {
        borderGeometry: new THREE.PlaneGeometry(1.2, 1.5),
        borderMaterial: () => new THREE.MeshStandardMaterial({
            color: '#FDFBF7',
            roughness: 0.8,
            metalness: 0,
        }),
        photoGeometry: new THREE.PlaneGeometry(1, 1),
        scale: 2.0,
    },

    colorful: {
        borderGeometry: new THREE.PlaneGeometry(1.2, 1.5),
        borderMaterial: () => {
            // Create a simple rainbow gradient texture
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d')!;
            const gradient = ctx.createLinearGradient(0, 0, 256, 256);
            gradient.addColorStop(0, '#FF6B9D');
            gradient.addColorStop(0.25, '#FFA06B');
            gradient.addColorStop(0.5, '#FFD93D');
            gradient.addColorStop(0.75, '#6BCF7F');
            gradient.addColorStop(1, '#6B9DFF');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);

            const texture = new THREE.CanvasTexture(canvas);
            return new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.6,
                metalness: 0.3,
            });
        },
        photoGeometry: new THREE.PlaneGeometry(1, 1),
        scale: 2.0,
    },

    gold: {
        borderGeometry: new THREE.PlaneGeometry(1.2, 1.5),
        borderMaterial: () => new THREE.MeshStandardMaterial({
            color: '#FFD700',
            emissive: '#FFD700',
            emissiveIntensity: 0.3,
            roughness: 0.2,
            metalness: 1.0,
        }),
        photoGeometry: new THREE.PlaneGeometry(1, 1),
        scale: 2.0,
    },

    heart: {
        borderGeometry: new THREE.ShapeGeometry(createHeartShape()),
        borderMaterial: () => new THREE.MeshStandardMaterial({
            color: '#FFB6C1',
            emissive: '#FF69B4',
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.2,
        }),
        photoGeometry: new THREE.PlaneGeometry(0.7, 0.7),
        scale: 2.2,
    },

    christmas: {
        borderGeometry: new THREE.PlaneGeometry(1.2, 1.5),
        borderMaterial: (customTexture?: THREE.Texture) => {
            if (customTexture) {
                return new THREE.MeshStandardMaterial({
                    color: '#FDFBF7',
                    map: customTexture,
                    roughness: 0.8,
                    metalness: 0,
                    transparent: true,
                });
            }
            // Default: white with subtle snowflake pattern
            return new THREE.MeshStandardMaterial({
                color: '#FDFBF7',
                roughness: 0.8,
                metalness: 0,
            });
        },
        photoGeometry: new THREE.PlaneGeometry(1, 1),
        scale: 2.0,
        needsCustomTexture: true,
    },
};
