export interface HomeAirportRotationState {
  queue: number[];
  completed: number[];
  round: number;
  started_at: number;
  interval_minutes: number;
}

function shuffle(ids: number[], random: () => number, previousLeader?: number): number[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === previousLeader) {
    const j = 1 + Math.floor(random() * (result.length - 1));
    [result[0], result[j]] = [result[j], result[0]];
  }
  return result;
}

/** Only the caller truncates the returned queue. Score and display limit never affect fairness. */
export function advanceHomeAirportRotation(
  previous: HomeAirportRotationState | null,
  candidateIds: number[],
  now: number,
  intervalMinutes: number,
  random: () => number = Math.random,
): HomeAirportRotationState {
  const candidates = [...new Set(candidateIds)];
  if (!previous) {
    return { queue: shuffle(candidates, random), completed: [], round: 1,
      started_at: now, interval_minutes: intervalMinutes };
  }
  const state = { ...previous, queue: [...previous.queue], completed: [...previous.completed] };
  const eligible = new Set(candidates);
  const known = new Set(state.queue);
  const completed = new Set(state.completed);
  const retained = state.queue.filter(id => eligible.has(id));
  const newcomers = shuffle(candidates.filter(id => !known.has(id)), random);
  // Preserve both the pending order and completion tombstones when an airport temporarily exits.
  state.queue = [
    ...retained.filter(id => !completed.has(id)),
    ...newcomers.filter(id => !completed.has(id)),
    ...retained.filter(id => completed.has(id)),
    ...newcomers.filter(id => completed.has(id)),
  ];
  if (state.interval_minutes !== intervalMinutes || state.queue[0] !== previous.queue[0]) {
    state.started_at = now;
    state.interval_minutes = intervalMinutes;
  }
  if (!state.queue.length) {
    state.started_at = now;
    return state;
  }
  if (state.queue.every(id => completed.has(id))) {
    state.queue = shuffle(state.queue, random, previous.queue[0]);
    state.completed = [];
    state.round++;
    state.started_at = now;
  }
  const duration = intervalMinutes * 60_000;
  let steps = Math.max(0, Math.floor((now - state.started_at) / duration));
  while (steps > 0) {
    // Skip whole inactive rounds without unbounded work after a long outage.
    if (state.completed.length === 0 && steps >= state.queue.length) {
      const rounds = Math.floor(steps / state.queue.length);
      const skipped = rounds * state.queue.length;
      state.round += rounds;
      state.started_at += skipped * duration;
      steps -= skipped;
      state.queue = shuffle(state.queue, random, state.queue[state.queue.length - 1]);
      continue;
    }
    const leader = state.queue.shift()!;
    state.queue.push(leader);
    state.completed.push(leader);
    state.started_at += duration;
    steps--;
    if (state.queue.every(id => state.completed.includes(id))) {
      state.queue = shuffle(state.queue, random, leader);
      state.completed = [];
      state.round++;
    }
  }
  return state;
}
