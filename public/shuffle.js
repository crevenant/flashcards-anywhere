// src/frontend/utils/shuffle.js
// Utility function for shuffling arrays (Fisher-Yates)


// IIFE to attach shuffle to window
(function () {
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  window.shuffle = shuffle;
})();
