import { ArchiveScene } from './archive-format';

export interface ScenePosition {
  x: number;
  y: number;
}

const COLUMN_PITCH = 360;
const ROW_PITCH = 220;

export function autoLayoutScenes(
  scenes: Record<string, ArchiveScene>,
  startScene: string,
): Map<string, ScenePosition> {
  const depth = new Map<string, number>();
  const queue: string[] = [];

  if (scenes[startScene]) {
    depth.set(startScene, 0);
    queue.push(startScene);
  }

  while (queue.length > 0) {
    const key = queue.shift() as string;
    const currentDepth = depth.get(key) ?? 0;
    const scene = scenes[key];
    if (!scene) continue;
    for (const branch of scene.next ?? []) {
      const target = branch?.scene;
      if (!target || !scenes[target] || depth.has(target)) continue;
      depth.set(target, currentDepth + 1);
      queue.push(target);
    }
  }

  const reachableMax = depth.size > 0 ? Math.max(...depth.values()) : -1;
  for (const key of Object.keys(scenes)) {
    if (!depth.has(key)) depth.set(key, reachableMax + 1);
  }

  const rowByDepth = new Map<number, number>();
  const positions = new Map<string, ScenePosition>();
  for (const [key, sceneDepth] of depth) {
    const row = rowByDepth.get(sceneDepth) ?? 0;
    rowByDepth.set(sceneDepth, row + 1);
    positions.set(key, { x: sceneDepth * COLUMN_PITCH, y: row * ROW_PITCH });
  }

  return positions;
}
