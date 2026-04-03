(function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    let W, H, dots, floaters, rings, bursts;

    const mouse = { x: -9999, y: -9999, down: false };
    const REPEL_R   = 120;
    const ATTRACT_R = 180;

    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    window.addEventListener('click', e => {
        for (let i = 0; i < 18; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = Math.random() * 3.5 + 1.2;
            bursts.push({
                x: e.clientX, y: e.clientY,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 1.5,
                r: Math.random() * 3 + 1,
                alpha: 0.8,
                blue: Math.random() < 0.7
            });
        }
    });

    function buildDots() {
        dots = [];
        const spacing = 38;
        for (let x = 0; x < W + spacing; x += spacing) {
            for (let y = 0; y < H + spacing; y += spacing) {
                const jx = (Math.random() - 0.5) * 14;
                const jy = (Math.random() - 0.5) * 14;
                const isBlue = Math.random() < 0.12;
                dots.push({
                    ox: x + jx, oy: y + jy,
                    x:  x + jx, y:  y + jy,
                    r: isBlue ? 1.8 : (Math.random() < 0.3 ? 1.4 : 0.9),
                    blue: isBlue
                });
            }
        }
    }

    function mkFloater() {
        return {
            x: Math.random() * W,
            y: H + 10,
            r: Math.random() * 2.5 + 0.8,
            speed: Math.random() * 0.5 + 0.2,
            drift: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.45 + 0.15,
            blue: Math.random() < 0.5
        };
    }
    function buildFloaters() {
        floaters = [];
        const n = Math.floor(W / 14);
        for (let i = 0; i < n; i++) {
            const f = mkFloater();
            f.y = Math.random() * H;
            floaters.push(f);
        }
    }

    function buildRings() {
        rings = [
            { bx: W*0.18, by: H*0.52, cx: W*0.18, cy: H*0.52, rx: W*0.155, ry: H*0.46, tilt:-18, speed: 0.22, dotR:3.5, dotCount:2 },
            { bx: W*0.34, by: H*0.50, cx: W*0.34, cy: H*0.50, rx: W*0.125, ry: H*0.40, tilt: 14, speed:-0.17, dotR:3.0, dotCount:1 },
            { bx: W*0.81, by: H*0.50, cx: W*0.81, cy: H*0.50, rx: W*0.145, ry: H*0.44, tilt:-22, speed: 0.20, dotR:3.5, dotCount:2 },
            { bx: W*0.66, by: H*0.52, cx: W*0.66, cy: H*0.52, rx: W*0.115, ry: H*0.38, tilt: 16, speed:-0.15, dotR:3.0, dotCount:1 },
        ];
        bursts = [];
    }

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        buildDots();
        buildFloaters();
        buildRings();
    }

    function drawStaticDots() {
        dots.forEach(d => {
            const dx  = d.ox - mouse.x;
            const dy  = d.oy - mouse.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < REPEL_R && dist > 0) {
                const force = (1 - dist / REPEL_R) * 28;
                d.x += (dx / dist * force - (d.x - d.ox)) * 0.18;
                d.y += (dy / dist * force - (d.y - d.oy)) * 0.18;
            } else {
                d.x += (d.ox - d.x) * 0.08;
                d.y += (d.oy - d.y) * 0.08;
            }
            const highlight = dist < REPEL_R * 0.7;
            ctx.beginPath();
            ctx.arc(d.x, d.y, highlight ? d.r * 1.8 : d.r, 0, Math.PI * 2);
            ctx.fillStyle = d.blue || highlight
                ? `rgba(59,130,246,${highlight ? 0.85 : 0.60})`
                : 'rgba(15,23,42,0.18)';
            ctx.fill();
        });
    }

    function updateFloaters() {
        floaters.forEach((f, i) => {
            const dx   = f.x - mouse.x;
            const dy   = f.y - mouse.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < REPEL_R && dist > 0) {
                f.x += (dx / dist) * (1 - dist/REPEL_R) * 4;
                f.y += (dy / dist) * (1 - dist/REPEL_R) * 4;
            }
            f.y     -= f.speed;
            f.x     += f.drift;
            f.alpha -= 0.0008;
            if (f.y < -10 || f.alpha <= 0) floaters[i] = mkFloater();
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fillStyle = f.blue
                ? `rgba(59,130,246,${f.alpha})`
                : `rgba(15,23,42,${f.alpha * 0.6})`;
            ctx.fill();
        });
    }

    function updateBursts() {
        bursts = bursts.filter(b => b.alpha > 0.02);
        bursts.forEach(b => {
            b.x     += b.vx;
            b.y     += b.vy;
            b.vy    += 0.04;
            b.vx    *= 0.97;
            b.alpha -= 0.022;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = b.blue
                ? `rgba(59,130,246,${b.alpha})`
                : `rgba(99,102,241,${b.alpha})`;
            ctx.fill();
        });
    }

    function ellipsePoint(ring, theta) {
        const cosT = Math.cos(ring.tilt * Math.PI/180);
        const sinT = Math.sin(ring.tilt * Math.PI/180);
        const ex = ring.rx * Math.cos(theta);
        const ey = ring.ry * Math.sin(theta);
        return {
            x: ring.cx + ex*cosT - ey*sinT,
            y: ring.cy + ex*sinT + ey*cosT
        };
    }

    function updateRings() {
        rings.forEach(ring => {
            const dx   = mouse.x - ring.bx;
            const dy   = mouse.y - ring.by;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const pull = Math.min(dist, ATTRACT_R) / ATTRACT_R * 40;
            const tx   = ring.bx + (dist > 0 ? dx/dist * pull : 0);
            const ty   = ring.by + (dist > 0 ? dy/dist * pull : 0);
            ring.cx += (tx - ring.cx) * 0.04;
            ring.cy += (ty - ring.cy) * 0.04;
        });
    }

    function drawRing(ring, t) {
        ctx.save();
        ctx.translate(ring.cx, ring.cy);
        ctx.rotate(ring.tilt * Math.PI/180);
        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59,130,246,0.42)';
        ctx.lineWidth   = 1.6;
        ctx.setLineDash([5, 9]);
        ctx.lineDashOffset = -(t * ring.speed % 14);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        for (let k = 0; k < ring.dotCount; k++) {
            const phase = (t * ring.speed * 0.012) + (k * Math.PI);
            const p     = ellipsePoint(ring, phase);
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, ring.dotR * 3.5);
            grd.addColorStop(0,   'rgba(59,130,246,0.55)');
            grd.addColorStop(0.4, 'rgba(99,102,241,0.25)');
            grd.addColorStop(1,   'rgba(59,130,246,0)');
            ctx.beginPath();
            ctx.arc(p.x, p.y, ring.dotR * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, ring.dotR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59,130,246,0.90)';
            ctx.fill();
        }
    }

    function drawCursor() {
        if (mouse.x < 0) return;
        const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPEL_R);
        grd.addColorStop(0,   'rgba(59,130,246,0.10)');
        grd.addColorStop(0.5, 'rgba(59,130,246,0.04)');
        grd.addColorStop(1,   'rgba(59,130,246,0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, REPEL_R, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
    }

    let t = 0;
    function draw() {
        ctx.clearRect(0, 0, W, H);
        drawCursor();
        drawStaticDots();
        updateFloaters();
        updateBursts();
        updateRings();
        rings.forEach(r => drawRing(r, t));
        t += 0.55;
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
})();