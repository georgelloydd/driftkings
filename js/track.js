// ===== Tracks: spline centreline, baked scenery canvas, nearest-point queries =====
let WORLD_W = 4400, WORLD_H = 3200; // per-track: def.world
function useWorld(tr) { WORLD_W = tr.W; WORLD_H = tr.H; }
// Barriers sit this far outside the track edge: room to run wide, only blocks big shortcuts. Per-track override: barrierGap.
const BARRIER_GAP = 230;
function barrierGap(tr) { return tr.def.barrierGap || BARRIER_GAP; }
const TRACKS = [
  { name: 'Sunset Circuit', width: 170, pts: [[0.12, 0.55], [0.14, 0.25], [0.3, 0.12], [0.5, 0.18], [0.62, 0.36], [0.76, 0.16], [0.9, 0.24], [0.9, 0.52], [0.76, 0.62], [0.88, 0.8], [0.7, 0.9], [0.5, 0.78], [0.36, 0.9], [0.18, 0.85]],
    th: { grass: '#4c8c3c', grass2: '#5a9c47', road: '#3a3c42', sand: '#d8c48f', tree: ['#2f6e2a', '#3f8a35'] } },
  { name: 'Neon Docks', width: 160, pts: [[0.1, 0.2], [0.35, 0.1], [0.52, 0.22], [0.42, 0.42], [0.6, 0.5], [0.72, 0.15], [0.9, 0.18], [0.92, 0.5], [0.8, 0.62], [0.9, 0.86], [0.6, 0.9], [0.48, 0.72], [0.3, 0.88], [0.1, 0.8], [0.18, 0.55], [0.08, 0.42]],
    th: { grass: '#2b3346', grass2: '#323b52', road: '#26272d', sand: '#4a5068', tree: ['#1f6f8b', '#2d8fb0'], night: true } },
  // Original layouts (v1.3.0)
  { name: 'Apex Ring', width: 200, world: [6600, 4800], barrierGap: 210, smooth: 14, pts: [[0.08, 0.5], [0.12, 0.2], [0.28, 0.1], [0.55, 0.1], [0.7, 0.18], [0.66, 0.32], [0.78, 0.4], [0.92, 0.3], [0.94, 0.62], [0.8, 0.86], [0.6, 0.9], [0.52, 0.72], [0.4, 0.64], [0.3, 0.8], [0.16, 0.86]],
    th: { grass: '#4c8c3c', grass2: '#5a9c47', road: '#3a3c42', sand: '#d8c48f', tree: ['#2f6e2a', '#3f8a35'] } },
  { name: 'Red Canyon', width: 190, world: [6600, 4800], barrierGap: 190, smooth: 14, pts: [[0.1, 0.8], [0.1, 0.45], [0.16, 0.22], [0.3, 0.12], [0.42, 0.2], [0.4, 0.36], [0.5, 0.44], [0.62, 0.3], [0.6, 0.14], [0.74, 0.08], [0.88, 0.14], [0.92, 0.32], [0.82, 0.46], [0.9, 0.62], [0.88, 0.84], [0.72, 0.9], [0.6, 0.78], [0.48, 0.86], [0.34, 0.74], [0.22, 0.9]],
    th: { grass: '#b4683a', grass2: '#c27746', road: '#3d3a3a', sand: '#e0b27a', tree: ['#6b7a3a', '#7f8c45'] } },
  { name: 'Highland Forest', width: 190, world: [6600, 4800], barrierGap: 190, smooth: 14, pts: [[0.14, 0.88], [0.06, 0.66], [0.12, 0.46], [0.06, 0.26], [0.18, 0.1], [0.34, 0.16], [0.4, 0.34], [0.54, 0.3], [0.58, 0.12], [0.76, 0.1], [0.9, 0.22], [0.84, 0.4], [0.7, 0.46], [0.76, 0.6], [0.92, 0.66], [0.88, 0.88], [0.66, 0.92], [0.52, 0.78], [0.36, 0.84]],
    th: { grass: '#2f6b33', grass2: '#3a7a3d', road: '#36383e', sand: '#cdbb88', tree: ['#1d4a24', '#255c2c'] } },
  // Real layout from GPS outline (bacinger/f1-circuits mc-1929), 12 px per metre (tuned so a clean lap is about 1:10, like an F1 pole lap), 64 control points
  { name: 'Monaco', width: 150, ttRunup: 0.18, target: 70.3, world: [10338, 13198], bakeScale: 0.5, pxm: 12, barrierGap: 60, runoff: 40, pts: [[0.6307,0.2305],[0.6314,0.2132],[0.6445,0.1941],[0.7717,0.0599],[0.782,0.0576],[0.8034,0.0661],[0.8123,0.1],[0.8455,0.1444],[0.8554,0.1497],[0.8692,0.1378],[0.8307,0.1015],[0.8269,0.0891],[0.8317,0.0801],[0.8988,0.0609],[0.9233,0.0633],[0.9235,0.1339],[0.8994,0.2353],[0.8621,0.2956],[0.7959,0.3562],[0.7399,0.3831],[0.6422,0.4195],[0.5989,0.4313],[0.4721,0.4514],[0.464,0.4707],[0.4547,0.4732],[0.4417,0.4749],[0.4193,0.4681],[0.1702,0.4959],[0.1522,0.5185],[0.1322,0.5632],[0.1289,0.6273],[0.167,0.6618],[0.1906,0.7642],[0.1861,0.7742],[0.1676,0.7828],[0.1672,0.7984],[0.1874,0.8408],[0.2139,0.874],[0.235,0.8907],[0.2765,0.907],[0.2859,0.9227],[0.2757,0.9326],[0.2215,0.9422],[0.1974,0.9411],[0.1858,0.9333],[0.1806,0.9102],[0.1354,0.8596],[0.0902,0.7394],[0.0786,0.6787],[0.0735,0.6014],[0.0785,0.5538],[0.0955,0.5042],[0.0945,0.4841],[0.1255,0.4728],[0.2308,0.4624],[0.3492,0.4358],[0.4147,0.4291],[0.5221,0.3924],[0.6407,0.3733],[0.6798,0.3481],[0.6901,0.3356],[0.6939,0.3087],[0.6757,0.268],[0.6368,0.2411]],
    th: { grass: '#8d8c86', grass2: '#a09e96', road: '#3b3d44', sand: '#b9b5aa', tree: ['#2f6e2a', '#3f8a35'], city: true } },
  // @@REAL
  // Silverstone Circuit: real layout from GPS outline (bacinger/f1-circuits gb-1948), 8.81 px per metre so a clean lap is close to 2024 pole 1:25.819
  { name: 'Silverstone', width: 185, world: [12089, 18152], bakeScale: 0.5, pxm: 8.81, barrierGap: 229, runoff: 264, ttRunup: 0.102, target: 85.8, pts: [[0.57103,0.0917],[0.70697,0.08382],[0.73113,0.08479],[0.74971,0.08889],[0.76181,0.09424],[0.77626,0.10541],[0.78537,0.11814],[0.81371,0.18809],[0.81989,0.21761],[0.8299,0.33461],[0.86148,0.37941],[0.8582,0.3977],[0.83523,0.43818],[0.83374,0.45448],[0.83728,0.46613],[0.86826,0.49717],[0.87354,0.50688],[0.87414,0.51832],[0.8703,0.52874],[0.85645,0.54018],[0.79573,0.56538],[0.78243,0.57402],[0.57163,0.83145],[0.51738,0.88768],[0.48969,0.90879],[0.4602,0.91618],[0.44635,0.91542],[0.41806,0.90933],[0.40655,0.90323],[0.36262,0.84926],[0.24202,0.75514],[0.22932,0.75233],[0.19958,0.76814],[0.19191,0.76992],[0.17777,0.7676],[0.1686,0.76177],[0.14678,0.74445],[0.13797,0.73301],[0.12586,0.70273],[0.12736,0.69739],[0.14235,0.68109],[0.3417,0.50839],[0.36262,0.49668],[0.39151,0.49387],[0.49323,0.50175],[0.53039,0.49695],[0.54628,0.49107],[0.65008,0.43613],[0.66513,0.4303],[0.67364,0.42976],[0.68012,0.43132],[0.68958,0.43893],[0.70727,0.48017],[0.7126,0.486],[0.71992,0.48956],[0.72849,0.48983],[0.73795,0.48702],[0.74383,0.48195],[0.76535,0.44045],[0.76918,0.41805],[0.76445,0.40078],[0.41891,0.18938],[0.39709,0.18123],[0.3815,0.17972],[0.36526,0.18096],[0.34877,0.18631],[0.33871,0.19829],[0.3281,0.24303],[0.31988,0.24918],[0.30748,0.25323],[0.29393,0.25452],[0.27889,0.25193],[0.26828,0.24713],[0.25677,0.23493],[0.25796,0.22015],[0.30952,0.15047],[0.33697,0.13034],[0.37233,0.11178],[0.40979,0.10239]],
    th: { grass: '#4c8c3c', grass2: '#5a9c47', road: '#3a3c42', sand: '#d8c48f', tree: ['#2f6e2a', '#3f8a35'] } },
  // Suzuka International Racing Course: real layout from GPS outline (bacinger/f1-circuits jp-1962), 9.98 px per metre so a clean lap is close to 2024 pole 1:28.197
  { name: 'Suzuka', width: 180, world: [22556, 13431], bakeScale: 0.5, pxm: 9.98, barrierGap: 200, runoff: 240, ttRunup: 0.103, target: 88.2, pts: [[0.8072,0.52652],[0.9291,0.77728],[0.93394,0.8043],[0.93382,0.81685],[0.92558,0.86444],[0.92211,0.87436],[0.91282,0.88593],[0.89825,0.88865],[0.89062,0.88436],[0.88351,0.87494],[0.83934,0.76133],[0.83235,0.75134],[0.81725,0.74547],[0.79815,0.74522],[0.78854,0.74059],[0.78176,0.73258],[0.77421,0.71184],[0.76561,0.65698],[0.75628,0.63087],[0.74122,0.61608],[0.70015,0.60947],[0.68586,0.59444],[0.67726,0.56792],[0.67585,0.54321],[0.68812,0.4829],[0.69006,0.45935],[0.68602,0.4377],[0.68174,0.4268],[0.66357,0.40796],[0.64132,0.39094],[0.62267,0.38425],[0.60058,0.38458],[0.59247,0.38821],[0.56485,0.41044],[0.55245,0.42746],[0.49992,0.53247],[0.43007,0.54321],[0.42599,0.53858],[0.42433,0.53074],[0.41456,0.46166],[0.40019,0.32278],[0.40156,0.28898],[0.41803,0.22223],[0.41549,0.21223],[0.41238,0.20868],[0.40531,0.20719],[0.40136,0.21165],[0.36526,0.30906],[0.34475,0.34071],[0.32516,0.35434],[0.30772,0.35863],[0.27877,0.35822],[0.24772,0.34508],[0.21808,0.32476],[0.18893,0.28816],[0.17879,0.26932],[0.16607,0.23487],[0.14326,0.13936],[0.13373,0.11911],[0.11794,0.11093],[0.08879,0.11713],[0.07228,0.13291],[0.06779,0.14497],[0.06658,0.17166],[0.07155,0.19389],[0.0766,0.20322],[0.11124,0.25428],[0.16248,0.31319],[0.21937,0.35682],[0.43414,0.48323],[0.44226,0.48364],[0.45922,0.47703],[0.47428,0.46728],[0.49976,0.44357],[0.56509,0.34426],[0.58928,0.31501],[0.59424,0.31666],[0.60619,0.3341],[0.61027,0.33608],[0.61863,0.3298],[0.63442,0.3084],[0.64375,0.30179],[0.66575,0.30113],[0.67698,0.30501],[0.69773,0.32005],[0.72042,0.35045]],
    th: { grass: '#4c8c3c', grass2: '#5a9c47', road: '#3a3c42', sand: '#d8c48f', tree: ['#2f6e2a', '#3f8a35'] } },
  // Intercity Istanbul Park: real layout from GPS outline (bacinger/f1-circuits tr-2005), 7.42 px per metre so a clean lap is close to 2021 qualifying best 1:22.868
  { name: 'Istanbul Park', width: 180, world: [13805, 12486], bakeScale: 0.5, pxm: 7.42, barrierGap: 193, runoff: 223, ttRunup: 0.113, target: 82.9, pts: [[0.38405,0.83326],[0.50537,0.80352],[0.51489,0.7987],[0.51932,0.78919],[0.5056,0.72654],[0.5056,0.71247],[0.5088,0.69232],[0.51981,0.67071],[0.53791,0.65148],[0.57447,0.62756],[0.62191,0.60813],[0.67007,0.59803],[0.71804,0.59624],[0.74251,0.60014],[0.75316,0.59849],[0.76471,0.59274],[0.77572,0.58058],[0.78376,0.55237],[0.77852,0.50823],[0.77983,0.49931],[0.78543,0.49356],[0.84293,0.49706],[0.85525,0.49356],[0.86067,0.48655],[0.86189,0.47816],[0.85552,0.43931],[0.85141,0.43065],[0.84338,0.42385],[0.64587,0.31277],[0.63337,0.30226],[0.6289,0.29235],[0.6317,0.27425],[0.6373,0.26764],[0.65391,0.25647],[0.66812,0.25277],[0.68022,0.25191],[0.74052,0.26414],[0.8279,0.28806],[0.83575,0.28581],[0.87511,0.26183],[0.87998,0.25442],[0.89258,0.21233],[0.8924,0.20183],[0.87371,0.1639],[0.83977,0.12478],[0.83025,0.12002],[0.81603,0.11877],[0.79662,0.12148],[0.5464,0.20374],[0.53182,0.2126],[0.52681,0.21987],[0.52753,0.22951],[0.54283,0.25964],[0.54283,0.27517],[0.46313,0.54847],[0.45324,0.56248],[0.43767,0.57853],[0.11473,0.77214],[0.10873,0.77914],[0.10891,0.79751],[0.11564,0.80683],[0.12272,0.80974],[0.14421,0.80782],[0.15016,0.81073],[0.15319,0.81568],[0.14628,0.86802],[0.14719,0.87588],[0.15224,0.88123]],
    th: { grass: '#7d9a4a', grass2: '#8fa957', road: '#3d3f44', sand: '#d9c28a', tree: ['#4f6a2e', '#62803a'] } },
  // Sepang International Circuit: real layout from GPS outline (bacinger/f1-circuits my-1999), 7.08 px per metre so a clean lap is close to 2017 pole 1:30.076
  { name: 'Sepang', width: 180, world: [11192, 9707], bakeScale: 0.5, pxm: 7.08, barrierGap: 198, runoff: 227, ttRunup: 0.108, target: 90.1, pts: [[0.34788,0.5283],[0.15825,0.54631],[0.14167,0.54096],[0.13626,0.53439],[0.13296,0.51541],[0.13612,0.50487],[0.14349,0.49692],[0.15347,0.49327],[0.18678,0.50487],[0.19401,0.50349],[0.20012,0.49651],[0.20209,0.488],[0.20012,0.4768],[0.17891,0.44461],[0.16858,0.41679],[0.16661,0.38443],[0.17019,0.3421],[0.17596,0.32223],[0.19415,0.28889],[0.22296,0.26302],[0.32526,0.22377],[0.47147,0.15329],[0.48496,0.15816],[0.51707,0.33366],[0.53316,0.36578],[0.56225,0.38816],[0.59078,0.39303],[0.60687,0.39019],[0.62331,0.38281],[0.63497,0.37316],[0.65774,0.34501],[0.66891,0.33723],[0.68647,0.33025],[0.71619,0.33196],[0.73882,0.34745],[0.86634,0.51517],[0.86704,0.52336],[0.84238,0.58889],[0.83585,0.59416],[0.7117,0.60405],[0.60237,0.61881],[0.54244,0.63017],[0.53675,0.63552],[0.53492,0.64436],[0.53998,0.65426],[0.5827,0.68151],[0.59204,0.69237],[0.60188,0.72514],[0.60139,0.74898],[0.59471,0.78856],[0.58452,0.81354],[0.56928,0.83909],[0.55291,0.84671],[0.53661,0.83933],[0.40304,0.71241],[0.39369,0.70843],[0.38168,0.70762],[0.36854,0.71143],[0.30685,0.74493],[0.27783,0.7472],[0.25254,0.74193],[0.23533,0.73374],[0.22415,0.72352],[0.20919,0.70081],[0.20315,0.6734],[0.2094,0.66172],[0.22282,0.65531],[0.75252,0.54298],[0.76011,0.53528],[0.76566,0.52052],[0.76285,0.50819],[0.75322,0.49667],[0.73741,0.49384]],
    th: { grass: '#3f8f3a', grass2: '#4fa245', road: '#3a3c42', sand: '#e0cf98', tree: ['#1f5e2a', '#2f7a35'] } },
  // Kyalami Grand Prix Circuit: real layout from GPS outline (bacinger/f1-circuits za-1961), 9.23 px per metre so a clean lap is close to estimate (no F1 race on current layout)
  { name: 'Kyalami', width: 180, world: [16522, 10506], bakeScale: 0.5, pxm: 9.23, barrierGap: 185, runoff: 222, ttRunup: 0.133, target: 75.0, pts: [[0.62736,0.68356],[0.7206,0.52061],[0.8899,0.34516],[0.90765,0.32191],[0.91072,0.31067],[0.9086,0.2967],[0.89861,0.28342],[0.8435,0.26642],[0.83501,0.25948],[0.82753,0.24913],[0.80787,0.18915],[0.79553,0.17225],[0.76354,0.14255],[0.75718,0.1404],[0.7493,0.14255],[0.74372,0.14948],[0.59324,0.47821],[0.58247,0.49453],[0.55221,0.51602],[0.53774,0.51817],[0.50771,0.50664],[0.48632,0.47997],[0.42546,0.34487],[0.41022,0.33363],[0.40078,0.33363],[0.39174,0.3394],[0.31256,0.50723],[0.3091,0.51934],[0.30871,0.5591],[0.31988,0.5933],[0.32317,0.62182],[0.31932,0.65113],[0.30391,0.68659],[0.28677,0.70447],[0.21318,0.75019],[0.16153,0.75869],[0.09933,0.78838],[0.0924,0.79659],[0.08928,0.80929],[0.08967,0.8214],[0.09453,0.83381],[0.11742,0.85413],[0.13093,0.8596],[0.14266,0.85775],[0.31524,0.73241],[0.32892,0.71355],[0.33992,0.69148],[0.34818,0.66324],[0.35902,0.55178],[0.36555,0.51456],[0.38286,0.45272],[0.39235,0.44334],[0.40329,0.4452],[0.41312,0.4579],[0.42624,0.50215],[0.43819,0.5297],[0.47437,0.58362],[0.49749,0.60971],[0.50022,0.62114],[0.51273,0.82932],[0.51675,0.84231],[0.53278,0.84446],[0.54316,0.83049]],
    th: { grass: '#9aa44f', grass2: '#aab25e', road: '#3d3f44', sand: '#d6bf86', tree: ['#4a6b2f', '#5c8038'] } },
  // @@END
];
function crPoint(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]; }
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function buildTrack(idx, noBake) {
  const def = TRACKS[idx]; WORLD_W = def.world ? def.world[0] : 4400; WORLD_H = def.world ? def.world[1] : 3200;
  const cp = def.pts.map(p => [p[0] * WORLD_W, p[1] * WORLD_H]), raw = [];
  for (let i = 0; i < cp.length; i++) { const p0 = cp[(i - 1 + cp.length) % cp.length], p1 = cp[i], p2 = cp[(i + 1) % cp.length], p3 = cp[(i + 2) % cp.length]; for (let k = 0; k < 60; k++) raw.push(crPoint(p0, p1, p2, p3, k / 60)); }
  // resample to even spacing (~12px)
  let L = 0; const cum = [0]; for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
  const N = Math.round(L / 12), pts = []; let j = 0;
  for (let k = 0; k < N; k++) { const d = k * L / N; while (cum[j + 1] < d) j++; const a = raw[j], b = raw[(j + 1) % raw.length], f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  const passes = def.smooth != null ? def.smooth : (def.pxm ? 36 : 10);
  for (let it = 0; it < passes; it++) { const o = pts.map(p => p.slice()); for (let i = 0; i < N; i++) { const a = o[(i - 1 + N) % N], b = o[i], c = o[(i + 1) % N]; pts[i] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4]; } }
  if (passes) { L = 0; for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } }
  const dirs = pts.map((p, i) => { const q = pts[(i + 1) % N], r = pts[(i - 1 + N) % N]; return Math.atan2(q[1] - r[1], q[0] - r[0]); });
  const tr = { idx, def, name: def.name, w: def.width, pts, dirs, n: N, len: L, th: def.th, W: WORLD_W, H: WORLD_H, bs: def.bakeScale || 1 };
  if (!noBake) prepTiles(tr); return tr;
}
function pathTrack(g, tr) { g.beginPath(); tr.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }
function bakeTrack(tr) {
  const g = makeRec(), th = tr.th, R = rnd(tr.idx * 977 + 13), band = !!tr.def.world;
  g.fillStyle = th.grass; g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0, nb = band ? Math.round(tr.n * 1.5) : 2600; i < nb; i++) { g.fillStyle = R() < 0.5 ? th.grass2 : 'rgba(0,0,0,.05)'; g.globalAlpha = 0.35; g.beginPath(); let bx, by; if (band) { const j = Math.floor(R() * tr.n), q = tr.pts[j], dd = (R() * 2 - 1) * 1600; bx = q[0] - Math.sin(tr.dirs[j]) * dd; by = q[1] + Math.cos(tr.dirs[j]) * dd; } else { bx = R() * WORLD_W; by = R() * WORLD_H; } g.arc(bx, by, 20 + R() * 90, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.lineJoin = g.lineCap = 'round';
  // runoff, kerbs, road
  pathTrack(g, tr); g.strokeStyle = th.sand; g.lineWidth = tr.w + (tr.def.runoff || 110); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = tr.w + 34; g.stroke();
  g.strokeStyle = '#f2f2f2'; g.lineWidth = tr.w + 26; g.stroke();
  g.setLineDash([34, 34]); g.strokeStyle = th.night ? '#ff2fb0' : '#d8262f'; g.stroke(); g.setLineDash([]);
  g.strokeStyle = th.road; g.lineWidth = tr.w; g.stroke();
  // asphalt grain
  g.save(); pathTrack(g, tr); g.lineWidth = tr.w; g.strokeStyle = '#000'; g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < tr.n; i += 2) { const p = tr.pts[i]; for (let k = 0; k < 3; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; g.fillRect(p[0] + (R() - 0.5) * tr.w, p[1] + (R() - 0.5) * tr.w, 3, 3); } }
  g.restore();
  // edge lines + centre dashes
  pathTrack(g, tr); g.setLineDash([40, 50]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.stroke(); g.setLineDash([]);
  // start / finish checker
  const p0 = tr.pts[0], a0 = tr.dirs[0], nx = -Math.sin(a0), ny = Math.cos(a0), sq = tr.w / 10;
  g.save(); g.translate(p0[0], p0[1]); g.rotate(a0); for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) { g.fillStyle = (r + k) % 2 ? '#111' : '#fff'; g.fillRect(-sq + r * sq, -tr.w / 2 + k * sq, sq, sq); } g.restore();
  // grid boxes
  for (let s = 0; s < 8; s++) { const gp = gridSlot(tr, s); g.save(); g.translate(gp.x, gp.y); g.rotate(gp.a); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(34, -24); g.lineTo(40, -24); g.lineTo(40, 24); g.lineTo(34, 24); g.stroke(); g.restore(); }
  // grandstand near start
  { let side = 0; for (const sd of [1, -1]) { const cx = p0[0] + nx * (tr.w / 2 + 120) * sd, cy = p0[1] + ny * (tr.w / 2 + 120) * sd, fx = Math.cos(a0), fy = Math.sin(a0); let ok = true; for (const u of [-200, -100, 0, 100, 200]) for (const v of [-40, 0, 40]) if (nearestFull(tr, cx + fx * u + nx * v, cy + fy * u + ny * v).d < tr.w / 2 + 25) ok = false; if (ok) { side = sd; break; } } const gx = p0[0] + nx * (tr.w / 2 + 120) * side, gy = p0[1] + ny * (tr.w / 2 + 120) * side; if (side)  g.save(); g.translate(gx, gy); g.rotate(a0); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-190, -30, 400, 80); g.fillStyle = '#8a8f99'; g.fillRect(-200, -40, 400, 80); for (let i = 0; i < 260; i++) { g.fillStyle = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#9b59b6', '#2ecc71'][Math.floor(R() * 6)]; g.beginPath(); g.arc(-190 + R() * 380, -30 + R() * 60, 4, 0, 7); g.fill(); } g.fillStyle = th.night ? '#ff2fb0' : '#d8262f'; g.fillRect(-200, -52, 400, 14); g.restore(); }
  // trees / props off-track
  let placed = 0;
  const maxPl = band ? Math.round(tr.n * 0.5) : 520, minD = band ? tr.w / 2 + barrierGap(tr) + 40 : tr.w / 2 + 130;
  for (let tries = 0; tries < maxPl * 12 && placed < maxPl; tries++) {
    let x, y; if (band) { const i = Math.floor(R() * tr.n), p = tr.pts[i], sd = R() < 0.5 ? -1 : 1, dd = minD + 10 + R() * 1100; x = p[0] - Math.sin(tr.dirs[i]) * dd * sd; y = p[1] + Math.cos(tr.dirs[i]) * dd * sd; } else { x = R() * WORLD_W; y = R() * WORLD_H; }
    if (nearestFull(tr, x, y).d < minD) continue; placed++;
    const r = 26 + R() * 30;
    if (th.city && R() < 0.8) { const bw = r * (1.6 + R() * 1.6), bh = r * (1.6 + R() * 2), an = R() * Math.PI; g.save(); g.translate(x, y); g.rotate(an); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-bw / 2 + 12, -bh / 2 + 14, bw, bh); g.fillStyle = ['#e9dcc4', '#d9b99b', '#f1ece2', '#c98f6a', '#e3c9a8'][Math.floor(R() * 5)]; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-bw / 2, -bh / 2, bw, bh / 2); g.restore(); continue; }
    if (th.night && R() < 0.35) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - r + 10, y - r + 10, r * 2, r * 2.4); g.fillStyle = ['#1c2233', '#232b40', '#2a2f45'][Math.floor(R() * 3)]; g.fillRect(x - r, y - r, r * 2, r * 2.4); g.fillStyle = ['#00e5ff', '#ff2fb0', '#ffe14d'][Math.floor(R() * 3)]; g.globalAlpha = 0.7; g.fillRect(x - r, y - r, r * 2, 4); g.globalAlpha = 1; continue; }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 12, y + 14, r, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, th.tree[1]); gr.addColorStop(1, th.tree[0]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (th.snow) { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, 7); g.fill(); }
  }
  // tyre stacks on outside of tight corners
  for (let i = 0; i < tr.n; i += 6) { const da = angDiff(tr.dirs[(i + 6) % tr.n], tr.dirs[i]); if (Math.abs(da) < 0.12) continue; const side = da > 0 ? -1 : 1, p = tr.pts[i], d = tr.w / 2 + 70; const x = p[0] + Math.cos(tr.dirs[i] + Math.PI / 2) * d * side, y = p[1] + Math.sin(tr.dirs[i] + Math.PI / 2) * d * side; if (nearestFull(tr, x, y).d < tr.w / 2 + 50) continue; g.fillStyle = '#16161a'; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); g.strokeStyle = (i / 6) % 2 ? '#fff' : (th.night ? '#00e5ff' : '#d8262f'); g.lineWidth = 4; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); }
  // far-out barriers (Armco + red/white blocks); skipped where they would cut into another part of the track
  const BO = tr.w / 2 + barrierGap(tr);
  for (const pass of [0, 1]) for (const side of [-1, 1]) {
    let open = false; g.lineCap = 'round'; g.lineWidth = pass ? 4 : 9; const sc = pass ? '#c9ced6' : 'rgba(0,0,0,.35)';
    for (let i = 0; i <= tr.n; i += 2) {
      const k = i % tr.n, p = tr.pts[k], d = tr.dirs[k], bx = p[0] - Math.sin(d) * BO * side, by = p[1] + Math.cos(d) * BO * side;
      const ok = nearestFull(tr, bx, by).d > BO - 14;
      if (ok) { if (!open) { g.beginPath(); g.moveTo(bx + (pass ? 0 : 5), by + (pass ? 0 : 6)); open = true; } else g.lineTo(bx + (pass ? 0 : 5), by + (pass ? 0 : 6)); }
      else if (open) { g.strokeStyle = sc; g.stroke(); open = false; }
      if (pass && ok && k % 24 === 0) { g.save(); g.translate(bx, by); g.rotate(d); g.fillStyle = (k / 24) % 2 ? '#fff' : (th.night ? '#00e5ff' : '#d8262f'); g.fillRect(-9, -5, 18, 10); g.restore(); }
    }
    if (open) { g.strokeStyle = sc; g.stroke(); }
  }
  return g.ops;
}
// ---- tiled scenery: bakeTrack records drawing ops once; 1024px tiles are replayed on demand ----
const TILE_PX = 1024, TILE_MAX = 30;
function makeRec() {
  const ops = [];
  return new Proxy({}, {
    get(t, k) {
      if (k === 'ops') return ops;
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a) => { const gr = { __g: 1, kind: k, a, stops: [] }; gr.addColorStop = (o, c) => gr.stops.push([o, c]); return gr; };
      return (...a) => { ops.push([0, k, a]); };
    },
    set(t, k, v) { ops.push([1, k, v]); return true; },
  });
}
function replay(g, ops) {
  const gm = new Map();
  for (const o of ops) {
    if (o[0]) { let v = o[2]; if (v && v.__g) { let r = gm.get(v); if (!r) { r = g[v.kind](...v.a); for (const s of v.stops) r.addColorStop(s[0], s[1]); gm.set(v, r); } v = r; } g[o[1]] = v; }
    else g[o[1]](...o[2]);
  }
}
function prepTiles(tr) { tr.ops = bakeTrack(tr); tr.TS = TILE_PX / tr.bs; tr.tiles = new Map(); tr.skids = []; tr.tick = 0; }
function tileXf(g, tr, tx, ty) { g.setTransform(tr.bs, 0, 0, tr.bs, -tx * tr.TS * tr.bs, -ty * tr.TS * tr.bs); }
function getTile(tr, tx, ty) {
  const key = tx + ',' + ty; let t = tr.tiles.get(key);
  if (t) { t.used = ++tr.tick; return t; }
  const c = document.createElement('canvas'); c.width = c.height = TILE_PX; const g = c.getContext('2d');
  tileXf(g, tr, tx, ty); replay(g, tr.ops); tileXf(g, tr, tx, ty);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.setLineDash([]); g.lineCap = 'round';
  for (const s of tr.skids) skidDraw(g, s);
  t = { c, g, tx, ty, used: ++tr.tick }; tr.tiles.set(key, t);
  if (tr.tiles.size > TILE_MAX) { let old = null; for (const v of tr.tiles.values()) if (!old || v.used < old.used) old = v; tr.tiles.delete(old.tx + ',' + old.ty); }
  return t;
}
function skidDraw(g, s) { g.strokeStyle = s[4]; g.lineWidth = 7; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke(); }
function addSkid(tr, x1, y1, x2, y2, st) {
  const s = [x1, y1, x2, y2, st]; tr.skids.push(s); if (tr.skids.length > 8000) tr.skids.shift();
  const seen = new Set();
  for (const [x, y] of [[x1, y1], [x2, y2]]) { const t = tr.tiles.get(Math.floor(x / tr.TS) + ',' + Math.floor(y / tr.TS)); if (t && !seen.has(t)) { seen.add(t); skidDraw(t.g, s); } }
}
function drawTiles(ctx, tr, sx, sy, sw, sh) {
  const T = tr.TS, x0 = Math.max(0, Math.floor(sx / T)), y0 = Math.max(0, Math.floor(sy / T)), x1 = Math.min(Math.ceil(tr.W / T) - 1, Math.floor((sx + sw) / T)), y1 = Math.min(Math.ceil(tr.H / T) - 1, Math.floor((sy + sh) / T));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) ctx.drawImage(getTile(tr, tx, ty).c, 0, 0, TILE_PX, TILE_PX, tx * T, ty * T, T + 1, T + 1);
  for (let ty = y0 - 1; ty <= y1 + 1; ty++) for (let tx = x0 - 1; tx <= x1 + 1; tx++) if (tx >= 0 && ty >= 0 && tx * T < tr.W && ty * T < tr.H && !tr.tiles.has(tx + ',' + ty)) { getTile(tr, tx, ty); return; }
}

function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function nearestFull(tr, x, y) { let bi = 0, bd = 1e18; for (let i = 0; i < tr.n; i += 3) { const p = tr.pts[i], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bi = i; } } return refine(tr, x, y, bi, 4); }
function refine(tr, x, y, hint, win) { let bi = hint, bd = 1e18; for (let k = -win; k <= win; k++) { const i = (hint + k + tr.n) % tr.n, p = tr.pts[i], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bi = i; } } return { i: bi, d: Math.sqrt(bd) }; }
function nearest(tr, x, y, hint) { const r = refine(tr, x, y, hint, 30); return r.d > tr.w * 1.6 ? nearestFull(tr, x, y) : r; }
function gridSlot(tr, s) { const i = (tr.n - 6 - Math.floor(s / 2) * 7) % tr.n, p = tr.pts[i], a = tr.dirs[i], side = s % 2 ? 1 : -1, off = side * tr.w * 0.22; return { x: p[0] - Math.sin(a) * off, y: p[1] + Math.cos(a) * off, a, i }; }
