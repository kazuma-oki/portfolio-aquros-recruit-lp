/* 計測用：ボタン・リンクのクリックを Google タグ マネージャー（GTM）に知らせる
   見た目・動きには影響しない（クリックを横で見ているだけ）。GTM を入れていなくても何も起きない。

   GTM に送るイベント（dataLayer）
     line_click … 公式LINEへのボタン      cta_click … 「募集要項」ボタン      sns_click … Instagram / TikTok
   一緒に送る値
     link_position … ボタンの場所（menu＝メニュー内／pc-side＝PCの右側／flow＝選考の流れ／contact＝お問い合わせ／sticky＝画面下の追従ボタン／footer＝フッター）
     link_url      … リンク先のURL
     sns           … instagram / tiktok（sns_click のときだけ） */
(function () {
  window.dataLayer = window.dataLayer || [];

  function kind(href) {
    if (/line\.me|lin\.ee/.test(href)) return 'line_click';
    if (href === '#recruit') return 'cta_click';
    if (/instagram\.com/.test(href)) return 'sns_click';
    if (/tiktok\.com/.test(href)) return 'sns_click';
    return null;
  }

  function position(a) {
    if (a.closest('aside')) return 'pc-side';
    if (a.closest('footer')) return 'footer';
    var sec = a.closest('section[id]');
    if (sec) return sec.id;
    // 画面下に固定された追従ボタンか、メニューか（どちらも固定表示の中にある）
    for (var el = a.parentElement; el && el !== document.body; el = el.parentElement) {
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed') return cs.bottom === '0px' && cs.top !== '0px' ? 'sticky' : 'menu';
    }
    return 'other';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var ev = kind(href);
    if (!ev) return;
    var data = { event: ev, link_position: position(a), link_url: a.href };
    if (ev === 'sns_click') data.sns = /instagram/.test(href) ? 'instagram' : 'tiktok';
    window.dataLayer.push(data);
  }, true);
})();
