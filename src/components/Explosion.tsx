/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ExplosionProps {
  x: number;
  y: number;
  color: string;
}

export function Explosion({ x, y, color }: ExplosionProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 40;
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 5 + Math.random() * 15;
      temp.push({
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(angle) * speed,
          Math.sin(phi) * Math.sin(angle) * speed,
          Math.cos(phi) * speed
        ),
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        rotationSpeed: new THREE.Euler(
          Math.random() * 5,
          Math.random() * 5,
          Math.random() * 5
        ),
        scale: 0.1 + Math.random() * 0.5
      });
    }
    return temp;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.multiplyScalar(0.92); // More drag
      p.scale *= 0.96; // Faster fade
      
      p.rotation.x += p.rotationSpeed.x * delta;
      p.rotation.y += p.rotationSpeed.y * delta;
      p.rotation.z += p.rotationSpeed.z * delta;

      dummy.position.copy(p.position);
      dummy.position.x += x;
      dummy.position.y += y;
      dummy.rotation.copy(p.rotation);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, count]}>
      <octahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={8} 
        toneMapped={false}
        roughness={0}
        metalness={1}
      />
    </instancedMesh>
  );
}
