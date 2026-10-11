import { GROUND } from './collision.js';

export const TIER_Y = [GROUND, 136, 88];

// sections: [x0, x1, a, b] = a tier-1 platform from x0..x1 with an optional
// tier-2 platform from a..b on top of it. Ladders are placed automatically.
// Stage layout and enemy mix follow the C64 Green Beret: the first two stages
// have no shooting enemies, guns arrive at the bridge. Wave entries can carry a
// side: 'kicker:R' enters from the right, 'bazooka:L' from the left.
export const STAGES = [
  {
    name: 'MISSILE BASE', style: 'base', seed: 11, len: 2560, border: 14, music: 0,
    brief: ['SLIP PAST THE LAUNCH PADS', 'AND MAKE FOR THE HARBOR'],
    sections: [[180, 560, 340, 540], [760, 1160, 900, 1100], [1340, 1700, 1460, 1660], [1900, 2420, 2060, 2260]],
    mines: [600, 670, 1210, 1280, 1750, 1830],
    weights: { runner: 6, kicker: 3 },
    events: [[120, 'officer'], [450, 'kickers'], [600, 'truck'], [880, 'officer'], [1250, 'kickers'], [1500, 'officer'], [1700, 'truck'], [2150, 'officer']],
    spawn: 66, pickup: ['flame'], truckCrew: ['runner', 'runner', 'kicker'],
    waveTruck: true,
    wave: ['runner', 'runner', 'kicker:R', 'runner', 'runner', 'kicker:R', 'runner', 'kicker', 'runner', 'runner', 'kicker:R', 'kicker'], waveName: 'TROOP TRUCK',
  },
  {
    name: 'HARBOR', style: 'harbor', seed: 22, len: 2560, border: 6, music: 1,
    brief: ['FIGHT ALONG THE DOCKS', 'TO THE RIVER BRIDGE'],
    sections: [[120, 440, 240, 400], [620, 1000, 720, 900], [1180, 1520, 1300, 1480], [1700, 2120, 1800, 2000], [2300, 2520, 2360, 2480]],
    mines: [540, 1080, 1600, 1670],
    weights: { runner: 5, kicker: 4 },
    events: [[150, 'officer'], [350, 'para'], [500, 'kickers'], [800, 'officer'], [950, 'para'], [1100, 'truck'], [1300, 'officer'], [1450, 'para'], [1600, 'kickers'], [1850, 'officer'], [2000, 'para'], [2100, 'truck']],
    spawn: 62, pickup: ['bazooka'], truckCrew: ['runner', 'kicker'],
    wave: ['handler:R', 'handler:L', 'dog:R', 'dog:L', 'handler:R', 'dog:L', 'handler:L', 'dog:R', 'dog:L', 'dog:R'], waveName: 'ATTACK DOGS',
  },
  {
    name: 'RIVER BRIDGE', style: 'bridge', seed: 33, len: 2560, border: 11, music: 2,
    brief: ['CROSS THE BRIDGE BY NIGHT', 'PAST THE AIRFIELD'],
    sections: [[100, 700, 250, 550], [860, 1500, 1000, 1350], [1640, 2200, 1760, 2050], [2300, 2540, 2340, 2500]],
    mines: [760, 830, 1560, 1630, 2260],
    weights: { runner: 3, rifle: 3, kicker: 3, bazooka: 1, mortar: 1 },
    events: [[150, 'officer'], [400, 'kickers'], [700, 'truck'], [950, 'officer'], [1250, 'kickers'], [1450, 'truck'], [1700, 'officer'], [2100, 'officer']],
    spawn: 60, pickup: ['grenade'], truckCrew: ['runner', 'rifle', 'kicker'],
    wavePickup: 'bazooka',
    wave: ['officer:R', 'heli:R', 'heli:L', 'runner', 'heli:R', 'heli:L', 'kicker', 'heli:R', 'heli:L'], waveName: 'HELICOPTERS',
  },
  {
    name: 'PRISON CAMP', style: 'camp', seed: 44, len: 2560, border: 5, music: 3,
    brief: ['STORM THE PRISON CAMP', 'AND FREE THE PRISONERS'],
    sections: [[160, 520, 300, 480], [700, 1060, 820, 980], [1240, 1600, 1360, 1540], [1780, 2160, 1880, 2060], [2300, 2520, 2340, 2460]],
    mines: [600, 670, 1140, 1680, 1750, 2220],
    weights: { runner: 3, kicker: 3, rifle: 2, bazooka: 1, mortar: 1, flamer: 1 },
    events: [[150, 'officer'], [450, 'kickers'], [750, 'officer'], [1000, 'truck'], [1250, 'kickers'], [1400, 'officer'], [1800, 'truck'], [2000, 'officer']],
    spawn: 56, pickup: ['flame', 'bazooka', 'grenade'], truckCrew: ['runner', 'rifle', 'kicker', 'bazooka'],
    wave: ['runner:L', 'kicker:R', 'bazooka:L', 'runner:R', 'mortar:L', 'kicker:R', 'runner:L', 'bazooka:L', 'kicker:R', 'mortar:R', 'runner:R', 'kicker:R'], waveName: 'CAMP GARRISON',
  },
];

export function buildLevel(def) {
  const surfaces = [{ y: GROUND, x0: -200, x1: def.len + 200 }];
  const ladders = [];
  for (const [x0, x1, a, b] of def.sections) {
    surfaces.push({ y: TIER_Y[1], x0, x1 });
    ladders.push({ x: x0 + 20, top: TIER_Y[1], bot: GROUND });
    ladders.push({ x: x1 - 20, top: TIER_Y[1], bot: GROUND });
    if (a !== undefined) {
      surfaces.push({ y: TIER_Y[2], x0: a, x1: b });
      ladders.push({ x: a + 16, top: TIER_Y[2], bot: TIER_Y[1] });
      ladders.push({ x: b - 16, top: TIER_Y[2], bot: TIER_Y[1] });
    }
  }
  return { len: def.len, surfaces, ladders };
}
