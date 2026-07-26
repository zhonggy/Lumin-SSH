// 将终端壁纸应用到应用全局背景
import defaultTermBg from '../assets/term_bg.png';

export function isGlobalWallpaperEnabled() {
  return localStorage.getItem('termBgGlobal') === 'true';
}

export function applyGlobalWallpaper() {
  const body = document.body;
  if (!body) return;
  if (!isGlobalWallpaperEnabled()) {
    body.classList.remove('global-wallpaper');
    body.style.removeProperty('--global-wallpaper-image');
    body.style.removeProperty('--global-wallpaper-veil');
    return;
  }
  const image = localStorage.getItem('termBgImage') || defaultTermBg;
  const rawOpacity = parseFloat(localStorage.getItem('termBgOpacity') || '0.15');
  const opacity = Number.isFinite(rawOpacity) ? Math.min(Math.max(rawOpacity, 0), 1) : 0.15;
  // 壁纸可见度通过盖在图片上的底色遮罩实现（不能用 opacity，否则会连内容一起变透明）
  body.style.setProperty('--global-wallpaper-image', `url("${image}")`);
  body.style.setProperty(
    '--global-wallpaper-veil',
    `color-mix(in srgb, var(--surface-base) ${Math.round((1 - opacity) * 100)}%, transparent)`
  );
  body.classList.add('global-wallpaper');
}
