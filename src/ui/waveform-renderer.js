function cssColor(element, name, fallback) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function persistenceOpacity(index, total) {
  if (total <= 0) return 0;
  const ratio = clamp((index + 1) / total, 0, 1);
  return 0.05 + ratio * 0.23;
}

function cloneDisplayFrame(frame) {
  if (!frame?.waveforms) return frame;
  return {
    ...frame,
    waveforms: Object.fromEntries(
      Object.entries(frame.waveforms).map(([key, values]) => [
        key,
        Array.isArray(values) ? values.slice() : values
      ])
    )
  };
}

function plotGeometry(width) {
  const labelWidth = width < 720 ? 92 : 118;
  const valueWidth = width < 720 ? 68 : 88;
  const plotLeft = labelWidth;
  const plotRight = width - valueWidth;
  const plotWidth = Math.max(20, plotRight - plotLeft);
  return { labelWidth, valueWidth, plotLeft, plotRight, plotWidth };
}

export class WaveformRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.frame = null;
    this.history = [];
    this.maxPersistenceFrames = 9;
    this.cursorRatio = 0.76;
    this.pointerCanvasX = null;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerCanvasX = clamp(event.clientX - rect.left, 0, rect.width);
      this.draw();
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointerCanvasX = null;
      this.cursorRatio = 0.76;
      this.draw();
    });
  }

  setFrame(frame) {
    this.frame = frame;
    this.history.push(cloneDisplayFrame(frame));
    if (this.history.length > this.maxPersistenceFrames) this.history.shift();
    this.draw();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  draw() {
    const { width, height } = this.resize();
    const context = this.context;
    const root = document.documentElement;
    const background = cssColor(root, '--scope-bg', '#071014');
    const grid = cssColor(root, '--scope-grid', '#183038');
    const border = cssColor(root, '--border', '#263b42');
    const text = cssColor(root, '--text', '#dce7e8');
    const muted = cssColor(root, '--muted', '#83979d');
    const localColor = cssColor(root, '--local', '#54d6c3');
    const remoteColor = cssColor(root, '--remote', '#f0b35c');
    const alignedColor = cssColor(root, '--aligned', '#8ec5ff');
    const rawDiffColor = cssColor(root, '--raw-diff', '#d18cff');
    const validatedDiffColor = cssColor(root, '--validated-diff', '#ff6d73');

    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const { plotLeft, plotRight, plotWidth } = plotGeometry(width);
    const laneCount = 4;
    const laneHeight = height / laneCount;

    context.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    context.textBaseline = 'middle';

    for (let lane = 0; lane < laneCount; lane += 1) {
      const top = lane * laneHeight;
      const middle = top + laneHeight / 2;
      context.strokeStyle = border;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, top + 0.5);
      context.lineTo(width, top + 0.5);
      context.stroke();

      context.strokeStyle = grid;
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(plotLeft, middle + 0.5);
      context.lineTo(plotRight, middle + 0.5);
      context.stroke();

      for (let column = 0; column <= 10; column += 1) {
        const x = plotLeft + (plotWidth * column) / 10;
        context.globalAlpha = column % 5 === 0 ? 0.75 : 0.35;
        context.beginPath();
        context.moveTo(x + 0.5, top);
        context.lineTo(x + 0.5, top + laneHeight);
        context.stroke();
      }
      for (let row = 1; row < 4; row += 1) {
        const y = top + (laneHeight * row) / 4;
        context.globalAlpha = 0.35;
        context.beginPath();
        context.moveTo(plotLeft, y + 0.5);
        context.lineTo(plotRight, y + 0.5);
        context.stroke();
      }
      context.globalAlpha = 1;
    }

    const labels = [
      ['LOCAL CURRENT', 'reference'],
      ['REMOTE RECEIVED', 'before correction'],
      ['REMOTE ALIGNED', this.frame?.modeLabel ?? 'selected algorithm'],
      ['DIFFERENTIAL', 'raw dashed / validated solid']
    ];

    labels.forEach(([name, sub], lane) => {
      const top = lane * laneHeight;
      context.fillStyle = text;
      context.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.fillText(name, 10, top + laneHeight / 2 - 8);
      context.fillStyle = muted;
      context.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.fillText(sub, 10, top + laneHeight / 2 + 9);
    });

    if (!this.frame) {
      context.fillStyle = muted;
      context.font = '12px system-ui, sans-serif';
      context.fillText('Waiting for simulation worker…', plotLeft + 18, height / 2);
      return;
    }

    const seriesForFrame = (frame) => [
      { data: frame.waveforms.local, lane: 0, color: localColor, width: 1.7 },
      { data: frame.waveforms.remoteReceived, lane: 1, color: remoteColor, width: 1.5 },
      { data: frame.waveforms.remoteAligned, lane: 2, color: alignedColor, width: 1.6 },
      { data: frame.waveforms.rawIdiff, lane: 3, color: rawDiffColor, width: 1.2, dash: [5, 4] },
      { data: frame.waveforms.validatedIdiff, lane: 3, color: validatedDiffColor, width: 1.8 }
    ];

    const scaleFrames = this.history.length > 0 ? this.history : [this.frame];
    const currentValues = scaleFrames.flatMap((frame) => [
      ...frame.waveforms.local.filter(finite).map(Math.abs),
      ...frame.waveforms.remoteReceived.filter(finite).map(Math.abs),
      ...frame.waveforms.remoteAligned.filter(finite).map(Math.abs)
    ]);
    const diffValues = scaleFrames.flatMap((frame) => [
      ...frame.waveforms.rawIdiff.filter(finite),
      ...frame.waveforms.validatedIdiff.filter(finite)
    ]);
    const currentMax = Math.max(1.25, ...currentValues);
    const diffMax = Math.max(0.5, ...diffValues);

    const drawFrameSeries = (frame, alpha = 1, widthMultiplier = 1) => {
      context.globalAlpha = alpha;
      for (const series of seriesForFrame(frame)) {
        const laneTop = series.lane * laneHeight;
        const middle = laneTop + laneHeight / 2;
        const range = series.lane === 3 ? diffMax : currentMax;
        const scaleY = (laneHeight * 0.38) / range;
        context.strokeStyle = series.color;
        context.lineWidth = series.width * widthMultiplier;
        context.setLineDash(series.dash ?? []);
        context.beginPath();
        let drawing = false;
        const data = series.data;
        for (let index = 0; index < data.length; index += 1) {
          const value = data[index];
          if (!finite(value)) {
            drawing = false;
            continue;
          }
          const x = plotLeft + (index / Math.max(1, data.length - 1)) * plotWidth;
          const y = series.lane === 3
            ? laneTop + laneHeight * 0.82 - value * ((laneHeight * 0.7) / diffMax)
            : middle - value * scaleY;
          if (!drawing) {
            context.moveTo(x, y);
            drawing = true;
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      }
      context.globalAlpha = 1;
      context.setLineDash([]);
    };

    if (this.history.length > 1) {
      const ghostFrames = this.history.slice(0, -1);
      ghostFrames.forEach((frame, index) => {
        drawFrameSeries(frame, persistenceOpacity(index, ghostFrames.length), 0.82);
      });
    }
    drawFrameSeries(this.frame, 1, 1);

    const cursorX = this.pointerCanvasX === null
      ? plotLeft + plotWidth * this.cursorRatio
      : clamp(this.pointerCanvasX, 0, width);
    const activeCursorRatio = clamp((cursorX - plotLeft) / plotWidth, 0, 1);
    this.cursorRatio = activeCursorRatio;

    context.strokeStyle = cssColor(root, '--cursor', '#c7f7ef');
    context.globalAlpha = 0.65;
    context.beginPath();
    context.moveTo(cursorX + 0.5, 0);
    context.lineTo(cursorX + 0.5, height);
    context.stroke();
    context.globalAlpha = 1;

    const cursorIndex = Math.min(
      this.frame.waveforms.local.length - 1,
      Math.max(0, Math.round(activeCursorRatio * (this.frame.waveforms.local.length - 1)))
    );
    const laneValues = [
      this.frame.waveforms.local[cursorIndex],
      this.frame.waveforms.remoteReceived[cursorIndex],
      this.frame.waveforms.remoteAligned[cursorIndex],
      this.frame.waveforms.validatedIdiff[cursorIndex]
    ];
    laneValues.forEach((value, lane) => {
      const top = lane * laneHeight;
      context.fillStyle = finite(value) ? text : remoteColor;
      context.textAlign = 'right';
      context.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.fillText(finite(value) ? value.toFixed(3) : 'GAP', width - 10, top + laneHeight / 2 - 3);
      context.fillStyle = muted;
      context.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.fillText(lane === 3 ? 'pu diff' : 'pu inst', width - 10, top + laneHeight / 2 + 12);
    });
    context.textAlign = 'left';
  }
}
