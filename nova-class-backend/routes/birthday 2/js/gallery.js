// =============================================
// gallery.js — photo upload + localStorage
// =============================================

var STORAGE_KEY = 'bday_photos_v2';

/**
 * Reads saved photos from localStorage and
 * renders the 4-slot gallery grid.
 */
function initGallery() {
  var grid   = document.getElementById('gg');
  var photos = loadPhotos();
  grid.innerHTML = '';

  for (var i = 0; i < 4; i++) {
    var slot = document.createElement('div');
    slot.className = 'gallery-slot';

    if (photos[i]) {
      // Slot has a photo — show it with hover overlay
      slot.innerHTML =
        '<img src="' + photos[i] + '" alt="Photo ' + (i + 1) + '">' +
        '<div class="ovl"><span>♡</span></div>';
    } else {
      // Empty slot — clicking opens file picker
      slot.innerHTML =
        '<div class="add-icon">♡</div>' +
        '<div class="add-hint">Photo ထည့်မည်</div>';

      // Use IIFE to capture current index in closure
      (function (idx) {
        slot.onclick = function () {
          var fileInput = document.getElementById('file-input');
          fileInput.dataset.slot = idx;
          fileInput.click();
        };
      })(i);
    }

    grid.appendChild(slot);
  }
}

/**
 * Called when user picks an image file.
 * Converts it to base64 and saves to localStorage.
 */
document.getElementById('file-input').onchange = function (e) {
  var file = e.target.files[0];
  if (!file) return;

  var slotIndex = parseInt(this.dataset.slot);
  var reader    = new FileReader();

  reader.onload = function (ev) {
    var photos = loadPhotos();
    photos[slotIndex] = ev.target.result; // base64 string
    savePhotos(photos);
    initGallery(); // re-render
  };

  reader.readAsDataURL(file);
  this.value = ''; // reset so same file can be re-picked
};

// ---- Helpers ----

function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function savePhotos(photos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}
