// Notification sound registry. Most options are tiny WebAudio tones generated
// in-browser (no extra asset downloads); the bundled iPhone SMS clip stays
// available as the default. The user's choice persists in localStorage.

export const SOUND_CHOICES = [
  { id: "iphone", label: "iPhone SMS", kind: "file" },
  { id: "chime", label: "Chime", kind: "tone" },
  { id: "marimba", label: "Marimba", kind: "tone" },
  { id: "pop", label: "Pop", kind: "tone" },
  { id: "pulse", label: "Pulse", kind: "tone" },
  { id: "echo", label: "Echo", kind: "tone" },
  { id: "none", label: "Silent", kind: "none" }
];

const STORAGE_KEY = "cheprabai_sound_choice";

export function getSoundChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && SOUND_CHOICES.some(s => s.id === saved) ? saved : "iphone";
  } catch {
    return "iphone";
  }
}

export function setSoundChoice(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
}

let sharedCtx = null;
function audioCtx() {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

// Old browsers (Chrome <55 / Safari <14.1) block autoplay until the user has
// interacted with the page. Creating the AudioContext on a bare socket event
// (no gesture) leaves it suspended and the tones silent — exactly the
// "changing the sound does nothing" bug. We unlock on the first tap/keypress
// so every later message chimes reliably.
let unlockAttached = false;
function ensureUnlock() {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;
  const unlock = () => {
    const ac = audioCtx();
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}
ensureUnlock();

function note(ac, freq, t, dur, vol, wave) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = wave || "sine";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function playTone(id) {
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === "suspended") { ac.resume().catch(() => {}); }
  const t = ac.currentTime + 0.01;
  const base = 0.16;
  switch (id) {
    case "chime":
      note(ac, 880, t, 0.22, base, "sine");
      note(ac, 1174.66, t + 0.12, 0.3, base, "sine");
      break;
    case "marimba":
      note(ac, 523.25, t, 0.16, base, "triangle");
      note(ac, 659.25, t + 0.08, 0.16, base, "triangle");
      note(ac, 783.99, t + 0.16, 0.22, base, "triangle");
      break;
    case "pop":
      note(ac, 620, t, 0.12, base * 1.15, "sine");
      note(ac, 880, t + 0.03, 0.12, base * 0.8, "sine");
      break;
    case "pulse":
      note(ac, 660, t, 0.12, base, "sine");
      note(ac, 660, t + 0.16, 0.12, base, "sine");
      break;
    case "echo":
      note(ac, 494, t, 0.25, base, "sine");
      note(ac, 494, t + 0.09, 0.25, base * 0.55, "sine");
      note(ac, 494, t + 0.18, 0.3, base * 0.3, "sine");
      break;
    default:
      break;
  }
}

// Plays the selected sound. `fileUrl` is the bundled mp3 used by the "iphone"
// option. Replays the clip from scratch each time so rapid messages still chime.
export function playNotificationSound(id, fileUrl) {
  if (id === "none") return;
  if (id === "iphone") {
    if (!fileUrl) return;
    try {
      const a = new Audio(fileUrl);
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch { /* autoplay blocked — ignore */ }
    return;
  }
  try { playTone(id); } catch { /* no audio available */ }
}