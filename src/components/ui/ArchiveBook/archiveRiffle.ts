const easeOut = 'cubic-bezier(0.18, 0.65, 0.32, 1)';
const snap = 'cubic-bezier(0.34, 0, 0.34, 1)';

const between = (min: number, max: number) => min + Math.random() * (max - min);
const waveLength = () => Math.floor(between(3, 7));

function leafPose(offset: number, yaw: number, skew = 0, lift = 0, easing = 'linear'): Keyframe {
  return {
    offset,
    transform: `translateZ(${lift}px) rotateY(${yaw}deg) skewY(${skew}deg)`,
    easing,
  };
}

function hingePoses(peak: number, bend: number, spring: number): Keyframe[] {
  return [
    { offset: 0, transform: 'rotateY(0deg)', easing: easeOut },
    { offset: peak, transform: `rotateY(${-bend}deg)`, easing: snap },
    { offset: 0.65, transform: `rotateY(${-bend * 0.27}deg)`, easing: easeOut },
    { offset: 0.83, transform: `rotateY(${spring}deg)`, easing: easeOut },
    { offset: 0.94, transform: 'rotateY(0deg)' },
    { offset: 1, transform: 'rotateY(0deg)' },
  ];
}

export function createArchiveRiffle(turns: HTMLElement) {
  const sheets = Array.from(turns.querySelectorAll<HTMLElement>('.archive-book__leaf'), (leaf) => ({
    leaf,
    middle: leaf.querySelector<HTMLElement>('.archive-book__panel--middle'),
    outer: leaf.querySelector<HTMLElement>('.archive-book__panel--outer'),
    tip: leaf.querySelector<HTMLElement>('.archive-book__panel--tip'),
    animations: [] as Animation[],
  }));
  let playing = false;
  let disposed = false;
  let launchesRemaining = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearLaunch() {
    clearTimeout(timer);
    timer = undefined;
  }

  function release(sheet: (typeof sheets)[number]) {
    sheet.leaf.removeAttribute('data-flying');
    for (const animation of sheet.animations) {
      animation.onfinish = null;
      animation.cancel();
    }
    sheet.animations = [];
  }

  function schedule(delay: number) {
    timer = setTimeout(() => {
      timer = undefined;
      launch();
    }, delay);
  }

  function launch() {
    if (!playing) return;
    const sheet = sheets.find(({ animations }) => animations.length === 0);
    if (!sheet?.middle || !sheet.outer || !sheet.tip) return;

    const duration = Math.round(between(315, 425));
    const curl = between(0.84, 1.12);
    const twist = between(4.5, 9);
    const flexLead = between(-0.022, 0.035);
    const timing = { duration, fill: 'both' } as const;

    const flight = sheet.leaf.animate(
      [
        { ...leafPose(0, 7, 0, 0, easeOut), '--archive-book-leaf-opacity': 1 },
        leafPose(0.19 + flexLead, -12, -twist * 0.4, 0.15, snap),
        leafPose(0.49, -88, -twist, 0.7, 'linear'),
        leafPose(0.72, -140, -twist * 0.48, 0.4, easeOut),
        { ...leafPose(0.84, -153, -0.8, 0.2, easeOut), '--archive-book-leaf-opacity': 1 },
        { ...leafPose(1, -161, 0, -0.45), '--archive-book-leaf-opacity': 0 },
      ],
      timing,
    );
    sheet.animations = [
      flight,
      sheet.middle.animate(hingePoses(0.36 + flexLead, 23 * curl, 2.5), timing),
      sheet.outer.animate(hingePoses(0.29 + flexLead, 26 * curl, 3.5), timing),
      sheet.tip.animate(hingePoses(0.22 + flexLead, 28 * curl, 5), timing),
    ];
    sheet.leaf.setAttribute('data-flying', '');
    flight.onfinish = () => {
      release(sheet);
      if (playing && timer === undefined) schedule(0);
    };

    launchesRemaining -= 1;
    if (launchesRemaining === 0) {
      launchesRemaining = waveLength();
      schedule(between(151, 208));
    } else {
      schedule(between(82, 133));
    }
  }

  return {
    start() {
      if (disposed || playing || !sheets.length || typeof sheets[0].leaf.animate !== 'function') {
        return;
      }
      playing = true;
      launchesRemaining = waveLength();
      for (const sheet of sheets) {
        for (const animation of sheet.animations) animation.updatePlaybackRate(1);
      }
      schedule(sheets.some(({ animations }) => animations.length) ? 35 : 65);
    },
    settle() {
      if (!playing) return;
      playing = false;
      clearLaunch();
      for (const sheet of sheets) {
        const progress = sheet.animations[0]?.effect?.getComputedTiming().progress;
        if (progress != null && progress >= 0.84) continue;
        for (const animation of sheet.animations) animation.updatePlaybackRate(3);
      }
    },
    dispose() {
      disposed = true;
      playing = false;
      clearLaunch();
      sheets.forEach(release);
    },
  };
}
