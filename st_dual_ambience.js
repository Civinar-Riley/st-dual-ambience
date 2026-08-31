// ================================================================
// ✦ 左右视频背景 · 酒馆助手全局脚本 v3（双实例 + 共享列表 + 视频开关）
// 作用：酒馆界面【左侧】与【右侧】各一个循环视频位：
//      - 共享同一份视频列表（任一侧添加/删除/恢复默认，两侧同步）
//      - 各自独立的控制面板（左下角 / 右下角 ⏻）：播放/暂停、上下切换、
//        循环模式、音量、亮度、区域宽度/透明度、视频开关
//      - 页面切到后台自动暂停，回来恢复
// ================================================================
(() => {
  'use strict';

  /* ============ 存储 ============ */
  const LS_KEY = 'st-lr-video-bg-v3';
  const LEGACY_KEY = 'st-left-video-bg-v2';   // v2 单左位数据迁移来源
  const DEFAULT_LIST = [
    'https://images.pexels.com/photos/1459505/pexels-photo-1459505.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
    'https://images.pexels.com/photos/433989/pexels-photo-433989.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop',
  ];
  const SIDE_DEFAULTS = {
    idx: 0,
    mode: 'loop',      // loop 单个循环 | list 列表顺序 | random 随机
    volume: 0,         // 0~1；0=静音（自动播放前提）
    brightness: 1,     // 0.5~1.5
    width: 26,         // vw
    opacity: 1,        // 0.1~1
    off: false,        // 视频开关
  };

  let S = loadState();
  function loadState() {
    let store = null;
    try { store = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (!store || !Array.isArray(store.list) || !store.list.length) {
      /* v2 迁移：旧「左侧视频」的列表与设置带入左侧位 */
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
        if (old && Array.isArray(old.list) && old.list.length) {
          store = {
            list: old.list.filter(x => typeof x === 'string' && x.trim()),
            sides: { left: { idx: old.idx || 0, mode: old.mode || 'loop', volume: old.volume ?? 0, brightness: old.brightness ?? 1, width: old.width ?? 26, opacity: old.opacity ?? 1 } },
          };
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch (e) {}
    }
    const base = {
      list: (store && Array.isArray(store.list) && store.list.length) ? store.list.filter(x => typeof x === 'string' && x.trim()) : [...DEFAULT_LIST],
      sides: {},
    };
    if (!base.list.length) base.list = [...DEFAULT_LIST];
    /* 左侧沿用已有状态；右侧初始：开启 + 从列表第 2 条开始（与左侧错开内容） */
    base.sides.left = { ...SIDE_DEFAULTS, ...((store && store.sides && store.sides.left) || {}) };
    base.sides.right = { ...SIDE_DEFAULTS, ...((store && store.sides && store.sides.right) || {}), idx: (store && store.sides && store.sides.right) ? (store.sides.right.idx || 0) : Math.min(1, base.list.length - 1) };
    for (const k of ['left', 'right']) clampSide(base.sides[k], base.list);
    return base;
  }
  function clampSide(sd, list) {
    sd.idx = Math.min(sd.idx || 0, list.length - 1); if (sd.idx < 0) sd.idx = 0;
    sd.volume = Math.min(1, Math.max(0, +sd.volume || 0));
    sd.brightness = Math.min(1.5, Math.max(0.5, +sd.brightness || 1));
    sd.width = Math.min(100, Math.max(10, +sd.width || 26));
    sd.opacity = Math.min(1, Math.max(0.1, +sd.opacity || 1));
    sd.off = !!sd.off;
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

  const HOST = window.parent.document;   // 脚本在 iframe 中，宿主文档才是酒馆本体

  /* ============ 清理旧实例（脚本重载安全） ============ */
  HOST.querySelectorAll('.lvp-video,.lvp,.lvp-toggle-btn,.lvp-style').forEach(el => el.remove());

  /* ============ 共享样式 ============ */
  const css = HOST.createElement('style');
  css.className = 'lvp-style';
  css.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
.lvp{
  --fg:#e2dfd8;
  --fg2:rgba(226,223,216,.5);
  --ac:#d4a853;
  --ac2:rgba(212,168,83,.25);
  --ac3:rgba(212,168,83,.08);
  --bd:rgba(212,168,83,.12);
  --bd2:rgba(212,168,83,.22);
  --bg:#0f0f1a;
  --bg2:rgba(20,20,35,.88);
  --danger:#c75a50;
  --danger2:rgba(199,90,80,.15);
  position:fixed;bottom:32px;width:min(340px,calc(100vw - 16px));
  max-height:min(72vh,580px);overflow-y:auto;
  background:var(--bg2);backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);
  border:1px solid var(--bd);border-radius:6px;
  box-shadow:0 24px 64px -16px rgba(0,0,0,.7),0 0 0 1px rgba(212,168,83,.04),inset 0 1px 0 rgba(255,255,255,.03);
  color:var(--fg);font-family:'DM Sans','Noto Sans SC','Segoe UI','Microsoft YaHei',sans-serif;
  font-size:13px;line-height:1.6;z-index:9998;
  opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .25s cubic-bezier(.4,0,.2,1),transform .25s cubic-bezier(.4,0,.2,1);
  scrollbar-width:thin;scrollbar-color:var(--ac) transparent;
}
.lvp::before{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity:.6;z-index:0}
.lvp[data-side=left]{left:8px}
.lvp[data-side=right]{right:8px}
.lvp::-webkit-scrollbar{width:5px}
.lvp::-webkit-scrollbar-track{background:transparent}
.lvp::-webkit-scrollbar-thumb{background:var(--ac2);border-radius:3px}
.lvp::-webkit-scrollbar-thumb:hover{background:var(--ac)}
.lvp.open{opacity:1;transform:none;pointer-events:auto}
.lvp .lvp-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;
  padding:12px 14px;background:linear-gradient(180deg,var(--bg) 60%,transparent);border-bottom:1px solid var(--bd)}
.lvp .lvp-title{font-family:'Playfair Display','Noto Serif SC','STZhongsong',serif;font-weight:700;
  font-size:15px;letter-spacing:1.5px;color:var(--ac);position:relative;display:flex;align-items:center;gap:8px}
.lvp .lvp-title::before{content:"";display:inline-block;width:3px;height:14px;background:var(--ac);border-radius:2px}
.lvp .lvp-title::after{content:"";position:absolute;left:0;bottom:-13px;height:1px;width:100%;
  background:linear-gradient(90deg,var(--ac),var(--ac2),transparent);transform:scaleX(0);transform-origin:left}
.lvp.open .lvp-title::after{animation:lvp-sweep .6s .2s cubic-bezier(.4,0,.2,1) forwards}
.lvp .lvp-mini{margin-left:auto;display:flex;gap:2px}
.lvp button{all:unset;cursor:pointer;color:var(--fg);font-size:12px;transition:color .15s}
.lvp button:hover{color:var(--ac)}
.lvp .lvp-sec{padding:12px 14px;border-bottom:1px solid var(--bd);position:relative;z-index:1}
.lvp .lvp-sec:last-child{border-bottom:none}
.lvp.open .lvp-sec{animation:lvp-up .35s cubic-bezier(.4,0,.2,1) both}
.lvp.open .lvp-sec:nth-child(2){animation-delay:.04s}
.lvp.open .lvp-sec:nth-child(3){animation-delay:.08s}
.lvp.open .lvp-sec:nth-child(4){animation-delay:.12s}
.lvp.open .lvp-sec:nth-child(5){animation-delay:.16s}
.lvp .lvp-row{display:flex;align-items:center;gap:8px}
.lvp .lvp-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
  padding:7px 10px;border:1px solid var(--bd);border-radius:4px;background:var(--ac3);
  transition:all .2s cubic-bezier(.4,0,.2,1);user-select:none;position:relative;overflow:hidden}
.lvp .lvp-btn::after{content:"";position:absolute;bottom:0;left:0;width:100%;height:2px;
  background:var(--ac);transform:scaleX(0);transition:transform .2s cubic-bezier(.4,0,.2,1)}
.lvp .lvp-btn:hover{border-color:var(--bd2);background:rgba(212,168,83,.12)}
.lvp .lvp-btn:hover::after{transform:scaleX(1)}
.lvp .lvp-btn.big{flex:1.4;font-size:14px;font-weight:500;border-color:var(--bd2);color:var(--ac);background:var(--ac2)}
.lvp .lvp-seg{display:flex;gap:3px;margin-top:8px}
.lvp .lvp-seg button{flex:1;text-align:center;padding:5px 3px;border:1px solid var(--bd);
  border-radius:3px;background:none;font-size:11px;color:var(--fg2);transition:all .2s}
.lvp .lvp-seg button:hover{border-color:var(--bd2);color:var(--fg)}
.lvp .lvp-seg button.on{border-color:var(--ac);color:var(--ac);background:var(--ac3);
  box-shadow:0 0 12px var(--ac2)}
.lvp label{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--fg2);letter-spacing:1.5px;
  text-transform:uppercase;display:block;margin:10px 0 4px;font-weight:500}
.lvp input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:4px;border-radius:2px;
  background:linear-gradient(90deg,var(--bd),var(--bd2));outline:none;cursor:pointer;position:relative}
.lvp input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;
  border-radius:50%;background:var(--ac);box-shadow:0 0 10px var(--ac2),0 0 20px rgba(212,168,83,.1);
  cursor:pointer;transition:box-shadow .2s}
.lvp input[type=range]::-webkit-slider-thumb:hover{box-shadow:0 0 14px var(--ac),0 0 28px rgba(212,168,83,.2)}
.lvp input[type=range]::-moz-range-thumb{width:14px;height:14px;border:none;
  border-radius:50%;background:var(--ac);box-shadow:0 0 10px var(--ac2);cursor:pointer}
.lvp .lvp-val{font-family:'JetBrains Mono',monospace;font-size:10px;min-width:36px;
  text-align:right;color:var(--ac);font-variant-numeric:tabular-nums;font-weight:500}
.lvp .lvp-list{max-height:150px;overflow-y:auto;margin-top:6px;scrollbar-width:thin}
.lvp .lvp-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:4px;
  cursor:pointer;transition:all .15s;position:relative}
.lvp .lvp-item::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);
  width:2px;height:0;background:var(--ac);border-radius:1px;transition:height .2s}
.lvp .lvp-item:hover{background:rgba(212,168,83,.06)}
.lvp .lvp-item.on{background:rgba(212,168,83,.08)}
.lvp .lvp-item.on::before{height:60%}
.lvp .lvp-item .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:12px;color:var(--fg2);transition:color .15s}
.lvp .lvp-item.on .nm{color:var(--ac)}
.lvp .lvp-item .del{opacity:0;font-size:11px;padding:2px 4px;border-radius:3px;color:var(--fg2);
  transition:all .15s}
.lvp .lvp-item:hover .del{opacity:.5}
.lvp .lvp-item .del:hover{opacity:1;color:var(--danger);background:var(--danger2)}
.lvp .lvp-add input{flex:1;min-width:0;padding:8px 10px;border:1px solid var(--bd);border-radius:4px;
  background:rgba(0,0,0,.3);color:var(--fg);font-size:12px;outline:none;box-sizing:border-box;
  transition:border-color .2s}
.lvp .lvp-add input:focus{border-color:var(--ac);box-shadow:0 0 0 2px var(--ac2)}
.lvp .lvp-add input::placeholder{color:var(--fg2);opacity:.5}
.lvp .lvp-err{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--danger);margin-top:6px;min-height:14px}
.lvp details summary{cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:10px;
  color:var(--fg2);letter-spacing:1px;user-select:none;transition:color .15s}
.lvp details summary:hover{color:var(--fg)}
.lvp details[open] summary{color:var(--ac);margin-bottom:6px}
.lvp-toggle-btn{position:fixed;bottom:6px;width:20px;height:20px;z-index:9999;
  display:flex;align-items:center;justify-content:center;border-radius:50%;
  border:1px solid var(--bd);background:var(--bg);color:var(--fg2);
  font-size:9px;cursor:pointer;opacity:.5;transition:all .25s}
.lvp-toggle-btn:hover{opacity:1;border-color:var(--ac);color:var(--ac);box-shadow:0 0 12px var(--ac2)}
.lvp-toggle-btn[data-side=left]{left:6px}
.lvp-toggle-btn[data-side=right]{right:6px}
.lvp-toggle-btn.off{opacity:.2;animation:lvp-pulse 2.5s ease-in-out infinite}
.lvp-video{position:fixed;top:0;height:100vh;object-fit:cover;z-index:0;pointer-events:none}
.lvp-video[data-side=left]{left:0}
.lvp-video[data-side=right]{right:0}
@keyframes lvp-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes lvp-sweep{to{transform:scaleX(1)}}
@keyframes lvp-pulse{0%,100%{opacity:.2}50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){
  .lvp,.lvp .lvp-sec{animation:none!important;transition:none!important}
  .lvp-toggle-btn.off{animation:none!important}
}`;
  HOST.head.appendChild(css);

  /* ============ 单侧实例工厂 ============ */
  function createSide(side) {
    const sd = S.sides[side];                 /* 该侧独立设置 */
    const other = side === 'left' ? 'right' : 'left';
    const NAME = side === 'left' ? '左屏 · 媒体' : '右屏 · 媒体';

    const video = HOST.createElement('video');
    video.className = 'lvp-video';
    video.dataset.side = side;
    video.autoplay = true; video.muted = true; video.loop = (sd.mode === 'loop');
    video.playsInline = true; video.setAttribute('playsinline', '');
    video.controls = false; video.disablePictureInPicture = true;
    HOST.body.appendChild(video);

    /* 图片位：列表条目为图片扩展名时，在同一区域显示图片（替代视频画面） */
    const img = HOST.createElement('img');
    img.className = 'lvp-video';
    img.dataset.side = side;
    img.alt = '';
    HOST.body.appendChild(img);

    const panel = HOST.createElement('div');
    panel.className = 'lvp'; panel.dataset.side = side;
    panel.innerHTML = `
  <div class="lvp-top">
    <span class="lvp-title">${NAME}</span>
    <span class="lvp-mini">
      <button type="button" data-a="prev" title="上一个">⏮</button>
      <button type="button" data-a="toggle" title="播放/暂停">▶</button>
      <button type="button" data-a="next" title="下一个">⏭</button>
    </span>
    <button type="button" data-a="power" title="关闭媒体">⏻</button>
    <button type="button" data-a="close" title="收起面板" style="opacity:.6;font-size:11px;padding:0 3px">✕</button>
  </div>
  <div class="lvp-sec">
    <div class="lvp-row">
      <button type="button" class="lvp-btn" data-a="prev">⏮ 上一个</button>
      <button type="button" class="lvp-btn big" data-a="toggle">⏸ 暂停</button>
      <button type="button" class="lvp-btn" data-a="next">⏭ 下一个</button>
    </div>
    <div class="lvp-seg">
      <button type="button" data-mode="loop">🔂 单个循环</button>
      <button type="button" data-mode="list">📋 列表顺序</button>
      <button type="button" data-mode="random">🎲 随机</button>
    </div>
    <label>音量（拉起自动解除静音）</label>
    <div class="lvp-row">
      <button type="button" data-a="mute" style="width:20px;text-align:center">🔇</button>
      <input type="range" class="rg-vol" min="0" max="100" value="${Math.round(sd.volume * 100)}">
      <span class="lvp-val rg-volv">${Math.round(sd.volume * 100)}%</span>
    </div>
    <label>亮度</label>
    <div class="lvp-row">
      <span style="font-size:11px">☀</span>
      <input type="range" class="rg-bri" min="50" max="150" value="${Math.round(sd.brightness * 100)}">
      <span class="lvp-val rg-briv">${Math.round(sd.brightness * 100)}%</span>
    </div>
  </div>
  <div class="lvp-sec">
    <div class="lvp-row" style="justify-content:space-between">
      <label style="margin:0">媒体列表（${side === 'left' ? '与右侧共用' : '与左侧共用'}）</label>
      <button type="button" data-a="restore" title="恢复出厂列表" style="font-size:10px;opacity:.6">↺ 恢复默认</button>
    </div>
    <div class="lvp-list"></div>
  </div>
  <div class="lvp-sec lvp-add">
    <label>添加网络媒体地址</label>
    <div class="lvp-row">
      <input type="text" class="in-url" placeholder="https://…/video.mp4 或图片 .png/.jpg（回车添加）">
      <button type="button" class="lvp-btn" data-a="add" style="flex:0 0 auto">添加</button>
    </div>
    <div class="lvp-err"></div>
  </div>
  <div class="lvp-sec">
    <details>
      <summary>⚙ 样式调节 <button type="button" data-a="mirror" title="把当前宽度/透明度/亮度复制到另一侧" style="font-size:10px;opacity:.7;cursor:pointer">⇄ 应用到另一侧</button></summary>
      <label>区域宽度</label>
      <div class="lvp-row">
        <input type="range" class="rg-w" min="10" max="100" value="${sd.width}">
        <span class="lvp-val rg-wv">${sd.width}vw</span>
      </div>
      <label>透明度</label>
      <div class="lvp-row">
        <input type="range" class="rg-op" min="10" max="100" value="${Math.round(sd.opacity * 100)}">
        <span class="lvp-val rg-opv">${Math.round(sd.opacity * 100)}%</span>
      </div>
    </details>
  </div>`;
    HOST.body.appendChild(panel);

    const btn = HOST.createElement('button');
    btn.className = 'lvp-toggle-btn'; btn.dataset.side = side;
    btn.textContent = '⏻';
    HOST.body.appendChild(btn);

    const $ = s => panel.querySelector(s);
    const $$ = s => [...panel.querySelectorAll(s)];
    const errEl = $('.lvp-err');

    /* 样式应用（不含 src——src 只由 loadCurrent 变更，避免调音量/亮度时视频重播） */
    let showingImage = false;
    const isImage = u => /\.(png|jpe?g|webp|gif|avif|bmp)(?:[?#]|$)/i.test(String(u || ''));
    function applyMediaStyle() {
      video.loop = (sd.mode === 'loop');
      video.volume = sd.volume; video.muted = (sd.volume <= 0);
      const vDisp = sd.off ? 'none' : (showingImage ? 'none' : '');
      const iDisp = sd.off ? 'none' : (showingImage ? '' : 'none');
      video.style.filter = `brightness(${sd.brightness})`;
      video.style.width = sd.width + 'vw';
      video.style.opacity = sd.off ? 0 : sd.opacity;
      video.style.display = vDisp;
      video.style.left = side === 'left' ? '0' : 'auto';
      video.style.right = side === 'right' ? '0' : 'auto';
      img.style.filter = video.style.filter;
      img.style.width = video.style.width;
      img.style.opacity = video.style.opacity;
      img.style.display = iDisp;
      img.style.left = video.style.left;
      img.style.right = video.style.right;
    }
    function loadCurrent(autoplay = true) {
      const url = S.list[sd.idx] || '';
      showingImage = isImage(url);
      if (showingImage) img.src = url; else video.src = url;
      applyMediaStyle();
      if (showingImage) { try { video.pause(); } catch (e) {} return; }
      if (autoplay && !sd.off) video.play().catch(() => {});
    }
    function syncPowerUi() {
      $('[data-a="power"]').textContent = sd.off ? '▶ 开启' : '⏻ 关闭';
      btn.classList.toggle('off', sd.off);
      btn.title = sd.off ? NAME + '：视频已关闭，点击恢复' : NAME + ' 控制面板';
    }
    function setPower(on) {
      sd.off = !on;
      save(); applyMediaStyle(); syncPowerUi();
      if (on) video.play().catch(() => {}); else video.pause();
    }
    function syncPlayIcon() {
      if (showingImage) {
        $('.lvp-btn.big').textContent = '🖼 图片';
        $('.lvp-mini [data-a="toggle"]').textContent = '🖼';
        return;
      }
      const playing = !sd.off && !video.paused && !video.ended;
      $('.lvp-btn.big').textContent = playing ? '⏸ 暂停' : '▶ 播放';
      $('.lvp-mini [data-a="toggle"]').textContent = playing ? '⏸' : '▶';
    }
    function syncMode() { $$('.lvp-seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === sd.mode)); }
    function syncRanges() {
      $('.rg-vol').value = Math.round(sd.volume * 100); $('.rg-volv').textContent = Math.round(sd.volume * 100) + '%';
      $('.rg-bri').value = Math.round(sd.brightness * 100); $('.rg-briv').textContent = Math.round(sd.brightness * 100) + '%';
      $('.rg-w').value = sd.width; $('.rg-wv').textContent = sd.width + 'vw';
      $('.rg-op').value = Math.round(sd.opacity * 100); $('.rg-opv').textContent = Math.round(sd.opacity * 100) + '%';
      $('[data-a="mute"]').textContent = sd.volume <= 0 ? '🔇' : '🔊';
    }
    function renderList() {
      const box = $('.lvp-list');
      box.innerHTML = '';
      if (!S.list.length) {
        const empty = HOST.createElement('div');
        empty.style.cssText = 'font-size:11px;opacity:.5;padding:6px 2px';
        empty.textContent = '列表为空——添加一个地址，或点「↺ 恢复默认」';
        box.appendChild(empty); return;
      }
      S.list.forEach((u, i) => {
        const it = HOST.createElement('div');
        it.className = 'lvp-item' + (i === sd.idx ? ' on' : '');
        const nm = HOST.createElement('span'); nm.className = 'nm';
        try { nm.textContent = decodeURIComponent(u.split('/').pop() || u); } catch (e) { nm.textContent = u; }
        nm.title = u;
        const del = HOST.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = '删除';
        del.addEventListener('click', ev => { ev.stopPropagation(); delItem(i); });
        it.appendChild(nm); it.appendChild(del);
        it.addEventListener('click', () => { sd.idx = i; save(); loadCurrent(); renderAllLists(); syncPlayIcon(); });
        box.appendChild(it);
      });
    }
    function syncAllUi() { renderList(); syncMode(); syncPlayIcon(); syncRanges(); syncPowerUi(); }
    function step(d) {
      if (!S.list.length) return;
      sd.idx = (sd.idx + d + S.list.length) % S.list.length;
      save(); loadCurrent(); renderAllLists();
    }
    function addUrl() {
      const inp = $('.in-url');
      const u = inp.value.trim();
      if (!u) { errEl.textContent = '请先填写视频地址'; return; }
      if (!/^https?:\/\//i.test(u) && !u.startsWith('/')) { errEl.textContent = '地址需以 http(s):// 或 / 开头'; return; }
      errEl.textContent = '';
      S.list.push(u); sd.idx = S.list.length - 1; save();
      inp.value = '';
      loadCurrent(); renderAllLists();
      toast('已添加并播放');
    }
    function delItem(i) {
      if (S.list.length <= 1) { errEl.textContent = '至少保留一项'; return; }
      S.list.splice(i, 1);
      if (sd.idx >= S.list.length) sd.idx = S.list.length - 1;
      if (sd.idx > i) sd.idx--;
      save(); loadCurrent(); renderAllLists();
      toast('已删除');
    }

    video.addEventListener('play', syncPlayIcon);
    video.addEventListener('pause', syncPlayIcon);
    video.addEventListener('ended', () => {
      if (sd.mode === 'list') step(1);
      else if (sd.mode === 'random' && S.list.length > 1) {
        let n; do { n = Math.floor(Math.random() * S.list.length); } while (n === sd.idx);
        sd.idx = n; save(); loadCurrent(); renderAllLists();
      }
    });
    video.addEventListener('error', () => { errEl.textContent = '⚠️ 当前地址加载失败：' + (S.list[sd.idx] || ''); });

    btn.addEventListener('click', () => {
      /* 视频已关闭 → 点 ⏻ 直接恢复；否则开合面板（互斥：同时收起另一侧面板） */
      if (sd.off) { setPower(true); toast(NAME + ' 已开启'); return; }
      const opening = !panel.classList.contains('open');
      for (const inst of insts) if (inst.side !== side) inst.closePanel();
      panel.classList.toggle('open', opening);
    });
    panel.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'toggle') {
        /* 暂停/播放同步到另一侧（各自播放条目不变，只同步走带状态） */
        const willPause = !video.paused;
        const otherV = (insts.find(i => i.side === other) || {}).video;
        if (willPause) {
          video.pause();
          if (otherV && !otherV.paused) otherV.pause();
        } else {
          video.play().catch(() => {});
          const oi = insts.find(i => i.side === other) || {};
          if (otherV && otherV.paused && !S.sides[other].off && !oi.showingImage) otherV.play().catch(() => {});
        }
      }
      else if (a === 'prev') step(-1);
      else if (a === 'next') step(1);
      else if (a === 'mute') {
        sd.volume = 0; save(); applyMediaStyle(); syncRanges();
      }
      else if (a === 'restore') {
        S.list = [...DEFAULT_LIST];
        S.sides.left.idx = 0;
        S.sides.right.idx = Math.min(1, S.list.length - 1);
        for (const k of ['left', 'right']) clampSide(S.sides[k], S.list);
        save();
        for (const inst of insts) inst.loadCurrent();
        renderAllLists();
        errEl.textContent = ''; toast('已恢复默认列表');
      }
      else if (a === 'add') addUrl();
      else if (a === 'close') panel.classList.remove('open');
      else if (a === 'power') setPower(sd.off);
      else if (a === 'mirror') {
        const o = S.sides[other];
        o.width = sd.width; o.opacity = sd.opacity; o.brightness = sd.brightness;
        save();
        for (const inst of insts) inst.applySide();
        toast('已将样式应用到另一侧');
      }
    });
    $('.in-url').addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });
    panel.addEventListener('click', e => {
      const m = e.target.dataset.mode;
      if (!m) return;
      sd.mode = m; save(); loadCurrent(); syncMode();
    });
    panel.addEventListener('input', e => {
      const v = +e.target.value;
      if (e.target.classList.contains('rg-vol')) {
        sd.volume = v / 100; save(); applyMediaStyle();
        $('.rg-volv').textContent = v + '%'; $('[data-a="mute"]').textContent = sd.volume <= 0 ? '🔇' : '🔊';
      } else if (e.target.classList.contains('rg-bri')) {
        sd.brightness = v / 100; save(); applyMediaStyle();
        $('.rg-briv').textContent = v + '%';
      } else if (e.target.classList.contains('rg-w')) {
        sd.width = v; save(); applyMediaStyle();
        $('.rg-wv').textContent = v + 'vw';
      } else if (e.target.classList.contains('rg-op')) {
        sd.opacity = v / 100; save(); applyMediaStyle();
        $('.rg-opv').textContent = v + '%';
      }
    });

    loadCurrent(true);
    renderList(); syncMode(); syncPlayIcon(); syncRanges(); syncPowerUi();

    return {
      side, video,
      closePanel() { panel.classList.remove('open'); },
      applySide() { applyMediaStyle(); syncRanges(); },
      loadCurrent,
      renderList,
      get showingImage() { return showingImage; },
      wasPlaying: false,
    };
  }

  function renderAllLists() { for (const inst of insts) inst.renderList(); }
  function toast(msg) {
    const t = HOST.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);background:rgba(15,17,26,.92);color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;z-index:100000';
    HOST.body.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }

  const insts = [createSide('left'), createSide('right')];

  /* 页面切到后台自动暂停，回来恢复（省双路解码开销） */
  HOST.addEventListener('visibilitychange', () => {
    if (HOST.hidden) {
      for (const inst of insts) {
        inst.wasPlaying = !inst.video.paused;
        if (!inst.video.paused) inst.video.pause();
      }
    } else {
      for (const inst of insts) {
        if (inst.wasPlaying && !S.sides[inst.side].off) inst.video.play().catch(() => {});
      }
    }
  });
})();
