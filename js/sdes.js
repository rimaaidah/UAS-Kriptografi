const SDES = (() => {
  const P10 = [3,5,2,7,4,10,1,9,8,6];
  const P8  = [6,3,7,4,8,5,10,9];
  const IP  = [2,6,3,1,4,8,5,7];
  const IP1 = [4,1,3,5,7,2,8,6];
  const EP  = [4,1,2,3,2,3,4,1];
  const P4  = [2,4,3,1];

  const S0 = [
    [1,0,3,2],
    [3,2,1,0],
    [0,2,1,3],
    [3,1,3,2]
  ];
  const S1 = [
    [0,1,2,3],
    [2,0,1,3],
    [3,0,1,0],
    [2,1,0,3]
  ];

  function sboxLookup(sbox, fourBits, sboxSteps, label) {
    const r = parseInt(fourBits[0] + fourBits[3], 2);
    const c = parseInt(fourBits[1] + fourBits[2], 2);
    const val = sbox[r][c];
    const out = CL.dec2bin(val, 2);
    sboxSteps.push({
      type: 'sbox',
      title: `${label} — input ${fourBits} → baris ${r}, kolom ${c}`,
      data: sbox,
      rows: [0,1,2,3],
      cols: [0,1,2,3],
      hitRow: r,
      hitCol: c,
      desc: `Hasil ${label}(${fourBits}) = ${val} = ${out}₂`
    });
    return out;
  }

  function keySchedule(key10, steps) {
    const p10 = CL.permute(key10, P10);
    let L = p10.slice(0, 5);
    let R = p10.slice(5);

    steps.push({
      title: 'Permutasi P10',
      body: [
        { type: 'bits', label: 'Kunci awal (10-bit)', value: key10, chunks: [key10] },
        { type: 'bits', label: 'Setelah P10', value: p10, group: 'amber', chunks: [p10] },
        { type: 'bits', label: 'L0', value: L, group: 'cyan', chunks: [L] },
        { type: 'bits', label: 'R0', value: R, group: 'cyan', chunks: [R] }
      ]
    });

    const L1 = CL.leftShift(L, 1);
    const R1 = CL.leftShift(R, 1);
    const K1 = CL.permute(L1 + R1, P8);

    steps.push({
      title: 'Left Shift 1 (LS-1) → K1',
      body: [
        { type: 'bits', label: 'L1', value: L1, group: 'amber', chunks: [L1] },
        { type: 'bits', label: 'R1', value: R1, group: 'amber', chunks: [R1] },
        { type: 'bits', label: 'K1', value: K1, group: 'violet', chunks: [K1] }
      ]
    });

    const L2 = CL.leftShift(L1, 2);
    const R2 = CL.leftShift(R1, 2);
    const K2 = CL.permute(L2 + R2, P8);

    steps.push({
      title: 'Left Shift 2 (LS-2) → K2',
      body: [
        { type: 'bits', label: 'L2', value: L2, group: 'amber', chunks: [L2] },
        { type: 'bits', label: 'R2', value: R2, group: 'amber', chunks: [R2] },
        { type: 'bits', label: 'K2', value: K2, group: 'violet', chunks: [K2] }
      ]
    });

    return { K1, K2 };
  }

  function fk(bits8, subkey, roundLabel, out) {
    const L = bits8.slice(0, 4);
    const R = bits8.slice(4);
    const ep = CL.permute(R, EP);
    const xored = CL.xor(ep, subkey);
    const left4 = xored.slice(0, 4);
    const right4 = xored.slice(4);
    const sboxSteps = [];
    const s0out = sboxLookup(S0, left4, sboxSteps, 'S0');
    const s1out = sboxLookup(S1, right4, sboxSteps, 'S1');
    const sCombined = s0out + s1out;
    const p4 = CL.permute(sCombined, P4);
    const newL = CL.xor(p4, L);

    out.push({
      title: `${roundLabel} — Expansion/Permutation (E/P)`,
      body: [
        { type: 'bits', label: 'L', value: L, group: 'cyan', chunks: [L] },
        { type: 'bits', label: 'R', value: R, group: 'cyan', chunks: [R] },
        { type: 'bits', label: 'E/P(R)', value: ep, group: 'amber', chunks: [ep] }
      ]
    });

    out.push({
      title: `${roundLabel} — XOR dengan subkey`,
      body: [
        { type: 'bits', label: 'E/P(R)', value: ep, chunks: [ep] },
        { type: 'bits', label: 'Subkey', value: subkey, group: 'red', chunks: [subkey] },
        { type: 'bits', label: 'Hasil XOR', value: xored, group: 'amber', chunks: [xored] }
      ]
    });

    out.push(...sboxSteps);

    out.push({
      title: `${roundLabel} — Gabungan S-Box & P4`,
      body: [
        { type: 'bits', label: 'Gabungan S0+S1', value: sCombined, group: 'amber', chunks: [sCombined] },
        { type: 'bits', label: 'P4', value: p4, group: 'violet', chunks: [p4] }
      ]
    });

    out.push({
      title: `${roundLabel} — XOR dengan L`,
      body: [
        { type: 'bits', label: 'P4', value: p4, chunks: [p4] },
        { type: 'bits', label: 'L sebelumnya', value: L, group: 'cyan', chunks: [L] },
        { type: 'bits', label: `L'`, value: newL, group: 'amber', chunks: [newL] }
      ]
    });

    return { newL, R };
  }

  function run(input8, key10, mode) {
    const steps = [];
    steps.push({
      title: '1. Input',
      body: [
        { type: 'bits', label: mode === 'enc' ? 'Plaintext (8-bit)' : 'Ciphertext (8-bit)', value: input8, group: 'amber', chunks: [input8] },
        { type: 'bits', label: 'Kunci (10-bit)', value: key10, group: 'violet', chunks: [key10] },
        { type: 'text', text: `Mode: <b>${mode === 'enc' ? 'Enkripsi' : 'Dekripsi'}</b>` }
      ]
    });

    const ksSteps = [];
    const { K1, K2 } = keySchedule(key10, ksSteps);
    steps.push({ title: '2. Key Generation', body: ksSteps });

    const ip = CL.permute(input8, IP);
    steps.push({
      title: '3. Initial Permutation (IP)',
      body: [
        { type: 'bits', label: 'Sebelum IP', value: input8, chunks: [input8] },
        { type: 'bits', label: 'Setelah IP', value: ip, group: 'amber', chunks: [ip] }
      ]
    });

    const kOrder = mode === 'enc' ? [K1, K2] : [K2, K1];
    const kLabelOrder = mode === 'enc' ? ['K1', 'K2'] : ['K2', 'K1'];

    const r1body = [];
    const r1 = fk(ip, kOrder[0], `Round 1 (pakai ${kLabelOrder[0]})`, r1body);
    const swapped = r1.R + r1.newL;
    r1body.push({ type: 'bits', label: 'Setelah SWAP', value: swapped, group: 'violet', chunks: [swapped] });
    steps.push({ title: '4. Round Function 1 + Swap', round: true, body: r1body });

    const r2body = [];
    const r2 = fk(swapped, kOrder[1], `Round 2 (pakai ${kLabelOrder[1]})`, r2body);
    const preIP1 = r2.newL + r2.R;
    r2body.push({ type: 'bits', label: 'Hasil akhir Round 2', value: preIP1, group: 'cyan', chunks: [preIP1] });
    steps.push({ title: '5. Round Function 2', round: true, body: r2body });

    const output = CL.permute(preIP1, IP1);
    steps.push({
      title: '6. Final Permutation (IP⁻¹)',
      body: [
        { type: 'bits', label: 'Sebelum IP⁻¹', value: preIP1, chunks: [preIP1] },
        { type: 'bits', label: mode === 'enc' ? 'Ciphertext' : 'Plaintext', value: output, group: 'amber', chunks: [output] }
      ]
    });

    return { output, K1, K2, steps };
  }

  return { run };
})();