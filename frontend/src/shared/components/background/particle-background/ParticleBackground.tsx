import { useTheme } from "../../../theme/useTheme";
import { useEffect, useRef } from "react";
import styles from "./ParticleBackground.module.css";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

export function ParticleBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const colors = getComputedStyle(document.documentElement);
    const rgb = colors.getPropertyValue("--particle-rgb").trim();
    const opacity = Number(colors.getPropertyValue("--particle-opacity"));
    const lineOpacity = Number(
      colors.getPropertyValue("--particle-line-opacity"),
    );
    const linkDistance = Number(
      colors.getPropertyValue("--particle-link-distance"),
    );
    const lineWidth = Number(colors.getPropertyValue("--particle-line-width"));
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let previousTime = 0;

    function draw(step = 0) {
      if (!context) return;
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        particle.x += particle.vx * step;
        particle.y += particle.vy * step;
        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;
        particle.x = Math.max(0, Math.min(width, particle.x));
        particle.y = Math.max(0, Math.min(height, particle.y));

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb}, ${opacity})`;
        context.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          const distance = Math.hypot(
            particle.x - other.x,
            particle.y - other.y,
          );
          if (distance >= linkDistance) continue;

          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(${rgb}, ${lineOpacity * (1 - distance / linkDistance)})`;
          context.lineWidth = lineWidth;
          context.stroke();
        }
      }
    }

    function animate(time: number) {
      const step = previousTime
        ? Math.min((time - previousTime) / (1000 / 60), 3)
        : 1;
      previousTime = time;
      draw(step);
      frame = window.requestAnimationFrame(animate);
    }

    function refresh() {
      window.cancelAnimationFrame(frame);
      previousTime = 0;
      draw();
      // 减少动态效果时保留静态粒子，标签页隐藏时暂停动画。
      if (!motion.matches && !document.hidden) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    function resize() {
      if (!canvas || !context) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = coarse.matches ? 40 : width < 960 ? 60 : 90;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 1.6 + 0.5,
      }));
      refresh();
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", refresh);
    motion.addEventListener("change", refresh);
    coarse.addEventListener("change", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", refresh);
      motion.removeEventListener("change", refresh);
      coarse.removeEventListener("change", resize);
    };
  }, [theme]);

  return <canvas ref={ref} className={styles.canvas} aria-hidden="true" />;
}
