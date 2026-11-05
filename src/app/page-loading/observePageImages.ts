/** The rendered tree supplies the actual images, including any data-driven fallbacks. */
export function observePageImages(
  stage: HTMLElement,
  hasPendingData: () => boolean,
  onReady: () => void,
) {
  const decoded = new WeakMap<HTMLImageElement, { source: string; done: boolean }>();
  let frame: number | undefined;
  let stopped = false;

  function schedule() {
    if (!stopped && frame === undefined) frame = requestAnimationFrame(check);
  }

  function check() {
    frame = undefined;
    let waitingForImages = false;
    for (const image of stage.querySelectorAll('img')) {
      if (!image.getAttribute('src') && !image.srcset) continue;
      // Offscreen images are also part of the initial view.
      if (image.getAttribute('loading') === 'lazy') image.setAttribute('loading', 'eager');
      if (!image.complete) {
        waitingForImages = true;
        continue;
      }
      if (typeof image.decode !== 'function') continue;
      const source = `${image.src}\n${image.currentSrc}`;
      let status = decoded.get(image);
      if (status?.source !== source) {
        const next = { source, done: false };
        decoded.set(image, next);
        status = next;
        // A failed decode is terminal. If the component swaps src, the next
        // scan waits for its replacement just as it would any other image.
        const settled = () => {
          next.done = true;
          schedule();
        };
        void image.decode().then(settled, settled);
      }
      if (!status.done) waitingForImages = true;
    }
    if (!waitingForImages && !hasPendingData()) {
      stop();
      onReady();
    }
  }

  const observer = new MutationObserver(schedule);
  observer.observe(stage, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'sizes', 'media'],
  });
  stage.addEventListener('load', schedule, true);
  stage.addEventListener('error', schedule, true);

  function stop() {
    stopped = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    observer.disconnect();
    stage.removeEventListener('load', schedule, true);
    stage.removeEventListener('error', schedule, true);
  }

  schedule();
  return { schedule, stop };
}
