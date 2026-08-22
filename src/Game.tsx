'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const DIR_BITS = [1, 2, 4, 8];
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];
const DIR_NAMES = ['上', '右', '下', '左'];

type Rank = '入门' | '进阶' | '烧脑' | '大师';
type Level = { name: string; size: number; seed: number; loops: number; hints: number; rank: Rank };

const LEVELS: Level[] = [
  { name: '初见灯火', size: 4, seed: 1207, loops: 0, hints: 3, rank: '入门' },
  { name: '巷口微光', size: 4, seed: 2311, loops: 1, hints: 3, rank: '入门' },
  { name: '纸窗灯影', size: 5, seed: 3421, loops: 1, hints: 3, rank: '入门' },
  { name: '长街入夜', size: 5, seed: 4513, loops: 2, hints: 3, rank: '进阶' },
  { name: '星落小城', size: 5, seed: 5623, loops: 3, hints: 3, rank: '进阶' },
  { name: '月照回廊', size: 6, seed: 6737, loops: 2, hints: 3, rank: '进阶' },
  { name: '万家灯明', size: 6, seed: 7841, loops: 4, hints: 3, rank: '进阶' },
  { name: '风过灯河', size: 6, seed: 8951, loops: 5, hints: 3, rank: '进阶' },
  { name: '山城夜行', size: 6, seed: 9067, loops: 6, hints: 3, rank: '烧脑' },
  { name: '灯海寻路', size: 6, seed: 10177, loops: 7, hints: 3, rank: '烧脑' },
  { name: '雾隐千桥', size: 7, seed: 11287, loops: 5, hints: 3, rank: '烧脑' },
  { name: '流光迷城', size: 7, seed: 12391, loops: 7, hints: 3, rank: '烧脑' },
  { name: '九曲星河', size: 7, seed: 13513, loops: 8, hints: 3, rank: '烧脑' },
  { name: '千门同辉', size: 7, seed: 14621, loops: 10, hints: 3, rank: '大师' },
  { name: '天灯成阵', size: 7, seed: 15733, loops: 12, hints: 3, rank: '大师' },
  { name: '人间长明', size: 7, seed: 16843, loops: 14, hints: 3, rank: '大师' },
];

type GameData = {
  masks: number[];
  initialRotations: number[];
  source: number;
  optimal: number;
  fixedCount: number;
};

function randomFromSeed(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function rotateMask(mask: number, turns: number) {
  let current = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i += 1) {
    current = ((current << 1) & 15) | ((current >> 3) & 1);
  }
  return current;
}

function stepsToSolution(mask: number, rotation: number) {
  for (let steps = 0; steps <= 2; steps += 1) {
    if (rotateMask(mask, rotation + steps) === mask || rotateMask(mask, rotation - steps) === mask) return steps;
  }
  return 0;
}

function shortestDeltaToSolution(mask: number, rotation: number) {
  if (rotateMask(mask, rotation) === mask) return 0;
  for (let steps = 1; steps <= 2; steps += 1) {
    if (rotateMask(mask, rotation + steps) === mask) return steps;
    if (rotateMask(mask, rotation - steps) === mask) return -steps;
  }
  return 0;
}

function countDirections(mask: number) {
  return DIR_BITS.reduce((count, bit) => count + (mask & bit ? 1 : 0), 0);
}

function createGame(levelIndex: number): GameData {
  const level = LEVELS[levelIndex];
  const { size, seed } = level;
  const random = randomFromSeed(seed);
  const total = size * size;
  const masks = Array(total).fill(0) as number[];
  const visited = new Set<number>([0]);
  const stack = [0];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const row = Math.floor(current / size);
    const col = current % size;
    const options: { next: number; direction: number }[] = [];

    for (let direction = 0; direction < 4; direction += 1) {
      const nextRow = row + DR[direction];
      const nextCol = col + DC[direction];
      const next = nextRow * size + nextCol;
      if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size && !visited.has(next)) {
        options.push({ next, direction });
      }
    }

    if (!options.length) {
      stack.pop();
      continue;
    }

    const pick = options[Math.floor(random() * options.length)];
    masks[current] |= DIR_BITS[pick.direction];
    masks[pick.next] |= DIR_BITS[(pick.direction + 2) % 4];
    visited.add(pick.next);
    stack.push(pick.next);
  }

  const loopCandidates: { from: number; to: number; direction: number }[] = [];
  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / size);
    const col = index % size;
    for (const direction of [1, 2]) {
      const nextRow = row + DR[direction];
      const nextCol = col + DC[direction];
      if (nextRow >= size || nextCol >= size) continue;
      const next = nextRow * size + nextCol;
      if (!(masks[index] & DIR_BITS[direction])) loopCandidates.push({ from: index, to: next, direction });
    }
  }

  for (let i = loopCandidates.length - 1; i > 0; i -= 1) {
    const swap = Math.floor(random() * (i + 1));
    [loopCandidates[i], loopCandidates[swap]] = [loopCandidates[swap], loopCandidates[i]];
  }
  loopCandidates.slice(0, level.loops).forEach(({ from, to, direction }) => {
    masks[from] |= DIR_BITS[direction];
    masks[to] |= DIR_BITS[(direction + 2) % 4];
  });

  const center = (size - 1) / 2;
  const sourceCandidates = masks
    .map((mask, index) => ({
      index,
      degree: countDirections(mask),
      distance: Math.abs(Math.floor(index / size) - center) + Math.abs((index % size) - center),
    }))
    .filter(({ degree }) => degree < 4)
    .sort((a, b) => a.degree - b.degree || a.distance - b.distance || a.index - b.index);

  let initialRotations: number[] = [];
  let source = sourceCandidates[0].index;
  let smallestOpening = Number.POSITIVE_INFINITY;
  searchOpening:
  for (let attempt = 0; attempt < 512; attempt += 1) {
    const candidate = masks.map((mask) => {
      const wrongRotations = [1, 2, 3].filter((rotation) => rotateMask(mask, rotation) !== mask);
      return wrongRotations.length ? wrongRotations[Math.floor(random() * wrongRotations.length)] : 0;
    });
    for (const sourceCandidate of sourceCandidates) {
      const openingLit = connectedTiles(masks, candidate, size, sourceCandidate.index).size;
      if (openingLit < smallestOpening) {
        initialRotations = candidate;
        source = sourceCandidate.index;
        smallestOpening = openingLit;
      }
      if (openingLit === 1) break searchOpening;
    }
  }
  const optimal = initialRotations.reduce((sum, rotation, index) => sum + stepsToSolution(masks[index], rotation), 0);

  return {
    masks,
    initialRotations,
    source,
    optimal,
    fixedCount: masks.filter((mask) => mask === 15).length,
  };
}

function connectedTiles(masks: number[], rotations: number[], size: number, source: number) {
  const lit = new Set<number>([source]);
  const queue = [source];

  while (queue.length) {
    const current = queue.shift()!;
    const row = Math.floor(current / size);
    const col = current % size;
    const mask = rotateMask(masks[current], rotations[current]);

    for (let direction = 0; direction < 4; direction += 1) {
      if (!(mask & DIR_BITS[direction])) continue;
      const nextRow = row + DR[direction];
      const nextCol = col + DC[direction];
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
      const next = nextRow * size + nextCol;
      const nextMask = rotateMask(masks[next], rotations[next]);
      if ((nextMask & DIR_BITS[(direction + 2) % 4]) && !lit.has(next)) {
        lit.add(next);
        queue.push(next);
      }
    }
  }
  return lit;
}

function hasNoBrokenEdges(masks: number[], rotations: number[], size: number) {
  return masks.every((mask, index) => {
    const current = rotateMask(mask, rotations[index]);
    const row = Math.floor(index / size);
    const col = index % size;
    for (let direction = 0; direction < 4; direction += 1) {
      if (!(current & DIR_BITS[direction])) continue;
      const nextRow = row + DR[direction];
      const nextCol = col + DC[direction];
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) return false;
      const next = nextRow * size + nextCol;
      if (!(rotateMask(masks[next], rotations[next]) & DIR_BITS[(direction + 2) % 4])) return false;
    }
    return true;
  });
}

function findBrokenTiles(masks: number[], rotations: number[], size: number) {
  const broken = new Set<number>();
  masks.forEach((mask, index) => {
    const current = rotateMask(mask, rotations[index]);
    const row = Math.floor(index / size);
    const col = index % size;
    for (let direction = 0; direction < 4; direction += 1) {
      if (!(current & DIR_BITS[direction])) continue;
      const nextRow = row + DR[direction];
      const nextCol = col + DC[direction];
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
        broken.add(index);
        continue;
      }
      const next = nextRow * size + nextCol;
      if (!(rotateMask(masks[next], rotations[next]) & DIR_BITS[(direction + 2) % 4])) {
        broken.add(index);
        broken.add(next);
      }
    }
  });
  return broken;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function Home() {
  const [coverVisible, setCoverVisible] = useState(true);
  const [coverLeaving, setCoverLeaving] = useState(false);
  const [coverPoint, setCoverPoint] = useState({ x: 0, y: 0 });
  const [levelIndex, setLevelIndex] = useState(0);
  const [game, setGame] = useState<GameData>(() => createGame(0));
  const [rotations, setRotations] = useState(game.initialRotations);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [hints, setHints] = useState(LEVELS[0].hints);
  const [rotationDirection, setRotationDirection] = useState<1 | -1>(1);
  const [scanAvailable, setScanAvailable] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [won, setWon] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [pulseTile, setPulseTile] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [completedThrough, setCompletedThrough] = useState(1);
  const [bestTimes, setBestTimes] = useState<Record<number, number>>({});
  const lastLitCount = useRef(1);
  const level = LEVELS[levelIndex];
  const threeStarLimit = game.optimal + Math.ceil(level.size / 2);
  const twoStarLimit = threeStarLimit + Math.ceil(game.optimal * 0.3) + level.size;
  const moveLimit = twoStarLimit + Math.ceil(game.optimal * 0.35) + level.size;

  useEffect(() => {
    try {
      const savedCompleted = Number(localStorage.getItem('lamp-link-unlocked') || 1);
      const savedTimes = JSON.parse(localStorage.getItem('lamp-link-times') || '{}') as Record<number, number>;
      setCompletedThrough(Math.max(1, Math.min(LEVELS.length, savedCompleted)));
      setBestTimes(savedTimes);
    } catch {
      // The game remains fully playable when device storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = coverVisible ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [coverVisible]);

  useEffect(() => {
    if (!started || won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, won]);

  const lit = useMemo(
    () => connectedTiles(game.masks, rotations, level.size, game.source),
    [game, rotations, level.size],
  );
  const broken = useMemo(
    () => scanning ? findBrokenTiles(game.masks, rotations, level.size) : new Set<number>(),
    [game, level.size, rotations, scanning],
  );

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 1300);
  }, []);

  const leaveCover = (openLevels = false) => {
    if (coverLeaving) return;
    setCoverLeaving(true);
    vibrate([18, 34, 22]);
    window.setTimeout(() => {
      setCoverVisible(false);
      setCoverLeaving(false);
      if (openLevels) setShowLevels(true);
    }, 820);
  };

  useEffect(() => {
    const delta = lit.size - lastLitCount.current;
    if (started && delta >= 4) {
      showToast(delta >= 9 ? '灯河奔涌 · 连亮九盏' : `灯路贯通 · 连亮 ${delta} 盏`);
      vibrate([10, 24, 14]);
    }
    lastLitCount.current = lit.size;
  }, [lit.size, showToast, started, vibrate]);

  const loadLevel = useCallback((nextLevel: number) => {
    const nextGame = createGame(nextLevel);
    setLevelIndex(nextLevel);
    setGame(nextGame);
    setRotations(nextGame.initialRotations);
    setMoves(0);
    setSeconds(0);
    setHints(LEVELS[nextLevel].hints);
    setRotationDirection(1);
    setScanAvailable(true);
    setScanning(false);
    setWon(false);
    setFailed(false);
    setStarted(false);
    setShowLevels(false);
  }, []);

  const finishLevel = useCallback((finalSeconds: number) => {
    setWon(true);
    const nextCompleted = Math.min(LEVELS.length, Math.max(completedThrough, levelIndex + 2));
    const nextTimes = { ...bestTimes };
    if (!nextTimes[levelIndex] || finalSeconds < nextTimes[levelIndex]) nextTimes[levelIndex] = finalSeconds;
    setCompletedThrough(nextCompleted);
    setBestTimes(nextTimes);
    try {
      localStorage.setItem('lamp-link-unlocked', String(nextCompleted));
      localStorage.setItem('lamp-link-times', JSON.stringify(nextTimes));
    } catch {
      // Saving progress is optional.
    }
  }, [bestTimes, completedThrough, levelIndex]);

  const resolveMove = useCallback((next: number[], nextMoves: number) => {
    const nextLit = connectedTiles(game.masks, next, level.size, game.source);
    if (nextLit.size === game.masks.length && hasNoBrokenEdges(game.masks, next, level.size)) {
      window.setTimeout(() => finishLevel(seconds), 300);
    } else if (nextMoves >= moveLimit) {
      window.setTimeout(() => setFailed(true), 300);
    }
  }, [finishLevel, game, level.size, moveLimit, seconds]);

  const turnTile = (index: number) => {
    if (won || failed || game.masks[index] === 15) return;
    vibrate(8);
    setPulseTile(null);
    window.requestAnimationFrame(() => setPulseTile(index));
    window.setTimeout(() => setPulseTile((current) => current === index ? null : current), 440);
    const nextMoves = moves + 1;
    setStarted(true);
    setRotations((current) => {
      const next = current.map((rotation, tileIndex) => tileIndex === index ? rotation + rotationDirection : rotation);
      resolveMove(next, nextMoves);
      return next;
    });
    setMoves(nextMoves);
  };

  const resetLevel = () => {
    setRotations(game.initialRotations);
    setMoves(0);
    setSeconds(0);
    setHints(level.hints);
    setRotationDirection(1);
    setScanAvailable(true);
    setScanning(false);
    setWon(false);
    setFailed(false);
    setStarted(false);
  };

  const useHint = () => {
    if (!hints || won || failed) return;
    vibrate([12, 28, 12]);
    showToast('灵犀一点 · 已扶正一盏');
    const wrong = rotations
      .map((rotation, index) => rotateMask(game.masks[index], rotation) === game.masks[index] ? -1 : index)
      .filter((index) => index >= 0);
    if (!wrong.length) return;
    const index = wrong[(moves + levelIndex) % wrong.length];
    const nextMoves = moves + 1;
    setRotations((current) => {
      const next = current.map((rotation, tileIndex) => tileIndex === index ? rotation + shortestDeltaToSolution(game.masks[index], rotation) : rotation);
      resolveMove(next, nextMoves);
      return next;
    });
    setHints((value) => value - 1);
    setMoves(nextMoves);
    setStarted(true);
  };

  const useScan = () => {
    if (!scanAvailable || won || failed) return;
    vibrate([8, 36, 8, 36, 16]);
    showToast('寻隙巡灯 · 断口显形');
    setScanAvailable(false);
    setScanning(true);
    window.setTimeout(() => setScanning(false), 2400);
  };

  const baseStars = moves <= threeStarLimit ? 3 : moves <= twoStarLimit ? 2 : 1;
  const stars = baseStars;
  const progress = Math.round((lit.size / game.masks.length) * 100);
  const challengeText = level.loops
    ? `${level.loops} 条环路 · ${game.fixedCount ? `${game.fixedCount} 座四向灯塔 · ` : ''}${level.hints} 次提示`
    : `单线网络 · ${level.hints} 次提示`;

  return (
    <main className="game-shell">
      {coverVisible && (
        <section
          className={`cover-gate ${coverLeaving ? 'is-leaving' : ''}`}
          aria-label="灯火相连游戏封面"
          style={{ '--mx': `${coverPoint.x}px`, '--my': `${coverPoint.y}px` } as CSSProperties}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setCoverPoint({
              x: ((event.clientX - box.left) / box.width - 0.5) * 18,
              y: ((event.clientY - box.top) / box.height - 0.5) * 14,
            });
          }}
          onPointerLeave={() => setCoverPoint({ x: 0, y: 0 })}
        >
          <div className="cover-art" aria-hidden="true" />
          <div className="cover-ink" aria-hidden="true" />
          <div className="cover-cloud cloud-one" aria-hidden="true" />
          <div className="cover-cloud cloud-two" aria-hidden="true" />
          <div className="cover-lanterns" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <div className="cover-fireflies" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
          </div>
          <div className="cover-frame" aria-hidden="true"><i /><i /><i /><i /></div>

          <div className="cover-content">
            <p className="cover-overline"><span /> 上元灯录 · 第壹卷 <span /></p>
            <div className="cover-title" aria-label="灯火相连">
              <span>灯火</span><span>相连</span>
              <b aria-hidden="true">谜</b>
            </div>
            <p className="cover-poem">一盏照归途，万灯连人间</p>
            <div className="cover-rule" aria-hidden="true"><i /><b>◆</b><i /></div>
            <p className="cover-lead">转动灯路 · 接通古城 · 在步数燃尽前点亮长夜</p>
            <button className="enter-city" type="button" onClick={() => leaveCover(false)}>
              <span className="enter-flame" aria-hidden="true"><i /></span>
              <strong>点灯入城</strong>
              <small>轻触开启灯火长卷</small>
            </button>
            <button className="cover-level-link" type="button" onClick={() => leaveCover(true)}>先览十六卷灯阵 <span>›</span></button>
          </div>

          <p className="cover-foot"><span>◈</span> 无需登录 · 即点即玩 · 自动保存进度 <span>◈</span></p>
        </section>
      )}

      <div className="ambient" aria-hidden="true"><i /><i /><i /><span /><span /><span /></div>

      {toast && <div className="game-toast" role="status"><span>✦</span>{toast}<span>✦</span></div>}

      <header className="topbar">
        <button className="brand-mark" type="button" onClick={() => setCoverVisible(true)} aria-label="返回游戏封面"><span>灯</span></button>
        <div className="brand-copy">
          <p className="eyebrow">上元灯录 · 灯路谜阵</p>
          <h1>灯火相连</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => setShowHelp(true)} aria-label="打开游戏说明">?</button>
      </header>

      <section className="intro">
        <div className="chapter-row">
          <div className="badge-row">
            <span className={`rank-badge rank-${level.rank}`}>{level.rank}</span>
            <span className="level-label">第 {levelIndex + 1} 关 · {level.name}</span>
          </div>
          <button type="button" className="level-link" onClick={() => setShowLevels(true)}>16 关自由选</button>
        </div>
        <h2>接通整座<span>不夜城</span></h2>
        <p>{challengeText}。旋转灯路，让每一束光严丝合缝。</p>
      </section>

      <section className="status-strip" aria-label="本局状态">
        <div><span>棋盘</span><strong>{level.size}×{level.size}</strong></div>
        <div><span>已点亮</span><strong>{lit.size}<em>/{game.masks.length}</em></strong></div>
        <div><span>用时</span><strong>{formatTime(seconds)}</strong></div>
        <div><span>步数上限</span><strong>{moves}<em>/{moveLimit}</em></strong></div>
      </section>

      <section className={`board-card board-${level.rank} ${scanning ? 'is-scanning-board' : ''}`} aria-label={`${level.name}游戏盘，已完成 ${progress}%`}>
        <div className="board-aura" aria-hidden="true" />
        <div className="scan-sweep" aria-hidden="true" />
        <div className="board" style={{ '--size': level.size } as CSSProperties}>
          {game.masks.map((solutionMask, index) => {
            const mask = rotateMask(solutionMask, rotations[index]);
            const directions = DIR_NAMES.filter((_, direction) => mask & DIR_BITS[direction]).join('、');
            const isLit = lit.has(index);
            const isFixed = solutionMask === 15;
            return (
              <button
                key={`${levelIndex}-${index}`}
                type="button"
                disabled={isFixed}
                className={`tile ${isLit ? 'is-lit' : ''} ${index === game.source ? 'is-source' : ''} ${isFixed ? 'is-fixed' : ''} ${broken.has(index) ? 'is-broken' : ''} ${pulseTile === index ? 'is-pulsing' : ''}`}
                aria-label={isFixed ? `第 ${Math.floor(index / level.size) + 1} 行第 ${(index % level.size) + 1} 列，四向灯塔无需旋转` : `第 ${Math.floor(index / level.size) + 1} 行第 ${(index % level.size) + 1} 列，灯路朝${directions}，${isLit ? '已点亮' : '未点亮'}，点击${rotationDirection === 1 ? '顺' : '逆'}时针旋转`}
                onClick={() => turnTile(index)}
              >
                <span className="tile-shine" aria-hidden="true" />
                <span className="pipe" style={{ transform: `rotate(${rotations[index] * 90}deg)` }} aria-hidden="true">
                  {!!(solutionMask & 1) && <i className="arm arm-n" />}
                  {!!(solutionMask & 2) && <i className="arm arm-e" />}
                  {!!(solutionMask & 4) && <i className="arm arm-s" />}
                  {!!(solutionMask & 8) && <i className="arm arm-w" />}
                </span>
                <b className="lantern" aria-hidden="true">{index === game.source ? '火' : isFixed ? '◇' : ''}</b>
              </button>
            );
          })}
        </div>
        <div className="board-progress">
          <span>灯火同步率</span>
          <div className="progress-track" role="progressbar" aria-label="灯火同步率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
          <strong>{progress}%</strong>
        </div>
        <div className="grade-strip" aria-label={`星级标准：${threeStarLimit}步以内三星，${twoStarLimit}步以内二星，最多${moveLimit}步`}>
          <div className="grade-copy">
            <span><b>★★★</b> ≤ {threeStarLimit}</span>
            <span><b>★★</b> ≤ {twoStarLimit}</span>
            <span><b>上限</b> {moveLimit} 步</span>
          </div>
          <button className={`scan-button ${scanning ? 'is-scanning' : ''}`} type="button" onClick={useScan} disabled={!scanAvailable}>{scanning ? '扫描中…' : scanAvailable ? '扫描断口 ×1' : '扫描已用'}</button>
        </div>
      </section>

      <div className="action-row">
        <button className="text-button" type="button" onClick={resetLevel}><span aria-hidden="true">↶</span> 重置</button>
        <button className="direction-button" type="button" onClick={() => { vibrate(10); setRotationDirection((value) => value === 1 ? -1 : 1); showToast(rotationDirection === 1 ? '风向已逆转' : '风向已顺转'); }} aria-label={`当前${rotationDirection === 1 ? '顺时针' : '逆时针'}旋转，点击切换`}><span aria-hidden="true">{rotationDirection === 1 ? '↻' : '↺'}</span> {rotationDirection === 1 ? '顺转' : '逆转'}</button>
        <button className="primary-button" type="button" onClick={useHint} disabled={!hints}>点亮提示 <small>{hints}</small></button>
      </div>
      <p className="footer-note"><span /> 每关 3 次提示，使用提示不会影响星级 <span /></p>

      {showHelp && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowHelp(false)} aria-label="关闭">×</button>
            <p className="modal-kicker">四步学会 · 后期烧脑</p>
            <h2 id="help-title">如何点亮全城？</h2>
            <ol className="rules">
              <li><b>01</b><div><strong>旋转灯路</strong><span>轻点方块，顺时针旋转 90°</span></div></li>
              <li><b>02</b><div><strong>消灭断口</strong><span>相邻灯路必须精确对齐，边缘不能朝外</span></div></li>
              <li><b>03</b><div><strong>破解环路</strong><span>烧脑关含多重环路与四向灯塔，局部对不代表全局对</span></div></li>
              <li><b>04</b><div><strong>控制步数</strong><span>可切换顺转与逆转；扫描会标出断口，每关 3 次提示且不会扣星</span></div></li>
            </ol>
            <button className="primary-button full-button" type="button" onClick={() => setShowHelp(false)}>进入灯路谜阵</button>
          </section>
        </div>
      )}

      {showLevels && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowLevels(false)}>
          <section className="modal level-modal" role="dialog" aria-modal="true" aria-labelledby="levels-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowLevels(false)} aria-label="关闭">×</button>
            <p className="modal-kicker">灯火长卷 · 全部开放</p>
            <h2 id="levels-title">选择挑战强度</h2>
            <div className="level-grid">
              {LEVELS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={`${index === levelIndex ? 'current' : ''} ${index < completedThrough - 1 ? 'is-cleared' : ''}`}
                  onClick={() => loadLevel(index)}
                  aria-label={`进入第 ${index + 1} 关 ${item.name}，难度${item.rank}，${item.size}乘${item.size}`}
                >
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <span>{item.name}</span>
                  <small>{item.rank} · {item.size}×{item.size}{bestTimes[index] ? ` · ${formatTime(bestTimes[index])}` : ''}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {won && (
        <div className="modal-backdrop win-backdrop" role="presentation">
          <div className="victory-rays" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
          <section className="modal win-modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
            <div className="win-seal" aria-hidden="true">通</div>
            <p className="modal-kicker">LIGHT NETWORK COMPLETE</p>
            <h2 id="win-title">整座城，为你亮起</h2>
            <div className="stars" aria-label={`获得 ${stars} 颗星`}>{'★'.repeat(stars)}<span>{'★'.repeat(3 - stars)}</span></div>
            <div className="win-stats">
              <div><span>通关用时</span><strong>{formatTime(seconds)}</strong></div>
              <div><span>旋转步数</span><strong>{moves}</strong></div>
            </div>
            {levelIndex < LEVELS.length - 1 ? (
              <button className="primary-button full-button" type="button" onClick={() => loadLevel(levelIndex + 1)}>下一关 · {LEVELS[levelIndex + 1].name}</button>
            ) : (
              <button className="primary-button full-button" type="button" onClick={() => loadLevel(0)}>再走一遍灯火长卷</button>
            )}
            <button className="text-button full-button" type="button" onClick={resetLevel}>重玩本关</button>
          </section>
        </div>
      )}

      {failed && !won && (
        <div className="modal-backdrop fail-backdrop" role="presentation">
          <section className="modal fail-modal" role="dialog" aria-modal="true" aria-labelledby="fail-title">
            <div className="fail-icon" aria-hidden="true">熄</div>
            <p className="modal-kicker">MOVE LIMIT REACHED</p>
            <h2 id="fail-title">灯火暂时熄灭了</h2>
            <p>本关上限为 {moveLimit} 步。试着先从边缘与单出口灯路推理，再处理中央环路。</p>
            <div className="grade-summary">
              <span>三星 ≤ {threeStarLimit}</span><span>二星 ≤ {twoStarLimit}</span><span>本局 {moves} 步</span>
            </div>
            <button className="primary-button full-button" type="button" onClick={resetLevel}>重新挑战</button>
            <button className="text-button full-button" type="button" onClick={() => { setFailed(false); setShowLevels(true); }}>换一关</button>
          </section>
        </div>
      )}
    </main>
  );
}

