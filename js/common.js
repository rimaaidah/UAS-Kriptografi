const CL = {
  isBin(str) {
    return /^[01]+$/.test(str);
  },

  isHex(str) {
    return /^[0-9a-fA-F]+$/.test(str);
  },

  clean(str) {
    return String(str || '').trim().replace(/\s+/g, '');
  },

  hexToBin(hex, bitLen = null) {
    const s = this.clean(hex);
    if (!this.isHex(s)) return null;
    let bin = '';
    for (const ch of s) bin += parseInt(ch, 16).toString(2).padStart(4, '0');
    if (bitLen !== null) {
      if (bin.length > bitLen) bin = bin.slice(-bitLen);
      if (bin.length < bitLen) bin = bin.padStart(bitLen, '0');
    }
    return bin;
  },

  binToHex(bin) {
    const s = this.clean(bin);
    if (!this.isBin(s)) return null;
    let padded = s;
    while (padded.length % 4 !== 0) padded = '0' + padded;
    let hex = '';
    for (let i = 0; i < padded.length; i += 4) hex += parseInt(padded.slice(i, i + 4), 2).toString(16);
    return hex.toUpperCase();
  },

  toBits(str, bitLen) {
    const s = this.clean(str);
    if (!s) return null;
    if (this.isBin(s) && s.length === bitLen) return s;
    if (this.isHex(s)) {
      const bits = this.hexToBin(s, bitLen);
      if (bits && bits.length === bitLen) return bits;
    }
    return null;
  },

  toHex(str, nibbleLen = null) {
    const s = this.clean(str);
    if (this.isHex(s)) {
      const upper = s.toUpperCase();
      if (nibbleLen === null) return upper;
      return upper.length === nibbleLen ? upper : null;
    }
    if (this.isBin(s)) {
      const hex = this.binToHex(s);
      if (hex && nibbleLen !== null) return hex.length === nibbleLen ? hex : null;
      return hex;
    }
    return null;
  },

  permute(bits, table) {
    return table.map(pos => bits[pos - 1]).join('');
  },

  xor(a, b) {
    const x = this.clean(a);
    const y = this.clean(b);
    let out = '';
    for (let i = 0; i < x.length; i++) out += x[i] === y[i] ? '0' : '1';
    return out;
  },

  leftShift(bits, n) {
    const s = this.clean(bits);
    const k = n % s.length;
    return s.slice(k) + s.slice(0, k);
  },

  chunk(str, size) {
    const s = this.clean(str);
    const out = [];
    for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
    return out;
  },

  dec2bin(n, len) {
    return (n >>> 0).toString(2).padStart(len, '0');
  },

  dec2hex(n, len = 0) {
    let h = (n >>> 0).toString(16).toUpperCase();
    if (len > 0) h = h.padStart(len, '0');
    return h;
  },

  gfMul(a, b, mod, width) {
    let p = 0;
    const mask = (1 << width) - 1;
    for (let i = 0; i < width; i++) {
      if (b & 1) p ^= a;
      const hi = a & (1 << (width - 1));
      a <<= 1;
      if (hi) a ^= mod;
      a &= mask;
      b >>= 1;
    }
    return p & mask;
  },

  bytesToHex(bytes) {
    return bytes.map(b => this.dec2hex(b, 2)).join('');
  },

  hexToBytes(hex) {
    const s = this.clean(hex);
    const out = [];
    for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16));
    return out;
  },

  bitsToBytes(bits) {
    const s = this.clean(bits);
    const out = [];
    for (let i = 0; i < s.length; i += 8) out.push(parseInt(s.slice(i, i + 8), 2));
    return out;
  }
};

const StepRenderer = {
  render(stepTree, mountEl) {
    mountEl.innerHTML = '';
    stepTree.forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = 'accordion-item' + (step.round ? ' round' : '');

      const head = document.createElement('div');
      head.className = 'accordion-head';
      head.innerHTML = `
        <div class="title">
          <span class="step-index">${idx + 1}</span>
          ${step.title}
        </div>
        <div class="chev">&#9662;</div>
      `;

      const body = document.createElement('div');
      body.className = 'accordion-body';
      body.innerHTML = (step.body || []).map(b => this.renderBlock(b)).join('');

      head.addEventListener('click', () => item.classList.toggle('open'));
      item.appendChild(head);
      item.appendChild(body);
      mountEl.appendChild(item);
    });

    if (mountEl.firstElementChild) mountEl.firstElementChild.classList.add('open');
  },

  renderBlock(b) {
    switch (b.type) {
      case 'text':
        return `<div class="substep"><div class="st-desc">${b.text}</div></div>`;
      case 'sub':
        return `
          <div class="substep">
            ${b.title ? `<div class="st-title">${b.title}</div>` : ''}
            ${b.desc ? `<div class="st-desc">${b.desc}</div>` : ''}
            ${(b.rows || []).map(r => this.renderBits(r)).join('')}
          </div>
        `;
      case 'bits':
        return `<div class="substep">${this.renderBits(b)}</div>`;
      case 'matrix':
        return `<div class="substep">${this.renderMatrix(b)}</div>`;
      case 'sbox':
        return `<div class="substep">${this.renderSbox(b)}</div>`;
      case 'note':
        return `<div class="note-callout">${b.text}</div>`;
      default:
        return '';
    }
  },

  renderBits(r) {
    const group = r.group ? ` g-${r.group}` : '';
    const wide = r.wide ? ' wide' : '';
    const chunks = r.chunks || [r.value];
    const boxes = chunks.map(v => `<div class="box${group}${wide}">${v}</div>`).join('');
    return `
      <div>
        ${r.label ? `<div class="st-title" style="color:var(--muted); font-weight:500;">${r.label}</div>` : ''}
        <div class="boxrow">${boxes}</div>
      </div>
    `;
  },

  renderMatrix(m) {
    const cols = m.cols || (m.values && m.values[0] ? m.values[0].length : 0);
    const cells = (m.values || []).flat().map(v => `<div class="cell">${v}</div>`).join('');
    return `
      <div>
        ${m.label ? `<div class="st-title" style="color:var(--muted); font-weight:500;">${m.label}</div>` : ''}
        <div class="matrix" style="grid-template-columns:repeat(${cols}, 52px);">${cells}</div>
      </div>
    `;
  },

  renderSbox(s) {
    let html = `<div class="st-title">${s.title}</div>`;
    if (s.desc) html += `<div class="st-desc">${s.desc}</div>`;
    html += `<table class="sbox"><thead><tr><th></th>${(s.cols || []).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
    (s.data || []).forEach((row, ri) => {
      html += `<tr><th>${(s.rows || [])[ri]}</th>`;
      row.forEach((val, ci) => {
        let cls = '';
        if (ri === s.hitRow && ci === s.hitCol) cls = 'hit';
        else if (ri === s.hitRow) cls = 'rowhit';
        else if (ci === s.hitCol) cls = 'colhit';
        html += `<td class="${cls}">${val}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }
};

function wireModePane(toggleSelector, onChange) {
  const btns = document.querySelectorAll(`${toggleSelector} button`);
  btns.forEach(b => {
    b.addEventListener('click', () => {
      btns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onChange(b.dataset.mode);
    });
  });
}

function wireSolutionToggle(toggleId, bodyId) {
  const t = document.getElementById(toggleId);
  const b = document.getElementById(bodyId);
  if (!t || !b) return;
  t.addEventListener('click', () => {
    t.classList.toggle('open');
    b.classList.toggle('open');
    const label = t.querySelector('span.label');
    if (label) label.textContent = t.classList.contains('open') ? 'Sembunyikan Solusi Penyelesaian' : 'Tampilkan Solusi Penyelesaian';
  });
}

function showFieldError(inputEl, errEl, msg) {
  if (msg) {
    inputEl.classList.add('invalid');
    errEl.textContent = msg;
    errEl.classList.add('show');
  } else {
    inputEl.classList.remove('invalid');
    errEl.textContent = '';
    errEl.classList.remove('show');
  }
}

function setResultVisible(panelId, emptyId, visible) {
  const panel = document.getElementById(panelId);
  const empty = document.getElementById(emptyId);
  if (panel) panel.classList.toggle('show', !!visible);
  if (empty) empty.style.display = visible ? 'none' : 'block';
}