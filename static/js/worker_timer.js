/**
 * Background Timer Web Worker
 * Ensures timing and frame ticks continue without throttling when switching to other applications or tabs.
 */

let timerId = null;
let intervalMs = 1000;

self.onmessage = function (e) {
  const data = e.data;
  if (!data) return;

  switch (data.command) {
    case 'start':
      intervalMs = data.interval || 1000;
      if (timerId !== null) {
        clearInterval(timerId);
      }
      timerId = setInterval(() => {
        self.postMessage({ type: 'tick', timestamp: Date.now() });
      }, intervalMs);
      break;

    case 'stop':
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      break;

    case 'ping':
      self.postMessage({ type: 'pong', timestamp: Date.now() });
      break;
  }
};
