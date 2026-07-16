// =============================================
// quiz.js — fill-in-the-blank quiz logic
// =============================================

var quizScore = 0;
var answered  = {}; // tracks which questions are done

/**
 * Checks one fill-in-the-blank question.
 *
 * @param {number} n       - question number (1, 2, 3)
 * @param {string} correct - main correct answer keyword
 * @param {string} alt     - alternative accepted answer
 */
function checkFitb(n, correct, alt) {
  // Prevent re-answering
  if (answered[n]) return;

  var input  = document.getElementById('qa' + n);
  var result = document.getElementById('qr' + n);
  var btn    = document.getElementById('cb' + n);
  var value  = input.value.trim();

  // Check if answer contains either keyword
  var isCorrect = value !== '' &&
    (value.indexOf(correct) >= 0 || value.indexOf(alt) >= 0);

  // Lock the question
  answered[n]    = true;
  btn.disabled   = true;
  input.disabled = true;

  if (isCorrect) {
    input.classList.add('correct');
    result.textContent = '♡ မှန်တယ်! မင်း ကောင်းကောင်း သိတာပဲ!';
    result.className   = 'fitb-result ok';
    quizScore++;
  } else {
    input.classList.add('wrong');
    result.textContent = '♡ မမှန်ဘူး — ဒါပေမဲ့ မင်းကို ချစ်နေတာပဲ! (အဖြေ: ' + correct + ')';
    result.className   = 'fitb-result no';
  }

  // Update score display
  document.getElementById('sc-num').textContent = quizScore + ' / 3';
}
