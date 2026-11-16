export const VOICE_PACK_TASK_ID = 'human-voice-pack';

export function createIdleTask(id = VOICE_PACK_TASK_ID, label = 'Human Voice Pack') {
  return {
    id,
    label,
    phase: 'idle',
    completed: 0,
    total: 0,
    percent: 0,
    message: '',
    readyUnread: false,
  };
}

export function getLoadingTask(tasks, id = VOICE_PACK_TASK_ID) {
  return tasks?.[id] || createIdleTask(id);
}

export function beginLoadingTask(tasks, id, { label = 'Human Voice Pack', total = 0, message = '' } = {}) {
  return {
    ...tasks,
    [id]: {
      id,
      label,
      phase: 'loading',
      completed: 0,
      total,
      percent: 0,
      message: message || `Preparing ${label}…`,
      readyUnread: false,
    },
  };
}

export function progressLoadingTask(tasks, id, { completed = 0, total = 0, message = '' } = {}) {
  const prev = getLoadingTask(tasks, id);
  const safeTotal = total || prev.total || 1;
  const safeDone = Math.min(Math.max(completed, 0), safeTotal);
  const percent = Math.min(100, Math.round((safeDone / safeTotal) * 100));
  return {
    ...tasks,
    [id]: {
      ...prev,
      phase: 'loading',
      completed: safeDone,
      total: safeTotal,
      percent,
      message: message || `Loading ${prev.label}… ${percent}% (${safeDone}/${safeTotal})`,
      readyUnread: false,
    },
  };
}

export function completeLoadingTask(tasks, id, { total, message = '', notify = true } = {}) {
  const prev = getLoadingTask(tasks, id);
  const finalTotal = total ?? prev.total;
  return {
    ...tasks,
    [id]: {
      ...prev,
      phase: 'ready',
      completed: finalTotal,
      total: finalTotal,
      percent: 100,
      message: message || `${prev.label} loaded & cached — ready to switch!`,
      readyUnread: Boolean(notify),
    },
  };
}

export function failLoadingTask(tasks, id, errorMessage = 'Failed to load audio pack.') {
  const prev = getLoadingTask(tasks, id);
  return {
    ...tasks,
    [id]: {
      ...prev,
      phase: 'error',
      message: errorMessage,
      readyUnread: false,
    },
  };
}

export function acknowledgeLoadingTask(tasks, id = VOICE_PACK_TASK_ID) {
  const prev = getLoadingTask(tasks, id);
  if (!prev.readyUnread) return tasks;
  return {
    ...tasks,
    [id]: {
      ...prev,
      readyUnread: false,
    },
  };
}
