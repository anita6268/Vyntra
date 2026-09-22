const keyStrokeSounds = [
  new Audio("/sounds/keystroke1.mp3"),
  new Audio("/sounds/keystroke2.mp3"),
  new Audio("/sounds/keystroke3.mp3"),
  new Audio("/sounds/keystroke4.mp3"),
];

keyStrokeSounds.forEach((audio) => {
  audio.load();
});

let lastIndex = 0;

function useKeyboardSound() {
  const playRandomKeyStrokeSound = () => {
    const sound = keyStrokeSounds[lastIndex];
    lastIndex = (lastIndex + 1) % keyStrokeSounds.length;

    sound.currentTime = 0;
    sound.play().catch(() => {});
  };

  const testSound = () => {
    playRandomKeyStrokeSound();
  };

  return { playRandomKeyStrokeSound, testSound };
}

export default useKeyboardSound;
