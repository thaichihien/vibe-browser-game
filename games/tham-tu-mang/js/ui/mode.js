/* Hai chế độ. CHẾ ĐỘ ĐỌC là mặc định và không bao giờ mất máu — mọi thử nghiệm sống ở đó.
   Tách hai động tác không chỉ là tiện: nếu kéo chuột lúc nào cũng nghĩa là "khoanh" thì
   người chơi không thể bôi đen chữ, và S03 (chọn chữ để lộ chữ ẩn) sẽ không thể tìm ra. */

export function initMode(button) {
  let capture = false;

  function set(on) {
    capture = on;
    document.body.classList.toggle('capture', capture);
    button.setAttribute('aria-pressed', String(capture));
    button.textContent = capture ? 'ĐANG KHOANH' : 'CHẾ ĐỘ KHOANH';
  }

  button.addEventListener('click', () => set(!capture));
  set(false);

  return { isCapture: () => capture, set, toggle: () => set(!capture) };
}
