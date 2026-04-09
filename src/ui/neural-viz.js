/**
 * L.E.I.K.A. — Neural Visualization
 * Copyright 2026 — Apache 2.0 License
 *
 * Animates a floating neural network on the background canvas.
 */

export class NeuralViz {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas?.getContext("2d");
    this.nodes = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.animFrame = null;
    this.accentColor = [124, 58, 237]; // leika purple
    this._resize();
    this._initNodes();
    this._bindEvents();
    this._loop();
  }

  _resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _initNodes(count = 65) {
    this.nodes = [];
    for (let i = 0; i < count; i++) {
      this.nodes.push({
        x: Math.random() * (this.canvas?.width || 800),
        y: Math.random() * (this.canvas?.height || 600),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.5 + 1,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  _bindEvents() {
    document.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener("resize", () => {
      this._resize();
      this._initNodes();
    });
  }

  /** Update accent color when emotion changes */
  setColor(r, g, b) {
    this.accentColor = [r, g, b];
  }

  _loop() {
    this._draw();
    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    if (!this.ctx) return;
    const { ctx, canvas, nodes } = this;
    const [r, g, b] = this.accentColor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update positions
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      node.pulse += 0.02;

      // Wrap around
      if (node.x < 0) node.x = canvas.width;
      if (node.x > canvas.width) node.x = 0;
      if (node.y < 0) node.y = canvas.height;
      if (node.y > canvas.height) node.y = 0;

      // Mouse repel
      const dx = node.x - this.mouseX;
      const dy = node.y - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        node.vx += (dx / dist) * 0.08;
        node.vy += (dy / dist) * 0.08;
      }

      // Speed limit
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 1.2) { node.vx *= 0.95; node.vy *= 0.95; }
    }

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], bb = nodes[j];
        const dx = a.x - bb.x, dy = a.y - bb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const alpha = (1 - dist / 130) * 0.18;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bb.x, bb.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const pulse = Math.sin(node.pulse) * 0.5 + 0.5;
      const radius = node.r + pulse * 0.8;
      const alpha = 0.3 + pulse * 0.4;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 2.5, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 2.5);
      grd.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fill();
    }
  }

  destroy() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }
}
