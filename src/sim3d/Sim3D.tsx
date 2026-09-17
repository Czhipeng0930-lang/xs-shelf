import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { FIXTURE_DEFS, STORE, modelFileFor } from '../game/catalog';
import { advanceSimulation, bubbleOf, type BubbleKind, type SimCustomer } from '../game/sim';
import { getSim, useGame } from '../game/store';
import type { Fixture } from '../game/types';

const CUSTOMER_POOL = 64;
const BUBBLE_TEXT: Record<Exclude<BubbleKind, null>, string> = {
  find: '❓',
  happy: '🎵',
  wait: '⏳',
  pay: '💰',
  angry: '💢',
};

function useBubbleTextures() {
  return useMemo(() => {
    const textures = {} as Record<Exclude<BubbleKind, null>, THREE.CanvasTexture>;
    for (const [key, text] of Object.entries(BUBBLE_TEXT)) {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.font = '60px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 48, 52);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures[key as Exclude<BubbleKind, null>] = texture;
    }
    return textures;
  }, []);
}

function FixtureModel({ fixture }: { fixture: Fixture }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/${modelFileFor(fixture)}`);
  const def = FIXTURE_DEFS[fixture.typeId];
  const { object, calibration } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const tint = new THREE.Color(def.color).lerp(new THREE.Color('#ffffff'), 0.45);
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const copy = m.clone();
        const tintable = o.userData?.tintable === true || m.userData?.tintable === true;
        if (tintable && copy.color) copy.color.copy(tint);
        return copy;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    const bounds = new THREE.Box3().setFromObject(clone);
    const measured = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const ratios = [
      def.size.w / Math.max(0.001, measured.x),
      def.size.h / Math.max(0.001, measured.y),
      def.size.d / Math.max(0.001, measured.z),
    ];
    const uniform = Math.min(...ratios);
    const scale: [number, number, number] =
      fixture.typeId === 'checkout' ? [uniform, uniform, uniform] : [ratios[0], ratios[1], ratios[2]];
    return {
      object: clone,
      calibration: {
        scale,
        position: [-center.x, -bounds.min.y, -center.z] as [number, number, number],
      },
    };
  }, [gltf, def, fixture.typeId]);
  return (
    <group position={[fixture.x, 0, fixture.y]} rotation={[0, (-fixture.rotationDeg * Math.PI) / 180, 0]}>
      <group scale={calibration.scale}>
        <primitive object={object} position={calibration.position} />
      </group>
    </group>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('fixture model failed', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FixturePlaceholder({ fixture }: { fixture: Fixture }) {
  const def = FIXTURE_DEFS[fixture.typeId];
  return (
    <mesh
      position={[fixture.x, def.size.h / 2, fixture.y]}
      rotation={[0, (-fixture.rotationDeg * Math.PI) / 180, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[def.size.w, def.size.h, def.size.d]} />
      <meshStandardMaterial color={def.color} />
    </mesh>
  );
}

function FixtureView({ fixture }: { fixture: Fixture }) {
  return (
    <Suspense fallback={<FixturePlaceholder fixture={fixture} />}>
      <ModelBoundary fallback={<FixturePlaceholder fixture={fixture} />}>
        <FixtureModel fixture={fixture} />
      </ModelBoundary>
    </Suspense>
  );
}

function makeFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#efe9dc' : '#e6dfcd';
        ctx.fillRect(x * 30, y * 30, 30, 30);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function StoreShell() {
  const floorTexture = useMemo(() => makeFloorTexture(), []);
  const { width: W, depth: D, wallHeight: H } = STORE;
  const t = 0.15;
  const doorHalf = STORE.door.width / 2;
  const wallColor = '#d8d2c4';
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, D / 2]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTexture} />
      </mesh>
      <mesh position={[W / 2, H / 2, -t / 2]} castShadow receiveShadow>
        <boxGeometry args={[W + t * 2, H, t]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[-t / 2, H / 2, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[t, H, D + t * 2]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[W + t / 2, H / 2, D / 2]} castShadow receiveShadow>
        <boxGeometry args={[t, H, D + t * 2]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[(STORE.door.x - doorHalf) / 2, H / 2, D + t / 2]} castShadow receiveShadow>
        <boxGeometry args={[STORE.door.x - doorHalf, H, t]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[(STORE.door.x + doorHalf + W) / 2, H / 2, D + t / 2]} castShadow receiveShadow>
        <boxGeometry args={[W - STORE.door.x - doorHalf, H, t]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[STORE.door.x, 0.012, D + 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STORE.door.width + 0.4, 0.8]} />
        <meshStandardMaterial color="#c9b99a" />
      </mesh>
    </group>
  );
}

interface PopupRig {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  active: boolean;
  t: number;
  x: number;
  y: number;
}

function Customers() {
  const textures = useBubbleTextures();
  const dayEndHandled = useRef(false);
  const rig = useMemo(() => {
    const root = new THREE.Group();
    const entries: { group: THREE.Group; body: THREE.Mesh; basket: THREE.Mesh; sprite: THREE.Sprite; lastId: number }[] = [];
    for (let i = 0; i < CUSTOMER_POOL; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14, 0.32, 4, 10),
        new THREE.MeshStandardMaterial({ color: '#ffffff' }),
      );
      body.position.y = 0.36;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#f2c9a0' }),
      );
      head.position.y = 0.68;
      head.castShadow = true;
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.15, 0.15),
        new THREE.MeshStandardMaterial({ color: '#8a7f72' }),
      );
      basket.position.set(0.21, 0.34, 0);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.scale.set(0.5, 0.5, 1);
      sprite.position.y = 1.08;
      group.add(body, head, basket, sprite);
      root.add(group);
      entries.push({ group, body, basket, sprite, lastId: -1 });
    }
    const popups: PopupRig[] = [];
    for (let i = 0; i < 8; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 72;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.scale.set(1.15, 0.46, 1);
      sprite.visible = false;
      root.add(sprite);
      popups.push({ sprite, canvas, active: false, t: 0, x: 0, y: 0 });
    }
    return { root, entries, popups };
  }, []);

  const drawPopup = (p: PopupRig, amount: number) => {
    const ctx = p.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(`+¥${amount}`, 90, 38);
    ctx.fillStyle = '#1c9e6b';
    ctx.fillText(`+¥${amount}`, 90, 38);
    (p.sprite.material.map as THREE.CanvasTexture).needsUpdate = true;
  };

  useFrame((state, delta) => {
    const sim = getSim();
    if (!sim) {
      rig.root.visible = false;
      return;
    }
    rig.root.visible = true;
    const { speed, autoFinish, phase } = useGame.getState();
    if (phase === 'open') {
      advanceSimulation(sim, delta, autoFinish ? 6 : speed);
    }
    for (const ev of sim.events) {
      if (ev.type === 'sale') {
        const p = rig.popups.find((candidate) => !candidate.active);
        if (p) {
          drawPopup(p, ev.amount);
          p.active = true;
          p.t = 0;
          p.x = ev.x;
          p.y = ev.y;
        }
      } else if (ev.type === 'day-end') {
        const store = useGame.getState();
        if (store.phase === 'open' && !dayEndHandled.current) {
          dayEndHandled.current = true;
          store.finishDay(ev.report);
        }
      }
    }
    sim.events.length = 0;
    for (let i = 0; i < rig.entries.length; i++) {
      const entry = rig.entries[i];
      const c: SimCustomer | undefined = sim.customers[i];
      if (!c) {
        entry.group.visible = false;
        entry.lastId = -1;
        continue;
      }
      entry.group.visible = true;
      const bodyMat = entry.body.material as THREE.MeshStandardMaterial;
      if (entry.lastId !== c.id) {
        entry.lastId = c.id;
        bodyMat.color.set(c.color);
      }
      if (c.angry) bodyMat.color.set('#e2503f');
      const moving = c.state === 'to-shelf' || c.state === 'to-queue' || c.state === 'to-exit';
      const bob = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9 + c.id * 1.7)) * 0.04 : 0;
      entry.group.position.set(c.x, bob, c.y);
      entry.group.rotation.y = -c.facing;
      entry.basket.visible = c.basket.length > 0;
      const bubble = bubbleOf(c, sim.isPaying(c));
      const map = bubble ? textures[bubble] : null;
      if (entry.sprite.material.map !== map) {
        entry.sprite.material.map = map;
        entry.sprite.material.needsUpdate = true;
      }
      entry.sprite.visible = bubble !== null;
    }
    for (const p of rig.popups) {
      if (!p.active) continue;
      p.t += delta;
      if (p.t > 1.2) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.sprite.visible = true;
      p.sprite.position.set(p.x, 1.25 + p.t * 0.7, p.y);
      p.sprite.material.opacity = 1 - p.t / 1.2;
    }
  });

  return <primitive object={rig.root} />;
}

function Scene() {
  const fixtures = useGame((s) => s.fixtures);
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#c8c2b4', 0.5]} />
      <directionalLight
        position={[6, 12, 10]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <StoreShell />
      {fixtures.map((f) => (
        <FixtureView key={f.id} fixture={f} />
      ))}
      <Customers />
    </>
  );
}

export function Sim3D() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [6, 10.5, 15], fov: 50 }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) {
          const w = window as unknown as Record<string, unknown>;
          w.__r3fGl = gl;
          w.__r3fScene = scene;
        }
      }}
    >
      <color attach="background" args={['#dfe9f2']} />
      <Scene />
      <OrbitControls makeDefault target={[6, 0, 4.5]} enableDamping maxPolarAngle={1.4} minDistance={4} maxDistance={30} />
    </Canvas>
  );
}
