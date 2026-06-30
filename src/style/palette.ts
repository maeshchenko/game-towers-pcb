export const PALETTE = {
  substrate: 0x0b1611,
  substrateEdge: 0x0d1f17,
  silk: 0x1c3a2b,
  traceHalo: 0x1f8f4d,
  traceBand: 0x0a2c1b,   // dark channel the lanes sit in
  traceCore: 0x6cf2a0,
  traceLane: 0x49d69a,   // crisp teal conductor lane
  traceGroove: 0x07241a, // dark gap between lanes
  chevron: 0x8effbe,
  // neon set (enemies/towers/icons — P3/P4)
  neonCyan: 0x36e0e0,
  neonMagenta: 0xc23bff,
  neonGold: 0xf0c43a,
  neonGreen: 0x4dff7a,
  neonRed: 0xff4d4d,
  neonOrange: 0xff9b3a,
  neonBlue: 0x3a7bff,
  startGreen: 0x35e07a,
  finishRed: 0xe8503a,
  buildGold: 0xe8c84a,
  specialCyan: 0x3fb6d8,
  icBody: 0x18222e,        // cool dark navy IC body (ref chips), not pure black so bevel reads
  icDie: 0x24303f,         // faint inner die rectangle on ICs
  pinSilver: 0x8a948c,
  textDim: 0x3c5446,
  // PCB realism. Bodies stay DARK/recessed; DETAIL (gold pins, metal caps, bevel) is kept crisp.
  pour: 0x0f2c1b,
  hatch: 0x143f24,
  padGold: 0xbf9836,       // crisp gold pins/pads — the detail that reads against dark bodies
  padSilver: 0x9aa39c,     // metallic passive end-caps
  silkWhite: 0x5e6f63,
  capTan: 0x2d3a26,
  resBlack: 0x141a18,
  tantalum: 0x6a4a1e,
  elecCan: 0x3a4742,
  crystal: 0x3a4742,
  inductor: 0x2a2f2c,
  ledRed: 0xc04040,
  ledGreen: 0x46b866,
  copperTrace: 0x2f7a4a,   // bright etched-copper core of a trace
  copperBed: 0x0c2418,     // dark relief channel under the copper core
  routing: 0x163d28,   // faint background copper-routing web
} as const

export const RENDER = {
  traceBandWidth: 14,
  traceCoreWidth: 4,
  traceBandMul: 0.95,  // corridor width = pitch * this (crisp thin multi-lane, not a fat tube)
  haloBlur: 8,
  chevronSpacing: 44,
  cornerRadiusCells: 0.5,
  spotBracket: 10,
  padRadius: 7,
} as const
