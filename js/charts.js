// ============================================================
// CuentaClara — Charts Module (Canvas-based, no dependencies)
// ============================================================

const Charts = {

  // ---- Donut Chart ----
  drawDonut(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(cx, cy) - 10;
    const innerRadius = radius * 0.62;
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(139,139,167,0.15)';
      ctx.fill();
      ctx.fillStyle = '#8B8BA7';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Utils.t('noTransactions'), cx, cy);
      return;
    }

    let startAngle = -Math.PI / 2;
    const gap = 0.03;

    data.forEach((item, i) => {
      const sliceAngle = (item.value / total) * Math.PI * 2;
      if (sliceAngle < 0.01) return;
      const actualStart = startAngle + gap / 2;
      const actualEnd = startAngle + sliceAngle - gap / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, actualStart, actualEnd);
      ctx.arc(cx, cy, innerRadius, actualEnd, actualStart, true);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();

      // Label
      if (sliceAngle > 0.3) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = radius + 18;
        const lx = cx + Math.cos(midAngle) * (innerRadius + (radius - innerRadius) / 2);
        const ly = cy + Math.sin(midAngle) * (innerRadius + (radius - innerRadius) / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(item.value / total * 100) + '%', lx, ly);
      }

      startAngle += sliceAngle;
    });

    // Center text
    if (options.centerText) {
      ctx.fillStyle = '#8B8BA7';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.centerLabel || '', cx, cy - 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(options.centerText, cx, cy + 10);
    }
  },

  // ---- Bar Chart ----
  drawBars(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!data.length) return;

    const pad = { top: 20, right: 15, bottom: 35, left: 10 };
    const w = rect.width - pad.left - pad.right;
    const h = rect.height - pad.top - pad.bottom;
    const max = Math.max(...data.map(d => Math.max(d.income || 0, d.expense || 0)), 1);
    const barGroupWidth = w / data.length;
    const barWidth = Math.min(barGroupWidth * 0.3, 20);

    data.forEach((item, i) => {
      const x = pad.left + i * barGroupWidth + barGroupWidth / 2;

      // Income bar
      if (item.income > 0) {
        const bh = (item.income / max) * h;
        const grad = ctx.createLinearGradient(0, pad.top + h - bh, 0, pad.top + h);
        grad.addColorStop(0, '#00D9A6');
        grad.addColorStop(1, '#00D9A680');
        ctx.fillStyle = grad;
        this._roundRect(ctx, x - barWidth - 2, pad.top + h - bh, barWidth, bh, 4);
      }

      // Expense bar
      if (item.expense > 0) {
        const bh = (item.expense / max) * h;
        const grad = ctx.createLinearGradient(0, pad.top + h - bh, 0, pad.top + h);
        grad.addColorStop(0, '#FF6B6B');
        grad.addColorStop(1, '#FF6B6B80');
        ctx.fillStyle = grad;
        this._roundRect(ctx, x + 2, pad.top + h - bh, barWidth, bh, 4);
      }

      // Label
      ctx.fillStyle = '#8B8BA7';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label || '', x, pad.top + h + 8);
    });
  },

  // ---- Line Chart ----
  drawLine(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (data.length < 2) return;

    const pad = { top: 20, right: 15, bottom: 35, left: 10 };
    const w = rect.width - pad.left - pad.right;
    const h = rect.height - pad.top - pad.bottom;
    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const points = data.map((d, i) => ({
      x: pad.left + (i / (data.length - 1)) * w,
      y: pad.top + h - ((d.value - min) / range) * h,
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
    const color = options.color || '#6C63FF';
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Points & labels
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0F0F1A';
      ctx.fill();

      ctx.fillStyle = '#8B8BA7';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(data[i].label || '', p.x, pad.top + h + 8);
    });
  },

  // ---- Progress Bar (for budgets) ----
  drawProgress(canvasId, value, max, color = '#6C63FF') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const h = rect.height;
    const w = rect.width;
    const r = h / 2;
    const pct = Math.min(value / (max || 1), 1);

    // Background
    ctx.fillStyle = 'rgba(139,139,167,0.15)';
    this._roundRect(ctx, 0, 0, w, h, r);

    // Fill
    if (pct > 0) {
      const fillW = Math.max(h, w * pct);
      const grad = ctx.createLinearGradient(0, 0, fillW, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + 'CC');
      ctx.fillStyle = grad;
      this._roundRect(ctx, 0, 0, fillW, h, r);
    }
  },

  // ---- Helper: Rounded Rectangle ----
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  },
};
