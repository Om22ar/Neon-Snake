/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, globalGameState } from '../store/gameStore';
import { WORLD_SIZE, TURN_SPEED, BOOST_SPEED, BASE_SPEED } from '../shared/types';
import * as THREE from 'three';
import { Sphere, Grid } from '@react-three/drei';

import { audioManager } from '../utils/audioManager';
import { Explosion } from './Explosion';

const localCollectedOrbs = new Set<string>();

function Snake({ playerId, color, isLocal }: { playerId: string, color: string, isLocal: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{x: number, y: number}[]>([]);

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;
    
    const player = gs.players[playerId];
    if (!player || player.state !== 'alive' || player.segments.length === 0) {
      bodyRef.current.count = 0;
      headRef.current.visible = false;
      return;
    }
    
    headRef.current.visible = true;
    const count = player.segments.length;
    bodyRef.current.count = Math.max(0, count - 1);
    
    const isInvincible = !!player.activeEffects?.invincible;
    const isSpeed = !!player.activeEffects?.speedBoost;

    for (let i = 0; i < count; i++) {
      let targetX = player.segments[i].x;
      let targetY = player.segments[i].y;
      
      const curr = currentPositions.current[i] || (currentPositions.current[i] = { x: targetX, y: targetY });
      
      if (isLocal) {
        curr.x = targetX;
        curr.y = targetY;
      } else {
        const dist = Math.abs(targetX - curr.x) + Math.abs(targetY - curr.y);
        if (dist > 10) {
          curr.x = targetX;
          curr.y = targetY;
        } else {
          const lerpFactor = 15;
          curr.x += (targetX - curr.x) * lerpFactor * delta;
          curr.y += (targetY - curr.y) * lerpFactor * delta;
        }
      }
      
      if (i === 0) {
        headRef.current.position.set(curr.x, curr.y, 0.5);
        const mat = headRef.current.material as any;
        if (mat && mat.emissive && typeof mat.emissive.set === 'function') {
          mat.emissiveIntensity = isInvincible ? 10 : (isSpeed ? 5 : 2);
          if (isInvincible) mat.emissive.set('#f1fa8c');
          else if (isSpeed) mat.emissive.set('#ffffff');
          else mat.emissive.set(color);
        }
      } else {
        dummy.position.set(curr.x, curr.y, 0.5);
        dummy.scale.setScalar(1 + (isInvincible ? Math.sin(state.clock.elapsedTime * 10) * 0.2 : 0));
        dummy.updateMatrix();
        bodyRef.current.setMatrixAt(i - 1, dummy.matrix);
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <Sphere ref={headRef} castShadow receiveShadow args={[0.8, 16, 16]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
        />
      </Sphere>
      <instancedMesh ref={bodyRef} args={[null as any, null as any, 2000]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

function Orbs() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    const time = state.clock.elapsedTime;
    for (const orbId in gs.orbs) {
      const orb = gs.orbs[orbId];
      if (!orb || localCollectedOrbs.has(orbId)) continue;
      
      const bounce = orb.type !== 'normal' ? Math.sin(time * 5) * 0.5 : 0;
      dummy.position.set(orb.x, orb.y, 0.5 + bounce);
      
      const scale = orb.type !== 'normal' ? 1.5 + Math.sin(time * 8) * 0.2 : 1;
      dummy.scale.setScalar(scale);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      if (orb.color) {
        colorObj.set(orb.color);
        meshRef.current.setColorAt(i, colorObj);
      }
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]} castShadow receiveShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        toneMapped={false}
        emissiveIntensity={2}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 2.5;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

function AtmosphericGrid() {
  const [pulse, setPulse] = useState(0);
  const [flicker, setFlicker] = useState(1);
  
  const scanlineRef = useRef<THREE.MeshBasicMaterial>(null);
  
  useFrame((state) => {
    setPulse(audioManager.getPulseIntensity());
    // Subtle retro flicker
    if (Math.random() < 0.02) {
      setFlicker(0.8 + Math.random() * 0.2);
    } else {
      setFlicker(f => f + (1 - f) * 0.1);
    }

    if (scanlineRef.current && (scanlineRef.current as any).userData.shader) {
      (scanlineRef.current as any).userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const sectionColor = useMemo(() => {
    return new THREE.Color('#3b82f6').lerp(new THREE.Color('#60a5fa'), pulse).multiplyScalar(flicker).getStyle();
  }, [pulse, flicker]);

  return (
    <group>
      <Grid
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e3a8a"
        sectionSize={10}
        sectionThickness={1 + pulse * 1.5}
        sectionColor={sectionColor}
        fadeDistance={100}
        fadeStrength={1}
      />
      {/* Scanline effect overlay */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshBasicMaterial 
          ref={scanlineRef}
          transparent 
          opacity={0.03} 
          color="#000000"
          onBeforeCompile={(shader) => {
            shader.uniforms.uTime = { value: 0 };
            (scanlineRef.current as any).userData.shader = shader;
            shader.fragmentShader = `
              uniform float uTime;
              varying vec2 vUv;
              ${shader.fragmentShader}
            `.replace(
              '#include <map_fragment>',
              `
              #include <map_fragment>
              float scanline = sin(vUv.y * 1000.0 + uTime * 5.0) * 0.5 + 0.5;
              diffuseColor.rgb += scanline * 0.1;
              `
            );
            shader.vertexShader = `
              varying vec2 vUv;
              ${shader.vertexShader}
            `.replace(
              '#include <uv_vertex>',
              `
              #include <uv_vertex>
              vUv = uv;
              `
            );
          }}
        />
      </mesh>
    </group>
  );
}

export function GameScene() {
  const { gameState, playerId, sendPlayerState, sendCollectOrb, addExplosion, explosions } = useGameStore();
  const { camera } = useThree();
  const inputs = useRef({ left: false, right: false, boost: false });
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [lightTarget] = useState(() => new THREE.Object3D());

  const localPlayerRef = useRef<{
    active: boolean;
    segments: {x: number, y: number}[];
    score: number;
    currentAngle: number;
    isBoosting: boolean;
    lastSendTime: number;
    activeEffects: Record<string, number>;
  }>({
    active: false,
    segments: [],
    score: 10,
    currentAngle: 0,
    isBoosting: false,
    lastSendTime: 0,
    activeEffects: {},
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inputs.current.left) { inputs.current.left = true; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inputs.current.right) { inputs.current.right = true; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inputs.current.boost) { inputs.current.boost = true; }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && inputs.current.left) { inputs.current.left = false; }
      if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && inputs.current.right) { inputs.current.right = false; }
      if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && inputs.current.boost) { inputs.current.boost = false; }
    };

    const handleBlur = () => {
      inputs.current = { left: false, right: false, boost: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useFrame((state, delta) => {
    const gs = globalGameState.current;
    if (!gs || !playerId) return;
    
    const { spectatingPlayerId } = useGameStore.getState();
    const serverPlayer = gs.players[playerId];
    
    // Follow target logic
    let followTarget: any = null;

    if (serverPlayer && serverPlayer.state === 'alive') {
      // Initialize from server if not active
      if (!localPlayerRef.current.active && serverPlayer.segments.length > 0) {
        localPlayerRef.current.active = true;
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
        localPlayerRef.current.currentAngle = serverPlayer.currentAngle;
        localPlayerRef.current.activeEffects = serverPlayer.activeEffects || {};
      }

      if (localPlayerRef.current.active) {
        // Update effects
        const nowMs = Date.now();
        for (const effect in localPlayerRef.current.activeEffects) {
          if (localPlayerRef.current.activeEffects[effect] < nowMs) {
            delete localPlayerRef.current.activeEffects[effect];
          }
        }

        // Local movement logic
        if (inputs.current.left) localPlayerRef.current.currentAngle += TURN_SPEED * delta;
        if (inputs.current.right) localPlayerRef.current.currentAngle -= TURN_SPEED * delta;
        
        const wasBoosting = localPlayerRef.current.isBoosting;
        localPlayerRef.current.isBoosting = inputs.current.boost && localPlayerRef.current.score > 10;
        if (wasBoosting !== localPlayerRef.current.isBoosting) {
          audioManager.playBoost(localPlayerRef.current.isBoosting);
        }

        const difficulty = gs.difficulty || 1;
        let speed = (localPlayerRef.current.isBoosting ? BOOST_SPEED : BASE_SPEED) * difficulty;
        if (localPlayerRef.current.activeEffects.speedBoost) speed *= 1.5;
        
        const head = { ...localPlayerRef.current.segments[0] };
        head.x += Math.cos(localPlayerRef.current.currentAngle) * speed * delta;
        head.y += Math.sin(localPlayerRef.current.currentAngle) * speed * delta;

        // Boundary check
        const boundary = WORLD_SIZE / 2;
        if (head.x < -boundary) head.x = -boundary;
        if (head.x > boundary) head.x = boundary;
        if (head.y < -boundary) head.y = -boundary;
        if (head.y > boundary) head.y = boundary;

        localPlayerRef.current.segments.unshift(head);

        if (localPlayerRef.current.isBoosting) {
          localPlayerRef.current.score -= 2 * delta;
          if (localPlayerRef.current.score <= 10) {
            localPlayerRef.current.isBoosting = false;
            localPlayerRef.current.score = 10;
          }
        }

        const targetLength = Math.floor(localPlayerRef.current.score);
        while (localPlayerRef.current.segments.length > targetLength) {
          localPlayerRef.current.segments.pop();
        }

        // Check orb collisions
        for (const orbId in gs.orbs) {
          const orb = gs.orbs[orbId];
          if (!orb || localCollectedOrbs.has(orbId)) continue;
          const dx = head.x - orb.x;
          const dy = head.y - orb.y;
          if (dx * dx + dy * dy < 4) {
            if (orb.type === 'normal') {
              localPlayerRef.current.score += orb.value;
            } else if (orb.type === 'speed') {
              localPlayerRef.current.activeEffects.speedBoost = Date.now() + 5000;
            } else if (orb.type === 'invincible') {
              localPlayerRef.current.activeEffects.invincible = Date.now() + 5000;
            }

            localCollectedOrbs.add(orbId);
            delete gs.orbs[orbId]; // predict locally
            sendCollectOrb(orbId);
            audioManager.playCollect();
          }
        }

        // Cleanup localCollectedOrbs occasionally
        if (Math.random() < 0.05) {
          for (const id of localCollectedOrbs) {
            if (!gs.orbs[id]) localCollectedOrbs.delete(id);
          }
        }

        // Check player collisions
        let collided = false;
        const isInvincible = !!localPlayerRef.current.activeEffects.invincible;

        if (!isInvincible) {
          for (const otherId in gs.players) {
            if (otherId === playerId) continue;
            const other = gs.players[otherId];
            if (other.state !== 'alive') continue;

            for (const seg of other.segments) {
              const dx = head.x - seg.x;
              const dy = head.y - seg.y;
              if (dx * dx + dy * dy < 2.25) {
                collided = true;
                break;
              }
            }
            if (collided) break;
          }
        }

        if (collided) {
          localPlayerRef.current.active = false;
          audioManager.playCrash();
          audioManager.playBoost(false);
          addExplosion(head.x, head.y, serverPlayer.color);
          sendPlayerState({
            segments: localPlayerRef.current.segments,
            score: localPlayerRef.current.score,
            currentAngle: localPlayerRef.current.currentAngle,
            isBoosting: localPlayerRef.current.isBoosting,
            state: 'dead',
            activeEffects: {}
          });
          return;
        }

        // Overwrite global state for local rendering
        gs.players[playerId].segments = localPlayerRef.current.segments;
        gs.players[playerId].score = localPlayerRef.current.score;
        gs.players[playerId].currentAngle = localPlayerRef.current.currentAngle;
        gs.players[playerId].isBoosting = localPlayerRef.current.isBoosting;
        gs.players[playerId].activeEffects = localPlayerRef.current.activeEffects;

        // Send state to server at 20Hz
        const now = Date.now();
        if (now - localPlayerRef.current.lastSendTime > 50) {
          sendPlayerState({
            segments: localPlayerRef.current.segments,
            score: localPlayerRef.current.score,
            currentAngle: localPlayerRef.current.currentAngle,
            isBoosting: localPlayerRef.current.isBoosting,
            state: 'alive',
            activeEffects: localPlayerRef.current.activeEffects
          });
          localPlayerRef.current.lastSendTime = now;
        }
        
        followTarget = head;
      }
    } else {
      localPlayerRef.current.active = false;
    }

    // Spectator mode camera follow
    if (!followTarget && spectatingPlayerId && gs.players[spectatingPlayerId]) {
      const sp = gs.players[spectatingPlayerId];
      if (sp.state === 'alive' && sp.segments.length > 0) {
        followTarget = sp.segments[0];
      }
    }

    if (followTarget) {
      const targetZ = Math.min(45, Math.max(20, 20 + (localPlayerRef.current.active ? localPlayerRef.current.score : 20) * 0.2));
      
      // Smooth camera follow predicted head
      camera.position.x += (followTarget.x - camera.position.x) * 10 * delta;
      camera.position.y += (followTarget.y - camera.position.y) * 10 * delta;
      camera.position.z += (targetZ - camera.position.z) * 4 * delta;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      // Make the directional light follow the camera to keep shadows crisp
      if (lightRef.current) {
        lightRef.current.position.set(camera.position.x + 10, camera.position.y - 10, 30);
        lightTarget.position.set(camera.position.x, camera.position.y, 0);
      }
    }
  });

  if (!gameState) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
      />
      <primitive object={lightTarget} />

      {/* Ground plane to receive shadows */}
      <mesh receiveShadow position={[0, 0, -0.2]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      <AtmosphericGrid />

      <Orbs />

      {explosions.map(exp => (
        <Explosion key={exp.id} x={exp.x} y={exp.y} color={exp.color} />
      ))}

      {Object.values(gameState.players).map((player) => {
        if (player.state !== 'alive' || player.segments.length === 0) return null;
        return (
          <Snake
            key={player.id}
            playerId={player.id}
            color={player.color}
            isLocal={player.id === playerId}
          />
        );
      })}
    </>
  );
}
