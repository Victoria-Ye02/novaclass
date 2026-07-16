// =============================================
// confetti.js — birthday confetti burst
// =============================================

var CONFETTI_SYMBOLS = ['♡', '♥', '✿', '★', '♡', '♥'];
var CONFETTI_COLORS  = ['#d63a6f', '#f4a0c0', '#ff6b9d', '#c06080', '#ffb3cc'];

/**
 * Spawns confetti pieces in #ca and clears them after animation.
 * Called by the Celebrate button on the wish page.
 */
function boom() {
  var area = document.getElementById('ca');
  area.innerHTML = '';

  for (var i = 0; i < 32; i++) {
    var piece = document.createElement('span');
    piece.className   = 'cp';
    piece.textContent = randomItem(CONFETTI_SYMBOLS);
    piece.style.animationDelay = (Math.random() * 1).toFixed(2) + 's';
    piece.style.color           = randomItem(CONFETTI_COLORS);
    area.appendChild(piece);
  }

  // Clear after animations finish
  setTimeout(function () {
    area.innerHTML = '';
  }, 3000);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
