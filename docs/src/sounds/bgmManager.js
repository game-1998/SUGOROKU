const bgm = new Audio("src/sounds/bgm.wav");
bgm.loop = true;
bgm.volume = 0.4;

export function playBGM() {
  bgm.play();
}

export function fadeVolume(target) {
  const start = bgm.volume;
  const diff = target - start;
  const steps = 30;
  const duration = 300;
  let count = 0;

  const interval = setInterval(() => {
    count++;
    bgm.volume = start + diff * (count / steps);

    if (count >= steps) clearInterval(interval);
  }, duration / steps);
}
