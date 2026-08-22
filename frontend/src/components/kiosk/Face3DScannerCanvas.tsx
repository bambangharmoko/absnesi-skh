import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { HeadPose } from '../../services/faceApi';

interface Face3DScannerCanvasProps {
  headPose: HeadPose | null;
  scanProgress: number;
  completedAngles: Record<string, boolean>;
  isScanningActive: boolean;
  currentAngleId?: 'CENTER' | 'RIGHT' | 'LEFT' | 'UP';
}

export const Face3DScannerCanvas: React.FC<Face3DScannerCanvasProps> = ({
  headPose,
  scanProgress,
  completedAngles,
  isScanningActive,
  currentAngleId,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const headGroupRef = useRef<THREE.Group | null>(null);
  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const laserPlaneRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const ticksRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    // 1. Scene, Camera, WebGL Renderer with Alpha & Antialiasing
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 8.5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Ambient & Holographic Point Lights
    const ambientLight = new THREE.AmbientLight(0x064e3b, 1.5);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3, 20);
    cyanLight.position.set(3, 4, 5);
    scene.add(cyanLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 4, 20);
    emeraldLight.position.set(-3, -3, 5);
    scene.add(emeraldLight);

    // 3. Holographic 3D Head Structure
    const headGroup = new THREE.Group();
    scene.add(headGroup);
    headGroupRef.current = headGroup;

    // 3a. Head Base Wireframe Sphere / Ellipsoid (Cranium)
    const headGeo = new THREE.SphereGeometry(1.6, 24, 20);
    headGeo.scale(1, 1.35, 1.1);

    const headWireMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const headWireMesh = new THREE.Mesh(headGeo, headWireMat);
    headGroup.add(headWireMesh);

    // 3b. Inner Solid Holographic Core
    const headCoreMat = new THREE.MeshPhongMaterial({
      color: 0x022c22,
      emissive: 0x064e3b,
      specular: 0x10b981,
      shininess: 60,
      transparent: true,
      opacity: 0.6,
      wireframe: false,
    });
    const headCoreMesh = new THREE.Mesh(headGeo, headCoreMat);
    headCoreMesh.scale.set(0.96, 0.96, 0.96);
    headGroup.add(headCoreMesh);

    // 3c. Face Features: Eyes, Nose, Mouth Hologram Wire
    const eyeGeo = new THREE.TorusGeometry(0.24, 0.04, 8, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 });
    
    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.55, 0.3, 1.15);
    headGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.55, 0.3, 1.15);
    headGroup.add(rightEye);

    // Nose Bridge
    const noseGeo = new THREE.ConeGeometry(0.18, 0.65, 4);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.8 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, -0.05, 1.35);
    nose.rotation.x = 0.2;
    headGroup.add(nose);

    // Jaw / Chin Arc
    const jawCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.8, -0.7, 0.8),
      new THREE.Vector3(0, -1.6, 1.2),
      new THREE.Vector3(0.8, -0.7, 0.8)
    );
    const jawGeo = new THREE.TubeGeometry(jawCurve, 20, 0.04, 6, false);
    const jawMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.8 });
    const jaw = new THREE.Mesh(jawGeo, jawMat);
    headGroup.add(jaw);

    // 4. Apple Face ID Style 3D Radial Segmented Ticks
    const ticks: THREE.Mesh[] = [];
    const numTicks = 36;
    const tickRadius = 3.3;

    for (let i = 0; i < numTicks; i++) {
      const angle = (i / numTicks) * Math.PI * 2;
      const tickGeo = new THREE.BoxGeometry(0.08, 0.45, 0.04);
      const tickMat = new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.6,
      });

      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.x = Math.cos(angle) * tickRadius;
      tick.position.y = Math.sin(angle) * tickRadius;
      tick.position.z = 0;
      tick.rotation.z = angle - Math.PI / 2;
      scene.add(tick);
      ticks.push(tick);
    }
    ticksRef.current = ticks;

    // 5. 3D Holographic Orbiting Depth Rings
    const ringsGroup = new THREE.Group();
    scene.add(ringsGroup);
    ringsGroupRef.current = ringsGroup;

    // Ring 1 (Outer Gyro Ring)
    const ring1Geo = new THREE.TorusGeometry(3.6, 0.025, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.4,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ringsGroup.add(ring1);

    // Ring 2 (Tilted Ring)
    const ring2Geo = new THREE.TorusGeometry(3.4, 0.02, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 6;
    ring2.rotation.y = Math.PI / 8;
    ringsGroup.add(ring2);

    // 6. Floating Cyber Particles (Stardust)
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 8;
      particlePositions[i + 1] = (Math.random() - 0.5) * 8;
      particlePositions[i + 2] = (Math.random() - 0.5) * 4;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x34d399,
      size: 0.07,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 7. Dynamic 3D Laser Scanning Grid Plane
    const laserGeo = new THREE.PlaneGeometry(5, 0.06);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const laserPlane = new THREE.Mesh(laserGeo, laserMat);
    laserPlane.position.z = 1.3;
    scene.add(laserPlane);
    laserPlaneRef.current = laserPlane;

    // 8. Animation & Render Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gyro Rings gentle idle spinning
      if (ringsGroupRef.current) {
        ringsGroupRef.current.rotation.z = elapsedTime * 0.15;
      }

      // Laser scanning plane motion (Up & Down sweep)
      if (laserPlaneRef.current) {
        laserPlaneRef.current.position.y = Math.sin(elapsedTime * 3) * 1.8;
      }

      // Particles slow drift
      if (particlesRef.current) {
        particlesRef.current.rotation.y = elapsedTime * 0.04;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D Head Orientation smoothly according to real-time face landmarks
  useEffect(() => {
    if (!headGroupRef.current) return;

    if (headPose) {
      // Invert Yaw for camera mirroring effect
      const targetRotY = -(headPose.yaw * Math.PI) / 180 * 1.1;
      const targetRotX = (headPose.pitch * Math.PI) / 180 * 1.1;
      const targetRotZ = -(headPose.roll * Math.PI) / 180 * 0.6;

      headGroupRef.current.rotation.y = targetRotY;
      headGroupRef.current.rotation.x = targetRotX;
      headGroupRef.current.rotation.z = targetRotZ;
    } else {
      // Gentle idle breathing
      headGroupRef.current.rotation.y = 0;
      headGroupRef.current.rotation.x = 0;
      headGroupRef.current.rotation.z = 0;
    }
  }, [headPose]);

  // Update 3D Apple Face ID Radial Ticks Glowing State
  useEffect(() => {
    const ticks = ticksRef.current;
    if (!ticks || ticks.length === 0) return;

    const numTicks = ticks.length;
    const completedCount = Math.floor((scanProgress / 100) * numTicks);

    ticks.forEach((tick, i) => {
      const mat = tick.material as THREE.MeshBasicMaterial;
      if (i < completedCount) {
        // Glowing Emerald Active Tick
        mat.color.setHex(0x10b981);
        mat.opacity = 1.0;
        tick.scale.set(1.4, 1.25, 1.4);
      } else {
        // Inactive Dark Tick
        mat.color.setHex(0x1e293b);
        mat.opacity = 0.45;
        tick.scale.set(1.0, 1.0, 1.0);
      }
    });
  }, [scanProgress]);

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="w-full h-full min-h-[320px] sm:min-h-[360px] flex items-center justify-center" />
    </div>
  );
};
