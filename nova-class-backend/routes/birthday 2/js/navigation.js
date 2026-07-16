// =============================================
// navigation.js — page switching
// =============================================

/**
 * Shows the page with the given id,
 * hides all other pages, and scrolls to top.
 *
 * Usage: go('page-story')
 */
function go(pageId) {
  // Hide all pages
  var pages = document.querySelectorAll('.page');
  pages.forEach(function (p) {
    p.classList.remove('active');
  });

  // Show the target page
  var target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
  }

  window.scrollTo(0, 0);
}
