/* 水の中の泡：下から浮かび、上がるほど大きくなり、水面を出るとしばらく漂って消える
   対象＝ローディングの水（.ld-water）と、タブレット・PCの外側の水（[data-water]）
   やめるとき：index.html の <script src="assets/bubbles.js"> の1行を消す */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- 調整用の設定 ----
  var CFG = {
    rate: 1.6,        // 1秒あたりに生まれる数（画面幅1440px・水が全面のとき。幅と水の量に比例して減る）
    loadingRate: 5,   // ローディング中の数（短い時間なので少し多め。画面幅では減らさない）
    loadingSeed: 6,   // ローディング開始時にあらかじめ水の中に出しておく数
    spLoading: 0.6,   // SP（幅600px未満）のローディングでは数・最初の泡・最大数をこの割合に抑える
    minWidthRate: 0.5, // 数は画面幅に比例して減らすが、この割合より下げない（SPでも見えるように）
    scaleAt: [820, 1440, 1.3], // 大きさ：幅820px（タブレット）で1倍→1440px以上で1.3倍
    max: 18,          // 同時に出す最大数
    r0: [2.5, 5.5],   // 生まれたときの半径（px）
    grow: 2.4,        // 画面の一番下→一番上で何倍まで大きくなるか
    speed: [45, 95],  // 水中で上がる速さ（px/秒）
    wobble: [4, 12],  // 水中での横ゆれの幅（px）
    driftLife: [1.8, 3.2], // 水面を出てから消えるまで（秒）
    surface: 0.40     // 水面＝波の SVG の上から何割の位置か（一番上の水色の波の基準線）
  };
  var rnd = function (a) { return a[0] + Math.random() * (a[1] - a[0]); };
  var r0 = function (b) { return b.r0 * CFG.grow; };

  // 水の要素ごとに canvas を1枚重ねる。ページの描き直しで消えたら付け直す
  function Layer(find, place, rate, anywhere) { this.find = find; this.place = place; this.rate = rate; this.anywhere = anywhere; this.list = []; this.acc = 0; }
  Layer.prototype.sync = function () {
    var water = this.find();
    if (!water) { if (this.cv) this.cv.remove(); this.cv = null; this.list = []; return false; }
    if (!this.cv || !this.cv.isConnected) {
      this.cv = document.createElement('canvas');
      this.cv.setAttribute('aria-hidden', 'true');
      this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;' + this.place;
      water.parentElement.insertBefore(this.cv, water.nextSibling);
      this.ctx = this.cv.getContext('2d');
      this.list = [];
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) {
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    }
    this.dpr = dpr; this.w = w; this.h = h;
    var svg = water.querySelector('svg').getBoundingClientRect(), box = this.cv.getBoundingClientRect();
    this.sy = svg.top - box.top + svg.height * CFG.surface;  // canvas 内での水面の高さ
    return true;
  };
  Layer.prototype.step = function (dt) {
    if (!this.sync()) return;
    var w = this.w, h = this.h, sy = this.sy, L = this.list;
    // 生まれる数は「水の見えている割合」と画面幅に比例
    var wet = Math.max(0, Math.min(1, (h - sy) / h));
    var spk = this.anywhere && w < 600 ? CFG.spLoading : 1, max = Math.round(CFG.max * spk);
    this.acc += this.rate * (this.anywhere ? spk : Math.max(CFG.minWidthRate, Math.min(1, w / 1440))) * wet * dt;
    // ローディングは最初からいくつか泡が出ている状態で始める
    if (this.anywhere && !this.seeded && wet > 0) { this.seeded = true; this.seedLeft = Math.round(CFG.loadingSeed * spk); this.acc += this.seedLeft; }
    var sc = 1 + (CFG.scaleAt[2] - 1) * Math.max(0, Math.min(1, (w - CFG.scaleAt[0]) / (CFG.scaleAt[1] - CFG.scaleAt[0])));
    while (this.acc >= 1 && L.length < max) {
      this.acc -= 1;
      // ローディングは水の中のどこからでも生まれる（短い時間でも泡が見えるように）。ページは下から
      // 水面のすぐ近くは避ける（生まれてすぐ水面の上に出て消えないように）
      var top = Math.max(sy, 0) + 30;
      var y0 = this.anywhere ? top + Math.random() * Math.max(0, h - top) : h + 10;
      L.push({ x0: Math.random() * w, y: y0, r0: rnd(CFG.r0) * sc, v: rnd(CFG.speed), wa: rnd(CFG.wobble), wf: 1 + Math.random() * 1.5, ph: Math.random() * 6.28, t: this.seedLeft-- > 0 ? 0.5 : 0, out: -1, vx: 0, a: 1 });
    }
    if (this.acc > 1 && !this.anywhere) this.acc = 1;

    var ctx = this.ctx; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    for (var i = L.length - 1; i >= 0; i--) {
      var b = L[i]; b.t += dt;
      if (b.out < 0) {
        // 水中：まっすぐ上がりながら小さく横ゆれ。水面を越えたら漂いに切り替え
        b.y -= b.v * dt;
        b.x = b.x0 + Math.sin(b.t * b.wf + b.ph) * b.wa;
        if (b.y < sy) { b.out = 0; b.vy = -b.v * 0.35; b.vx = (Math.random() - 0.5) * 30; }
      } else {
        // 水面の上：ゆっくり上がりつつ左右にふわふわ漂い、だんだん薄くなって消える
        // 水位が上がって追いついたら、また水中の泡に戻る
        if (b.y > sy + r0(b)) { b.out = -1; b.life = 0; b.x0 = b.x - Math.sin(b.t * b.wf + b.ph) * b.wa; }
        else {
          b.out += dt;
          b.vy *= Math.pow(0.6, dt);
          b.y += b.vy * dt;
          b.x0 += b.vx * dt;
          b.x = b.x0 + Math.sin(b.t * b.wf * 0.7 + b.ph) * b.wa * 1.8;
          if (!b.life) b.life = rnd(CFG.driftLife);
          b.a = 1 - b.out / b.life;
        }
      }
      if (b.out < 0) b.a = Math.min(1, b.t / 0.5);  // 生まれた直後はふわっと現れる
      // 上に行くほど大きく（画面の一番下で1倍→一番上で grow 倍）
      var r = b.r0 * (1 + (CFG.grow - 1) * Math.max(0, Math.min(1, 1 - b.y / h)));
      if (b.a <= 0 || b.y < -r * 2) { L.splice(i, 1); continue; }
      draw(ctx, b.x, b.y, r, b.a, b.out >= 0 || b.y < sy);
    }
  };

  // 水中は白い泡、水面の上（明るい背景）は水色の泡
  function draw(ctx, x, y, r, a, above) {
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = above ? 'rgba(140,194,247,.22)' : 'rgba(255,255,255,.14)'; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = above ? 'rgba(61,151,242,.6)' : 'rgba(255,255,255,.75)'; ctx.stroke();
    if (r > 3) {  // 光の反射
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  var layers = [
    new Layer(function () { var l = document.getElementById('loading'); return l && l.querySelector('.ld-water'); }, 'z-index:1', CFG.loadingRate, true),
    new Layer(function () { return document.querySelector('[data-water]'); }, '', CFG.rate, false)
  ];
  window.AQ_BUBBLES = layers;  // 確認用（泡の数などを外から見られるように）
  var last = performance.now();
  (function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (var i = 0; i < layers.length; i++) layers[i].step(dt);
    requestAnimationFrame(loop);
  })(last);
})();
