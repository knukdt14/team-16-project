"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { REGIONS, MAX_PASSENGER } from "@/lib/data";

function Column({ x, z, h, hot, name, value }) {
  const color = hot ? "#f59e0b" : "#10b981";
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[0.45, h, 0.45]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </mesh>
      <Html position={[0, h + 0.35, 0]} center distanceFactor={9}>
        <div className={"map3d-label" + (hot ? " hot" : "")}>
          {name}<b>{value}</b>
        </div>
      </Html>
    </group>
  );
}

export default function Map3D({ mode }) {
  const is3d = mode === "3d";
  return (
    <Canvas
      key={mode}
      shadows
      dpr={[1, 2]}
      camera={{ position: is3d ? [4.5, 5.5, 7] : [0, 11, 0.001], fov: 42 }}
    >
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 6]} intensity={0.9} castShadow />
      <gridHelper args={[22, 22, "#dfe3ea", "#eef1f5"]} position={[0, 0, 0]} />
      {REGIONS.map((r, i) => {
        const x = (r.lon - 127.8) * 4.2;
        const z = -(r.lat - 36.3) * 4.2;
        const h = (r.passenger / MAX_PASSENGER) * 4;
        return (
          <Column
            key={i}
            x={x}
            z={z}
            h={h}
            hot={r.passenger === MAX_PASSENGER}
            name={r.name}
            value={r.passenger}
          />
        );
      })}
      <OrbitControls
        autoRotate={is3d}
        autoRotateSpeed={0.7}
        enablePan={false}
        enableZoom={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
