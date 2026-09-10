let timer = null;

export function toast(message, kind = 'void') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(timer);
  timer = setTimeout(() => { el.className = ''; }, 1600);
}
