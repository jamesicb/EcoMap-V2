import fs from 'fs';
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script src="./assets/privacy-utils.js"></script>');
const scriptStart = html.indexOf('<script>', start) + 8;
const scriptEnd = html.indexOf('</script>', scriptStart);
const code = html.slice(scriptStart, scriptEnd);
try {
  new Function(code);
  const m = code.match(/id: 36[\s\S]*?afterPhotos: \[([^\]]+)\]/);
  console.log('syntax ok, job36 photos', m?.[1]);
} catch (e) {
  console.error('syntax error:', e.message);
}
