// Application-level loop. This is not ECS: it coordinates services in a predictable order.
// ECS simulation is one participant, alongside UI/render/input/audio.

export function createGameLoop({ update, render, onError = console.error, requestFrame = requestAnimationFrame } = {}) {
  if (typeof update !== "function") throw new TypeError("createGameLoop requires update(dt, now)");
  if (typeof render !== "function") throw new TypeError("createGameLoop requires render(now)");

  let running = false;
  let lastTime = 0;

  function frame(now) {
    if (!running) return;

    const dt = lastTime > 0 ? (now - lastTime) / 1000 : 0;
    lastTime = now;

    try {
      update(dt, now);
      render(now);
    } catch (error) {
      running = false;
      onError(error);
      return;
    }

    requestFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      requestFrame(frame);
    },
    stop() {
      running = false;
    },
    get running() {
      return running;
    },
  };
}
