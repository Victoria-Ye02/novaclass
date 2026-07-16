// =============================================
// intro.js — intro screen animation sequence
// =============================================

/**
 * Reveals each intro element one by one with delay.
 * Each element starts invisible in CSS.
 * Adding .visible triggers the CSS transition.
 */
function runIntro() {
  var delay = 300;

  // Helper: show element after cumulative delay
  function showAfter(id, extra) {
    setTimeout(function () {
      var el = document.getElementById(id);
      if (el) el.classList.add('visible');
    }, delay + (extra || 0));
  }

  showAfter('ih');    delay += 400;   // heart
  showAfter('il1');   delay += 500;   // "ဒီ website လေးကို"
  showAfter('iname'); delay += 600;   // "Saw Eh Chan"
  showAfter('il2');   delay += 500;   // "တစ်ယောက်တည်းအတွက်သာ"
  showAfter('il3');   delay += 500;   // "ရည်ရွယ်ပြီး..."
  showAfter('isub');  delay += 600;   // subtitle
  showAfter('enter-btn');              // button
}

/**
 * Called when user clicks "ဝင်ရောက်ကြည့်ရှုမည်"
 * Fades out the intro screen then shows the main app.
 */
function enterSite() {
  var screen = document.getElementById('intro-screen');
  screen.classList.add('fade-out');

  // User ရဲ့ button click နဲ့ တွဲပြီး audio play လုပ်
  // (browser auto-play policy အတွက် user gesture လိုတယ်)
  playAudio();

  setTimeout(function () {
    screen.style.display = 'none';
    document.getElementById('main-app').classList.add('show');
  }, 850);
}
