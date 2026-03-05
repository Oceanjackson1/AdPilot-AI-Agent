'use client';
import { useEffect, useRef, useCallback } from 'react';
import styles from './ParticleBird.module.css';

function generateBirdPoints(centerX, centerY, scale, count) {
  const points = [];
  for (let i = 0; i < count * 0.3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rx = 0.18 * scale * (0.5 + Math.random() * 0.5);
    const ry = 0.06 * scale * (0.5 + Math.random() * 0.5);
    points.push({ x: centerX + Math.cos(angle) * rx, y: centerY + Math.sin(angle) * ry });
  }
  for (let i = 0; i < count * 0.25; i++) {
    const t = Math.random();
    const wingX = centerX - 0.18 * scale - t * 0.32 * scale;
    const wingCurve = -t * t * 0.22 * scale;
    const spread = (1 - t) * 0.04 * scale;
    points.push({ x: wingX + (Math.random() - 0.5) * spread * 2, y: centerY + wingCurve + (Math.random() - 0.5) * spread });
  }
  for (let i = 0; i < count * 0.25; i++) {
    const t = Math.random();
    const wingX = centerX + 0.18 * scale + t * 0.32 * scale;
    const wingCurve = -t * t * 0.22 * scale;
    const spread = (1 - t) * 0.04 * scale;
    points.push({ x: wingX + (Math.random() - 0.5) * spread * 2, y: centerY + wingCurve + (Math.random() - 0.5) * spread });
  }
  for (let i = 0; i < count * 0.1; i++) {
    const t = Math.random();
    const side = Math.random() > 0.5 ? 1 : -1;
    points.push({ x: centerX + side * t * 0.08 * scale + (Math.random() - 0.5) * 0.02 * scale, y: centerY + 0.06 * scale + t * 0.12 * scale + (Math.random() - 0.5) * 0.015 * scale });
  }
  for (let i = 0; i < count * 0.1; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.04 * scale * Math.random();
    points.push({ x: centerX + 0.2 * scale + Math.cos(angle) * r, y: centerY - 0.02 * scale + Math.sin(angle) * r * 0.7 });
  }
  return points;
}

class Particle {
  constructor(targetX, targetY, canvasW, canvasH) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.vx = 0;
    this.vy = 0;
    this.size = 1.2 + Math.random() * 1.8;
    this.baseAlpha = 0.3 + Math.random() * 0.5;
    this.alpha = 0;
    this.breathOffset = Math.random() * Math.PI * 2;
    this.breathSpeed = 0.005 + Math.random() * 0.01;
    // Indigo + lavender + silver palette
    const tint = Math.random();
    if (tint < 0.45) {
      // Indigo core
      this.r = 90 + Math.random() * 30;
      this.g = 90 + Math.random() * 30;
      this.b = 220 + Math.random() * 35;
    } else if (tint < 0.75) {
      // Silver white
      this.r = 180 + Math.random() * 30;
      this.g = 185 + Math.random() * 25;
      this.b = 210 + Math.random() * 30;
    } else {
      // Lavender
      this.r = 150 + Math.random() * 30;
      this.g = 140 + Math.random() * 40;
      this.b = 230 + Math.random() * 25;
    }
  }

  update(mouseX, mouseY, mouseActive, time, scrollProgress) {
    this.alpha = this.baseAlpha * (0.7 + 0.3 * Math.sin(time * this.breathSpeed + this.breathOffset));
    const scatterAmount = scrollProgress * 2;
    const scatterX = (Math.random() - 0.5) * scatterAmount * 400;
    const scatterY = (Math.random() - 0.5) * scatterAmount * 400;
    const effectiveTargetX = this.targetX + scatterX * scrollProgress;
    const effectiveTargetY = this.targetY + scatterY * scrollProgress;
    const dx = effectiveTargetX - this.x;
    const dy = effectiveTargetY - this.y;
    this.vx += dx * 0.04;
    this.vy += dy * 0.04;
    if (mouseActive) {
      const mdx = this.x - mouseX;
      const mdy = this.y - mouseY;
      const dist = Math.sqrt(mdx * mdx + mdy * mdy);
      const radius = 160;
      if (dist < radius) {
        const force = (1 - dist / radius) * 10;
        this.vx += (mdx / dist) * force;
        this.vy += (mdy / dist) * force;
      }
    }
    this.vx *= 0.88;
    this.vy *= 0.88;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha *= (1 - scrollProgress * 0.8);
  }

  draw(ctx) {
    if (this.alpha < 0.01) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.r|0}, ${this.g|0}, ${this.b|0}, ${this.alpha})`;
    ctx.fill();
  }
}

class AmbientParticle {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.size = 0.5 + Math.random() * 1.2;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = -0.1 - Math.random() * 0.3;
    this.alpha = 0.04 + Math.random() * 0.12;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.y < -10) { this.y = this.canvasH + 10; this.x = Math.random() * this.canvasW; }
    if (this.x < -10) this.x = this.canvasW + 10;
    if (this.x > this.canvasW + 10) this.x = -10;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150, 150, 210, ${this.alpha})`;
    ctx.fill();
  }
}

class AuroraBlob {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.radius = 150 + Math.random() * 250;
    this.speedX = (Math.random() - 0.5) * 0.15;
    this.speedY = (Math.random() - 0.5) * 0.15;
    this.phase = Math.random() * Math.PI * 2;
    const palette = [
      [99, 102, 241],   // indigo
      [79, 70, 229],    // deeper indigo
      [129, 140, 248],  // lighter indigo
      [165, 180, 252],  // lavender
      [120, 120, 200],  // muted indigo
    ];
    const c = palette[Math.floor(Math.random() * palette.length)];
    this.r = c[0]; this.g = c[1]; this.b = c[2];
    this.baseAlpha = 0.03 + Math.random() * 0.04;
  }

  update(time) {
    this.x += this.speedX + Math.sin(time * 0.0003 + this.phase) * 0.3;
    this.y += this.speedY + Math.cos(time * 0.0004 + this.phase) * 0.2;
    if (this.x < -this.radius) this.x = this.canvasW + this.radius;
    if (this.x > this.canvasW + this.radius) this.x = -this.radius;
    if (this.y < -this.radius) this.y = this.canvasH + this.radius;
    if (this.y > this.canvasH + this.radius) this.y = -this.radius;
  }

  draw(ctx, time) {
    const pulseFactor = 0.8 + 0.2 * Math.sin(time * 0.001 + this.phase);
    const r = this.radius * pulseFactor;
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    gradient.addColorStop(0, `rgba(${this.r}, ${this.g}, ${this.b}, ${this.baseAlpha * pulseFactor})`);
    gradient.addColorStop(0.5, `rgba(${this.r}, ${this.g}, ${this.b}, ${this.baseAlpha * 0.3 * pulseFactor})`);
    gradient.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
  }
}

export default function ParticleBird() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const ambientRef = useRef([]);
  const auroraRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const scrollRef = useRef(0);
  const rafRef = useRef(null);
  const timeRef = useRef(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    const scale = Math.min(w, h);
    const birdPoints = generateBirdPoints(w * 0.5, h * 0.4, scale, 450);
    particlesRef.current = birdPoints.map(p => new Particle(p.x, p.y, w, h));
    ambientRef.current = Array.from({ length: 80 }, () => new AmbientParticle(w, h));
    auroraRef.current = Array.from({ length: 5 }, () => new AuroraBlob(w, h));
  }, []);

  useEffect(() => {
    init();
    const handleResize = () => init();
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const handleMouseLeave = () => { mouseRef.current.active = false; };
    const handleScroll = () => {
      const maxScroll = window.innerHeight * 0.6;
      scrollRef.current = Math.min(window.scrollY / maxScroll, 1);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      timeRef.current++;
      const time = timeRef.current;
      const { x: mx, y: my, active } = mouseRef.current;
      const scroll = scrollRef.current;

      for (const blob of auroraRef.current) { blob.update(time); blob.draw(ctx, time); }
      for (const ap of ambientRef.current) { ap.update(); ap.draw(ctx); }
      for (const p of particlesRef.current) { p.update(mx, my, active, time, scroll); p.draw(ctx); }

      // Constellation lines — indigo tint
      if (scroll < 0.5) {
        const lineAlpha = 0.05 * (1 - scroll * 2);
        ctx.strokeStyle = `rgba(129, 140, 248, ${lineAlpha})`;
        ctx.lineWidth = 0.5;
        const bp = particlesRef.current;
        for (let i = 0; i < bp.length; i += 3) {
          const a = bp[i];
          if (a.alpha < 0.05) continue;
          for (let j = i + 3; j < bp.length; j += 3) {
            const b = bp[j];
            if (b.alpha < 0.05) continue;
            const dx = a.x - b.x; const dy = a.y - b.y;
            if (dx * dx + dy * dy < 1200) {
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
        }
      }

      // Central glow — indigo tinted
      if (scroll < 0.8) {
        const gradient = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.3);
        gradient.addColorStop(0, `rgba(99, 102, 241, ${0.06 * (1 - scroll)})`);
        gradient.addColorStop(0.5, `rgba(129, 140, 248, ${0.03 * (1 - scroll)})`);
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [init]);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
