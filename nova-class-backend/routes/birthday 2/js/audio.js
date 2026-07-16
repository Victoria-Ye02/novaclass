// =============================================
// audio.js — background music player
// =============================================

// -----------------------------------------------
// ဒီ file ကို သုံးဖို့ အရင် MP3 file ကို
// birthday/ folder ထဲ ထည့်ပါ။
// ပြီးရင် အောက်က 'your-song.mp3' ကို
// မင်းရဲ့ file name နဲ့ အစားထိုးပါ။
// -----------------------------------------------

var SONG_FILE = 'your-song.mp3'; // ← ဒီနေရာ ပြောင်းပါ

var audio      = null;
var isPlaying  = false;

/**
 * Audio object ကို တည်ဆောက်ပြီး
 * intro screen ဝင်တာနဲ့ play စတင်သည်။
 * Browser auto-play policy ကြောင့်
 * user interaction (button click) ပြီးမှ play လုပ်တယ်။
 */
function initAudio() {
  audio = new Audio(SONG_FILE);
  audio.loop   = true;   // သီချင်း ဆုံးရင် ပြန်ဆော့
  audio.volume = 0.4;    // အသံကျယ်မှု (0.0 ~ 1.0)

  // Browser က auto-play ကို block တတ်တယ်
  // ဒါကြောင့် enterSite() မှာ playAudio() ခေါ်မယ်
}

/**
 * သီချင်းစဖွင့်ရန် — enterSite() မှာ ခေါ်တယ်
 */
function playAudio() {
  if (!audio) return;

  // Fade in effect — volume 0 ကနေ တဖြည်းဖြည်း တက်လာ
  audio.volume = 0;
  audio.play().catch(function (err) {
    // Browser က block လုပ်ရင် music button ပြပေးမယ်
    console.warn('Auto-play blocked:', err);
    showMusicButton();
  });

  fadeIn();
  isPlaying = true;
  updateMusicBtn();
}

/**
 * Fade in — volume ကို တဖြည်းဖြည်း 0.4 ထိ တင်
 */
function fadeIn() {
  var target   = 0.4;
  var step     = 0.02;
  var interval = setInterval(function () {
    if (!audio) { clearInterval(interval); return; }
    if (audio.volume < target - step) {
      audio.volume = Math.min(audio.volume + step, target);
    } else {
      audio.volume = target;
      clearInterval(interval);
    }
  }, 80);
}

/**
 * Play / Pause toggle — music button နှိပ်ရင်
 */
function toggleMusic() {
  if (!audio) return;

  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play();
    isPlaying = true;
  }

  updateMusicBtn();
}

/**
 * Music button icon ပြောင်းသည်
 */
function updateMusicBtn() {
  var btn = document.getElementById('music-btn');
  if (!btn) return;
  btn.textContent = isPlaying ? '♫' : '♩';
  btn.title       = isPlaying ? 'Music ပိတ်မည်' : 'Music ဖွင့်မည်';
}

/**
 * Browser က auto-play block လုပ်ရင်
 * music button ကို prominent ပြသည်
 */
function showMusicButton() {
  var btn = document.getElementById('music-btn');
  if (btn) {
    btn.style.animation = 'none';
    btn.style.background = '#d63a6f';
    btn.style.color      = 'white';
  }
}

// App load ပြီးတာနဲ့ audio object ကို prepare လုပ်
initAudio();
