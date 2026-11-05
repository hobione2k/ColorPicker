/**
 * カラーピッカー本体の画面制御
 * 内部状態は HSVA で保持する（無彩色・黒でも色相が失われないようにするため）
 */
(function () {
  'use strict';

  const C = window.ColorConvert;

  // ===== 内部状態 =====
  // h: 0〜360, s/v: 0〜100, a: 0〜1
  const state = { h: 210, s: 70, v: 90, a: 1 };

  // ===== ホイールの寸法（直径に対する割合。style.css の .wheel 系と揃えること） =====
  const RING_INNER_RADIUS = 40;   // リング内側の半径 [%]
  const HUE_CURSOR_RADIUS = 45;   // 色相つまみを置く半径（リング幅の中央）[%]

  // ===== DOM 要素の取得 =====
  const $ = function (id) { return document.getElementById(id); };
  const el = {
    wheel: $('wheel'),
    hueCursor: $('hue-cursor'),
    svPanel: $('sv-panel'),
    svCursor: $('sv-cursor'),
    preview: $('preview-color'),
    alphaSlider: $('alpha-slider'),
    hex: $('hex-input'),
    r: $('rgb-r'), g: $('rgb-g'), b: $('rgb-b'), ra: $('rgb-a'),
    h: $('hsv-h'), s: $('hsv-s'), v: $('hsv-v'), ha: $('hsv-a'),
    toast: $('toast')
  };

  // ===== 表示用の文字列生成 =====

  /** 小数を指定桁で丸め、末尾の不要な 0 を落とす */
  function round(n, digits) {
    const p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  }

  /** 現在の色を各形式の文字列で取得する（コピー用） */
  function formatted() {
    const rgb = C.hsvToRgb(state.h, state.s, state.v, state.a);
    const a = round(state.a, 2);
    return {
      hex: C.rgbToHex(rgb.r, rgb.g, rgb.b, state.a),
      rgba: 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + a + ')',
      hsv: 'hsva(' + Math.round(state.h) + ', ' + Math.round(state.s) + '%, ' + Math.round(state.v) + '%, ' + a + ')'
    };
  }

  // ===== 画面への反映 =====

  /**
   * 状態を画面全体に反映する
   * @param {string} [source] 入力元のグループ名。編集中の欄を上書きしないよう、そのグループは更新しない
   */
  function render(source) {
    const rgb = C.hsvToRgb(state.h, state.s, state.v, state.a);
    const rgbaCss = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + state.a + ')';
    const opaqueCss = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';

    // 彩度・明度パネルの下地色（現在の色相の純色）
    const hueRgb = C.hsvToRgb(state.h, 100, 100);
    const hueCss = 'rgb(' + hueRgb.r + ',' + hueRgb.g + ',' + hueRgb.b + ')';
    el.svPanel.style.setProperty('--hue-color', hueCss);

    // 色相つまみをリング上の角度に配置（上が 0°、時計回り）
    const rad = state.h * Math.PI / 180;
    el.hueCursor.style.left = (50 + HUE_CURSOR_RADIUS * Math.sin(rad)) + '%';
    el.hueCursor.style.top = (50 - HUE_CURSOR_RADIUS * Math.cos(rad)) + '%';
    el.hueCursor.style.background = hueCss;
    el.hueCursor.setAttribute('aria-valuenow', Math.round(state.h));

    // 彩度・明度パネル上のカーソル位置（左→右: 彩度、上→下: 明度が下がる）
    el.svCursor.style.left = state.s + '%';
    el.svCursor.style.top = (100 - state.v) + '%';
    el.svCursor.style.background = opaqueCss;

    // プレビュー
    el.preview.style.background = rgbaCss;

    // 透明度スライダーの背景グラデーション（透明 → 現在の色）
    el.alphaSlider.style.setProperty('--alpha-gradient',
      'linear-gradient(to right, rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0), ' + opaqueCss + ')');

    // スライダーの値
    if (source !== 'alpha') el.alphaSlider.value = Math.round(state.a * 100);

    // カラーコード欄
    if (source !== 'hex') {
      el.hex.value = C.rgbToHex(rgb.r, rgb.g, rgb.b, state.a);
      el.hex.classList.remove('is-invalid');
    }

    // RGBA 欄
    if (source !== 'rgb') {
      el.r.value = rgb.r;
      el.g.value = rgb.g;
      el.b.value = rgb.b;
      el.ra.value = round(state.a, 2);
    }

    // HSV 欄
    if (source !== 'hsv') {
      el.h.value = Math.round(state.h);
      el.s.value = Math.round(state.s);
      el.v.value = Math.round(state.v);
      el.ha.value = round(state.a, 2);
    }
  }

  // ===== 入力値の読み取り =====

  /** 数値入力欄から値を読み取る（空欄・不正値は null） */
  function readNumber(input, min, max) {
    const n = parseFloat(input.value);
    if (Number.isNaN(n)) return null;
    return C.clamp(n, min, max);
  }

  /** RGB 値を状態に反映する（無彩色・黒のときは現在の色相を維持する） */
  function setFromRgb(rgb) {
    const hsv = C.rgbToHsv(rgb.r, rgb.g, rgb.b, rgb.a);
    // 彩度 0 や明度 0 では色相が定まらないので、直前の色相を残す
    if (hsv.s !== 0 && hsv.v !== 0) state.h = hsv.h;
    // 明度 0 では彩度も定まらないので、直前の彩度を残す
    if (hsv.v !== 0) state.s = hsv.s;
    state.v = hsv.v;
    state.a = hsv.a;
  }

  // ===== イベント: 彩度・明度パネル =====

  /** ポインター位置から彩度・明度を求めて反映する */
  function updateSvFromPointer(e) {
    const rect = el.svPanel.getBoundingClientRect();
    const x = C.clamp(e.clientX - rect.left, 0, rect.width);
    const y = C.clamp(e.clientY - rect.top, 0, rect.height);
    state.s = (x / rect.width) * 100;
    state.v = 100 - (y / rect.height) * 100;
    render();
  }

  // 押下でドラッグ開始（パネル外に出ても追従するようポインターをキャプチャ）
  el.svPanel.addEventListener('pointerdown', function (e) {
    el.svPanel.setPointerCapture(e.pointerId);
    el.svPanel.focus();
    updateSvFromPointer(e);
  });
  // ドラッグ中のみ追従
  el.svPanel.addEventListener('pointermove', function (e) {
    if (el.svPanel.hasPointerCapture(e.pointerId)) updateSvFromPointer(e);
  });

  // 矢印キーで微調整（Shift 押下時は 10 刻み）
  el.svPanel.addEventListener('keydown', function (e) {
    const step = e.shiftKey ? 10 : 1;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step]
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    state.s = C.clamp(state.s + move[0], 0, 100);
    state.v = C.clamp(state.v + move[1], 0, 100);
    render();
  });

  // ===== イベント: 色相リング =====

  /** ポインター位置からホイール中心に対する角度（上が 0°、時計回り）を求めて色相に反映する */
  function updateHueFromPointer(e) {
    const rect = el.wheel.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    // atan2(dx, -dy) で「真上から時計回り」の角度になる
    const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    state.h = (deg + 360) % 360;
    render();
  }

  /** ポインターがリング（内半径より外側）上にあるか判定する */
  function isOnRing(e) {
    const rect = el.wheel.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inner = rect.width * RING_INNER_RADIUS / 100;
    const outer = rect.width / 2;
    return dist >= inner && dist <= outer;
  }

  // リング上（またはつまみ）を押したらドラッグ開始。中央パネルは別処理なので除外
  el.wheel.addEventListener('pointerdown', function (e) {
    if (el.svPanel.contains(e.target)) return;
    if (e.target !== el.hueCursor && !isOnRing(e)) return;
    e.preventDefault();
    el.wheel.setPointerCapture(e.pointerId);
    el.hueCursor.focus();
    updateHueFromPointer(e);
  });
  // ドラッグ中のみ追従（リングの外に出ても角度で追従する）
  el.wheel.addEventListener('pointermove', function (e) {
    if (el.wheel.hasPointerCapture(e.pointerId)) updateHueFromPointer(e);
  });

  // 色相つまみの矢印キー操作（右・上で時計回り、Shift 押下時は 10 刻み）
  el.hueCursor.addEventListener('keydown', function (e) {
    const step = e.shiftKey ? 10 : 1;
    const deltas = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step };
    const delta = deltas[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    state.h = (state.h + delta + 360) % 360;
    render();
  });

  // ===== イベント: スライダー =====

  // 透明度スライダー（0〜100 を 0〜1 に変換）
  el.alphaSlider.addEventListener('input', function () {
    state.a = parseFloat(el.alphaSlider.value) / 100;
    render('alpha');
  });

  // ===== イベント: カラーコード入力 =====

  el.hex.addEventListener('input', function () {
    const rgb = C.hexToRgb(el.hex.value);
    // 不正な値の間は枠を赤くするだけで状態は変えない
    el.hex.classList.toggle('is-invalid', rgb === null);
    if (!rgb) return;
    setFromRgb(rgb);
    render('hex');
  });
  // フォーカスが外れたら正規化した表記に戻す
  el.hex.addEventListener('blur', function () { render(); });

  // ===== イベント: RGBA 入力 =====

  [el.r, el.g, el.b, el.ra].forEach(function (input) {
    input.addEventListener('input', function () {
      const r = readNumber(el.r, 0, 255);
      const g = readNumber(el.g, 0, 255);
      const b = readNumber(el.b, 0, 255);
      const a = readNumber(el.ra, 0, 1);
      // いずれかが未入力・不正なら反映しない
      if (r === null || g === null || b === null || a === null) return;
      setFromRgb({ r: Math.round(r), g: Math.round(g), b: Math.round(b), a: a });
      render('rgb');
    });
    // フォーカスが外れたら範囲内に補正した値を表示し直す
    input.addEventListener('blur', function () { render(); });
  });

  // ===== イベント: HSV 入力 =====

  [el.h, el.s, el.v, el.ha].forEach(function (input) {
    input.addEventListener('input', function () {
      const h = readNumber(el.h, 0, 360);
      const s = readNumber(el.s, 0, 100);
      const v = readNumber(el.v, 0, 100);
      const a = readNumber(el.ha, 0, 1);
      if (h === null || s === null || v === null || a === null) return;
      state.h = h;
      state.s = s;
      state.v = v;
      state.a = a;
      render('hsv');
    });
    input.addEventListener('blur', function () { render(); });
  });

  // ===== イベント: コピーボタン =====

  /** 画面下部に短いメッセージを表示する */
  let toastTimer = null;
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('is-visible'); }, 1500);
  }

  /** クリップボードへ文字列をコピーする（Clipboard API が使えない環境では旧方式で代替） */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      const text = formatted()[button.dataset.copy];
      copyText(text)
        .then(function () { showToast('コピーしました: ' + text); })
        .catch(function () { showToast('コピーに失敗しました'); });
    });
  });

  // ===== イベント: 貼り付けボタン =====

  /** 各ボタンに対応する形式の表示名（通知メッセージ用） */
  const FORMAT_NAMES = { hex: 'カラーコード', rgba: 'RGBA', hsv: 'HSV' };

  /** 解析済みの色を状態に反映する */
  function applyParsed(parsed) {
    if (parsed.type === 'rgb') {
      setFromRgb(parsed.value);
    } else {
      state.h = parsed.value.h;
      state.s = parsed.value.s;
      state.v = parsed.value.v;
      state.a = parsed.value.a;
    }
    render();
  }

  document.querySelectorAll('[data-paste]').forEach(function (button) {
    button.addEventListener('click', function () {
      const format = button.dataset.paste;

      // Clipboard API の読み取りに対応していないブラウザ
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        showToast('このブラウザはクリップボードの読み取りに対応していません');
        return;
      }

      navigator.clipboard.readText()
        .then(function (text) {
          // ボタンの形式を優先しつつ、他の形式で書かれていても解釈する
          const parsed = C.parseColorText(text, format);
          if (!parsed) {
            showToast(FORMAT_NAMES[format] + 'として解釈できません: ' + text.trim().slice(0, 40));
            return;
          }
          applyParsed(parsed);
          showToast('貼り付けました: ' + formatted()[format]);
        })
        // 読み取りの許可が拒否された場合など
        .catch(function () { showToast('クリップボードを読み取れませんでした'); });
    });
  });

  // ===== マイカラー =====

  window.MyColors.init({
    // 現在の色（HSVA とカラーコード）を渡す
    getColor: function () {
      return { h: state.h, s: state.s, v: state.v, a: state.a, hex: formatted().hex };
    },
    // 保存済みの色を状態に反映する（HSVA のまま戻すので色相も保存時のまま再現される）
    applyColor: function (color) {
      state.h = color.h;
      state.s = color.s;
      state.v = color.v;
      state.a = color.a;
      render();
    },
    notify: showToast
  });

  // ===== 初期表示 =====
  render();
})();
