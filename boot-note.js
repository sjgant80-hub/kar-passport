// boot-note.js: if the page's module (page.mjs) has not started within six seconds, say so. A classic script in a file of
// its own, so it also runs where modules do not, and the content security policy needs no inline script.
setTimeout(function () { if (!window.__kpStarted) { var n = document.getElementById('boot-note'); if (n) n.style.display = 'block'; } }, 6000);
