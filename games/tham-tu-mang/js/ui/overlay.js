export function showOverlay({ title, body, cta, onCta }) {
  const host = document.getElementById('overlay');
  host.hidden = false;
  host.innerHTML = `
    <div class="sheet">
      <h2>${title}</h2>
      <div>${body}</div>
      <button type="button">${cta}</button>
    </div>`;
  const button = host.querySelector('button');
  button.addEventListener('click', () => {
    host.hidden = true;
    onCta();
  });
  button.focus();
}

export function hideOverlay() {
  document.getElementById('overlay').hidden = true;
}
