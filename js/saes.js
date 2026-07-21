const SAES = (() => {
  const SBOX = [0x9,0x4,0xA,0xB,0xD,0x1,0x8,0x5,0x6,0x2,0x0,0x3,0xC,0xE,0xF,0x7];
  const INV_SBOX = [0xA,0x5,0x9,0xB,0x1,0x7,0x8,0xF,0x6,0x0,0x2,0x3,0xC,0x4,0xD,0xE];
  const MIX = [[1,4],[4,1]];
  const IMIX = [[9,2],[2,9]];
  const RCON = [0x80, 0x30];

  const nibbles = bits => bits.match(/.{1,4}/g);
  const bitsToState = bits => {
    const ns = nibbles(bits).map(x => parseInt(x, 2));
    return [[ns[0], ns[2]], [ns[1], ns[3]]];
  };
  const stateToBits = st => [st[0][0], st[1][0], st[0][1], st[1][1]].map(v => v.toString(2).padStart(4, '0')).join('');
  const stHex = st => st.map(r => r.map(v => v.toString(16).toUpperCase()));

  const mxMul = (a, b) => CL.gfMul(a, b, 0x3, 4);
  const addRoundKey = (st, k) => st.map((row, r) => row.map((v, c) => v ^ k[r][c]));
  const subNibState = (st, inv = false) => st.map(row => row.map(v => (inv ? INV_SBOX : SBOX)[v]));
  const shiftRows = st => [st[0].slice(), [st[1][1], st[1][0]]];
  const mixColumns = (st, inv = false) => {
    const M = inv ? IMIX : MIX;
    const out = [[0,0],[0,0]];
    for (let c = 0; c < 2; c++) {
      const col = [st[0][c], st[1][c]];
      out[0][c] = mxMul(M[0][0], col[0]) ^ mxMul(M[0][1], col[1]);
      out[1][c] = mxMul(M[1][0], col[0]) ^ mxMul(M[1][1], col[1]);
    }
    return out;
  };

  function expand(keyBits) {
    const key = parseInt(keyBits, 2);
    const w0 = (key >> 8) & 0xFF, w1 = key & 0xFF;
    const w2 = w0 ^ ((SBOX[w1 >> 4] << 4) | SBOX[w1 & 0xF]) ^ RCON[0];
    const w3 = w2 ^ w1;
    const w4 = w2 ^ ((SBOX[w3 >> 4] << 4) | SBOX[w3 & 0xF]) ^ RCON[1];
    const w5 = w4 ^ w3;
    return { K0: [w0, w1], K1: [w2, w3], K2: [w4, w5] };
  }

  function roundKeyState(pair) {
    const bits = pair.map(x => x.toString(2).padStart(8, '0')).join('');
    return bitsToState(bits);
  }

  function run(inputBits, keyBits, mode) {
    const steps = [];
    const { K0, K1, K2 } = expand(keyBits);
    let s = bitsToState(inputBits);

    steps.push({
      title: '1. Input',
      body: [{ type: 'matrix', label: mode === 'enc' ? 'Plaintext' : 'Ciphertext', cols: 2, values: stHex(s) }]
    });

    steps.push({
      title: '2. Key Expansion',
      body: [
        { type: 'bits', label: 'K0', value: K0.map(x => x.toString(2).padStart(8, '0')).join(''), chunks: nibbles(K0.map(x => x.toString(2).padStart(8, '0')).join('')) },
        { type: 'bits', label: 'K1', value: K1.map(x => x.toString(2).padStart(8, '0')).join(''), chunks: nibbles(K1.map(x => x.toString(2).padStart(8, '0')).join('')) },
        { type: 'bits', label: 'K2', value: K2.map(x => x.toString(2).padStart(8, '0')).join(''), chunks: nibbles(K2.map(x => x.toString(2).padStart(8, '0')).join('')) }
      ]
    });

    const K0s = roundKeyState(K0);
    const K1s = roundKeyState(K1);
    const K2s = roundKeyState(K2);

    if (mode === 'enc') {
      s = addRoundKey(s, K0s);

      const r1 = [];
      s = subNibState(s);
      r1.push({ type: 'matrix', label: 'SubNib', cols: 2, values: stHex(s) });
      s = shiftRows(s);
      r1.push({ type: 'matrix', label: 'ShiftRows', cols: 2, values: stHex(s) });
      s = mixColumns(s);
      r1.push({ type: 'matrix', label: 'MixColumns', cols: 2, values: stHex(s) });
      s = addRoundKey(s, K1s);
      r1.push({ type: 'matrix', label: 'AddRoundKey(K1)', cols: 2, values: stHex(s) });
      steps.push({ title: '3. Ronde 1', round: true, body: r1 });

      const r2 = [];
      s = subNibState(s);
      r2.push({ type: 'matrix', label: 'SubNib', cols: 2, values: stHex(s) });
      s = shiftRows(s);
      r2.push({ type: 'matrix', label: 'ShiftRows', cols: 2, values: stHex(s) });
      s = addRoundKey(s, K2s);
      r2.push({ type: 'matrix', label: 'AddRoundKey(K2)', cols: 2, values: stHex(s) });
      steps.push({ title: '4. Ronde 2', round: true, body: r2 });
    } else {
      s = addRoundKey(s, K2s);

      const r1 = [];
      s = shiftRows(s);
      r1.push({ type: 'matrix', label: 'InvShiftRows', cols: 2, values: stHex(s) });
      s = subNibState(s, true);
      r1.push({ type: 'matrix', label: 'InvSubNib', cols: 2, values: stHex(s) });
      s = addRoundKey(s, K1s);
      r1.push({ type: 'matrix', label: 'AddRoundKey(K1)', cols: 2, values: stHex(s) });
      s = mixColumns(s, true);
      r1.push({ type: 'matrix', label: 'InvMixColumns', cols: 2, values: stHex(s) });
      steps.push({ title: '3. Ronde 1 (invers)', round: true, body: r1 });

      const r2 = [];
      s = shiftRows(s);
      r2.push({ type: 'matrix', label: 'InvShiftRows', cols: 2, values: stHex(s) });
      s = subNibState(s, true);
      r2.push({ type: 'matrix', label: 'InvSubNib', cols: 2, values: stHex(s) });
      s = addRoundKey(s, K0s);
      r2.push({ type: 'matrix', label: 'AddRoundKey(K0)', cols: 2, values: stHex(s) });
      steps.push({ title: '4. Ronde 2 (invers)', round: true, body: r2 });
    }

    const output = stateToBits(s);
    steps.push({
      title: '5. Hasil Akhir',
      body: [{ type: 'bits', label: mode === 'enc' ? 'Ciphertext (16-bit)' : 'Plaintext (16-bit)', value: output, chunks: nibbles(output) }]
    });

    return {
      output,
      K0: K0.map(x => x.toString(2).padStart(8, '0')).join(''),
      K1: K1.map(x => x.toString(2).padStart(8, '0')).join(''),
      K2: K2.map(x => x.toString(2).padStart(8, '0')).join(''),
      steps
    };
  }

  return { run };
})();