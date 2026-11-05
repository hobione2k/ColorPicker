/**
 * マイカラー機能
 * 現在の色をブラウザの localStorage に保存し、画面下部にグリッド状のブロックで一覧表示する
 * ブロックをクリックするとその色を呼び出し、× ボタンで削除する
 *
 * 使い方: MyColors.init({ getColor, applyColor, notify })
 *   getColor()      : 現在の色を { h, s, v, a, hex } で返す関数
 *   applyColor(hsva): 保存済みの色 { h, s, v, a } を画面に反映する関数
 *   notify(message) : 通知メッセージを表示する関数
 */
window.MyColors = (function () {
  'use strict';

  // localStorage に保存するときのキー
  const STORAGE_KEY = 'colorpicker.myColors';

  // ===== 保存データの読み書き =====

  /** 保存済みの色の一覧を読み込む（未保存・破損・ストレージ使用不可の場合は空配列） */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      // 想定外の形のデータは読み飛ばす
      return list.filter(function (item) {
        return item && typeof item.hex === 'string' &&
          ['h', 's', 'v', 'a'].every(function (k) { return typeof item[k] === 'number'; });
      });
    } catch (e) {
      return [];
    }
  }

  /** 色の一覧を保存する（成功したら true） */
  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ===== 初期化 =====

  function init(options) {
    const grid = document.getElementById('my-colors-grid');
    const empty = document.getElementById('my-colors-empty');
    const saveButton = document.getElementById('my-colors-save');

    // 画面表示中の一覧（保存データと常に同じ内容を保つ）
    let colors = load();

    /** 一覧を描画し直す */
    function render() {
      grid.textContent = '';
      // 1 件も無いときは案内文を表示する
      empty.hidden = colors.length > 0;

      colors.forEach(function (color, index) {
        // 1 色分のブロック（呼び出しボタン + 削除ボタン）
        const item = document.createElement('li');
        item.className = 'my-colors__item';

        // 色ブロック本体: 市松模様の上に保存色を重ねて透明度も分かるようにする
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'my-colors__swatch checker';
        swatch.title = color.hex;
        swatch.setAttribute('aria-label', color.hex + ' を呼び出す');
        const fill = document.createElement('span');
        fill.className = 'my-colors__fill';
        fill.style.background = color.hex;
        swatch.appendChild(fill);
        swatch.addEventListener('click', function () {
          // 呼び出し時は通知を出さず、色の反映のみ行う
          options.applyColor(color);
        });

        // 削除ボタン（ブロック右上に重ねて表示）
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'my-colors__remove';
        remove.textContent = '×';
        remove.title = '削除';
        remove.setAttribute('aria-label', color.hex + ' を削除');
        remove.addEventListener('click', function () {
          colors.splice(index, 1);
          save(colors);
          // 削除時は通知を出さず、一覧の更新のみ行う
          render();
        });

        item.appendChild(swatch);
        item.appendChild(remove);
        grid.appendChild(item);
      });
    }

    // 「現在の色を保存」ボタン: 同じ色が既にあれば追加しない
    saveButton.addEventListener('click', function () {
      const current = options.getColor();
      const exists = colors.some(function (c) { return c.hex.toLowerCase() === current.hex.toLowerCase(); });
      if (exists) {
        options.notify('既に保存されています: ' + current.hex);
        return;
      }
      const next = colors.concat([{ h: current.h, s: current.s, v: current.v, a: current.a, hex: current.hex }]);
      if (!save(next)) {
        options.notify('保存できませんでした（ブラウザの保存領域を利用できません）');
        return;
      }
      colors = next;
      // 保存時は通知を出さず、一覧の更新のみ行う
      render();
    });

    // 別タブで保存・削除された場合も一覧を同期する
    window.addEventListener('storage', function (e) {
      if (e.key !== STORAGE_KEY) return;
      colors = load();
      render();
    });

    render();
  }

  return { init: init };
})();
