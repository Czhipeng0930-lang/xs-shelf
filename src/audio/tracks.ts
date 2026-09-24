import type { Drum, Track } from './chiptune';

const _ = 0;

/** 把每小节 16 步的片段拼成一条完整循环 */
function line(...bars: number[][]): number[] {
  return bars.flat();
}

function beat(...bars: Drum[][]): Drum[] {
  return bars.flat();
}

/** 四分音符走根音 + 八度跳 + 五度 */
function bassBar(root: number): number[] {
  return [root, _, _, _, root, _, _, _, root + 12, _, _, _, root, _, root + 7, _];
}

const GROOVE: Drum[] = ['k', '', 'h', '', 's', '', 'h', '', 'k', '', 'h', 'k', 's', '', 'h', 'h'];
const GROOVE_OPEN: Drum[] = ['k', '', 'h', '', 's', '', 'h', '', 'k', '', 'h', 'k', 's', '', 'o', ''];
const DRIVE: Drum[] = ['k', 'h', 'h', 'h', 's', 'h', 'h', 'h', 'k', 'h', 'k', 'h', 's', 'h', 'o', 'h'];

/** 菜单：明亮上扬的开张曲 */
export const TRACK_MENU: Track = {
  id: 'menu',
  name: '霓虹开张',
  bpm: 122,
  duty: 0.25,
  lead: line(
    [72, _, _, 79, _, 76, _, _, 72, _, 74, _, 76, _, _, _],
    [69, _, _, 76, _, 72, _, _, 69, _, 71, _, 72, _, _, _],
    [77, _, _, 72, _, 69, _, _, 65, _, 67, _, 69, _, _, _],
    [74, _, 79, _, _, 76, _, 74, 71, _, 74, _, 79, _, _, _],
  ),
  arp: line(
    [_, 60, _, 64, _, 67, _, 64, _, 60, _, 64, _, 67, _, 64],
    [_, 57, _, 60, _, 64, _, 60, _, 57, _, 60, _, 64, _, 60],
    [_, 53, _, 57, _, 60, _, 57, _, 53, _, 57, _, 60, _, 57],
    [_, 55, _, 59, _, 62, _, 59, _, 55, _, 59, _, 62, _, 67],
  ),
  bass: line(bassBar(48), bassBar(45), bassBar(41), bassBar(43)),
  drums: beat(GROOVE, GROOVE, GROOVE, GROOVE_OPEN),
};

/** 摆货：慢一点、稳一点，方便动脑 */
export const TRACK_BUILD: Track = {
  id: 'build',
  name: '摆货时间',
  bpm: 104,
  duty: 0.125,
  gain: 0.85,
  lead: line(
    [69, _, _, 72, _, _, 76, _, 74, _, _, 72, _, _, _, _],
    [65, _, _, 69, _, _, 72, _, 69, _, _, 67, _, _, _, _],
    [64, _, _, 67, _, _, 72, _, 76, _, _, 74, _, _, _, _],
    [67, _, 69, _, 71, _, 74, _, 72, _, _, _, 67, _, _, _],
  ),
  arp: line(
    [_, _, 57, _, _, _, 60, _, _, _, 64, _, _, _, 60, _],
    [_, _, 53, _, _, _, 57, _, _, _, 60, _, _, _, 57, _],
    [_, _, 48, _, _, _, 52, _, _, _, 55, _, _, _, 52, _],
    [_, _, 55, _, _, _, 59, _, _, _, 62, _, _, _, 59, _],
  ),
  bass: line(bassBar(45), bassBar(41), bassBar(36), bassBar(43)),
  drums: beat(GROOVE, GROOVE, GROOVE, GROOVE_OPEN),
};

/** 营业：开门放客人进来，节奏拉满 */
export const TRACK_RUSH: Track = {
  id: 'rush',
  name: '营业高峰',
  bpm: 148,
  duty: 0.5,
  lead: line(
    [81, _, 79, _, 76, _, 79, _, 81, _, 84, _, 81, _, 79, _],
    [79, _, 76, _, 74, _, 76, _, 79, _, 83, _, 79, _, 76, _],
    [77, _, 74, _, 72, _, 74, _, 77, _, 81, _, 77, _, 74, _],
    [76, _, 79, _, 81, _, 84, _, 88, _, 84, _, 81, _, 79, _],
  ),
  arp: line(
    [69, 72, 76, 72, 69, 72, 76, 72, 69, 72, 76, 72, 69, 72, 76, 72],
    [67, 71, 74, 71, 67, 71, 74, 71, 67, 71, 74, 71, 67, 71, 74, 71],
    [65, 69, 72, 69, 65, 69, 72, 69, 65, 69, 72, 69, 65, 69, 72, 69],
    [64, 68, 71, 68, 64, 68, 71, 68, 64, 68, 71, 68, 64, 68, 71, 76],
  ),
  bass: line(bassBar(45), bassBar(43), bassBar(41), bassBar(40)),
  drums: beat(DRIVE, DRIVE, DRIVE, DRIVE),
};

/** 打烊：慢一拍的 8-bit 夜曲 */
export const TRACK_NIGHT: Track = {
  id: 'night',
  name: '打烊夜曲',
  bpm: 86,
  duty: 0.125,
  gain: 0.7,
  lead: line(
    [64, _, _, 67, _, 71, _, _, 72, _, _, 71, _, 67, _, _],
    [69, _, _, 72, _, 76, _, _, 74, _, _, 72, _, 69, _, _],
    [67, _, _, 71, _, 74, _, _, 72, _, 69, _, 67, _, _, _],
    [64, _, 67, _, 69, _, 72, _, 71, _, _, _, 64, _, _, _],
  ),
  arp: line(
    [_, 52, _, 55, _, 59, _, 55, _, 52, _, 55, _, 59, _, 55],
    [_, 53, _, 57, _, 60, _, 57, _, 53, _, 57, _, 60, _, 57],
    [_, 55, _, 59, _, 62, _, 59, _, 55, _, 59, _, 62, _, 59],
    [_, 52, _, 55, _, 59, _, 55, _, 48, _, 52, _, 55, _, 52],
  ),
  bass: line(bassBar(40), bassBar(41), bassBar(43), bassBar(36)),
  drums: beat(GROOVE, GROOVE, GROOVE, GROOVE_OPEN),
};

export const TRACKS = { menu: TRACK_MENU, build: TRACK_BUILD, rush: TRACK_RUSH, night: TRACK_NIGHT } as const;
export type TrackId = keyof typeof TRACKS;
