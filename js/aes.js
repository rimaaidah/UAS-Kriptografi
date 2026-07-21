const AES = (() => {
  const SBOX = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ];
  const INV_SBOX = new Array(256);
  SBOX.forEach((v, i) => INV_SBOX[v] = i);
  const RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1B,0x36];

  const hx2 = n => n.toString(16).toUpperCase().padStart(2, '0');
  const bytesToState = bytes => {
    const st = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) st[r][c] = bytes[c * 4 + r];
    return st;
  };
  const stateToBytes = st => { const out = []; for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out.push(st[r][c]); return out; };
  const cloneState = st => st.map(row => row.slice());
  const matrixBlock = (label, st) => ({ type: 'matrix', label, cols: 4, values: st.map(row => row.map(hx2)) });

  const subBytes = (st, inv) => {
    const t = inv ? INV_SBOX : SBOX;
    return st.map(row => row.map(v => t[v]));
  };

  const shiftRows = (st, inv) => {
    const out = cloneState(st);
    for (let r = 1; r < 4; r++) {
      const row = st[r];
      out[r] = inv
        ? [row[(4 - r) % 4], row[(5 - r) % 4], row[(6 - r) % 4], row[(7 - r) % 4]]
        : [row[r % 4], row[(r + 1) % 4], row[(r + 2) % 4], row[(r + 3) % 4]];
    }
    return out;
  };

  const gmul8 = (a, b) => CL.gfMul(a, b, 0x1B, 8);

  const mixColumns = (st, inv) => {
    const M = inv
      ? [[14,11,13,9],[9,14,11,13],[13,9,14,11],[11,13,9,14]]
      : [[2,3,1,1],[1,2,3,1],[1,1,2,3],[3,1,1,2]];
    const out = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for (let c = 0; c < 4; c++) {
      const col = [st[0][c], st[1][c], st[2][c], st[3][c]];
      for (let r = 0; r < 4; r++) {
        out[r][c] = gmul8(M[r][0], col[0]) ^ gmul8(M[r][1], col[1]) ^ gmul8(M[r][2], col[2]) ^ gmul8(M[r][3], col[3]);
      }
    }
    return out;
  };

  const addRoundKey = (st, roundKeyBytes) => {
    const rk = bytesToState(roundKeyBytes);
    return st.map((row, r) => row.map((v, c) => v ^ rk[r][c]));
  };

  const rotWord = w => [w[1], w[2], w[3], w[0]];
  const subWord = w => w.map(v => SBOX[v]);
  const xorWords = (a, b) => a.map((v, i) => v ^ b[i]);

  function keyExpansion(keyBytes, steps) {
    const w = [];
    for (let i = 0; i < 4; i++) w.push(keyBytes.slice(i * 4, i * 4 + 4));
    for (let i = 4; i < 44; i++) {
      let temp = w[i - 1].slice();
      if (i % 4 === 0) temp = xorWords(subWord(rotWord(temp)), [RCON[(i / 4) - 1], 0, 0, 0]);
      w.push(xorWords(w[i - 4], temp));
    }
    steps.push({
      title: '2. Key Expansion',
      body: [{ type: 'text', text: 'Round key AES-128 dibentuk dari 44 word (w0..w43), lalu dikelompokkan menjadi 11 round key.' }]
    });
    return w;
  }

  function roundKeyBytes(words, round) {
    return words.slice(4 * round, 4 * round + 4).flat();
  }

  function encrypt(inputHex, keyHex, steps) {
    const inBytes = inputHex.match(/../g).map(h => parseInt(h, 16));
    const keyBytes = keyHex.match(/../g).map(h => parseInt(h, 16));
    const words = keyExpansion(keyBytes, steps);
    let s = bytesToState(inBytes);

    steps.push({
      title: '1. Input',
      body: [matrixBlock('Plaintext', s), matrixBlock('Key', bytesToState(keyBytes))]
    });

    s = addRoundKey(s, roundKeyBytes(words, 0));
    steps.push({ title: '3. Initial AddRoundKey', body: [matrixBlock('State ⊕ K0', s)] });

    for (let round = 1; round <= 9; round++) {
      const rs = [];
      s = subBytes(s);
      rs.push(matrixBlock('SubBytes', s));
      s = shiftRows(s);
      rs.push(matrixBlock('ShiftRows', s));
      s = mixColumns(s);
      rs.push(matrixBlock('MixColumns', s));
      s = addRoundKey(s, roundKeyBytes(words, round));
      rs.push(matrixBlock(`AddRoundKey(K${round})`, s));
      steps.push({ title: `Ronde ${round}`, round: true, body: rs });
    }

    const fs = [];
    s = subBytes(s);
    fs.push(matrixBlock('SubBytes', s));
    s = shiftRows(s);
    fs.push(matrixBlock('ShiftRows', s));
    s = addRoundKey(s, roundKeyBytes(words, 10));
    fs.push(matrixBlock('AddRoundKey(K10)', s));
    steps.push({ title: 'Ronde 10', round: true, body: fs });

    return {
      output: stateToBytes(s).map(hx2).join('').toUpperCase(),
      roundKeys: Array.from({ length: 11 }, (_, r) => roundKeyBytes(words, r)),
      steps
    };
  }

  function decrypt(inputHex, keyHex, steps) {
    const inBytes = inputHex.match(/../g).map(h => parseInt(h, 16));
    const keyBytes = keyHex.match(/../g).map(h => parseInt(h, 16));
    const words = keyExpansion(keyBytes, steps);
    let s = bytesToState(inBytes);

    steps.push({
      title: '1. Input',
      body: [matrixBlock('Ciphertext', s), matrixBlock('Key', bytesToState(keyBytes))]
    });

    s = addRoundKey(s, roundKeyBytes(words, 10));
    steps.push({ title: '3. Initial AddRoundKey(K10)', body: [matrixBlock('State ⊕ K10', s)] });

    for (let round = 9; round >= 1; round--) {
      const rs = [];
      s = shiftRows(s, true);
      rs.push(matrixBlock('InvShiftRows', s));
      s = subBytes(s, true);
      rs.push(matrixBlock('InvSubBytes', s));
      s = addRoundKey(s, roundKeyBytes(words, round));
      rs.push(matrixBlock(`AddRoundKey(K${round})`, s));
      s = mixColumns(s, true);
      rs.push(matrixBlock('InvMixColumns', s));
      steps.push({ title: `Ronde ${round}`, round: true, body: rs });
    }

    const fs = [];
    s = shiftRows(s, true);
    fs.push(matrixBlock('InvShiftRows', s));
    s = subBytes(s, true);
    fs.push(matrixBlock('InvSubBytes', s));
    s = addRoundKey(s, roundKeyBytes(words, 0));
    fs.push(matrixBlock('AddRoundKey(K0)', s));
    steps.push({ title: 'Ronde 0', round: true, body: fs });

    return {
      output: stateToBytes(s).map(hx2).join('').toUpperCase(),
      roundKeys: Array.from({ length: 11 }, (_, r) => roundKeyBytes(words, r)),
      steps
    };
  }

  function run(inputHex, keyHex, mode) {
    const steps = [];
    return mode === 'enc' ? encrypt(inputHex, keyHex, steps) : decrypt(inputHex, keyHex, steps);
  }

  return { run };
})();