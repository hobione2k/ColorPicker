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

  // ===== JSON エクスポート / インポート =====

  // エクスポートファイルの形式名とバージョン（インポート時の判別用）
  const EXPORT_FORMAT = 'colorpicker.myColors';
  const EXPORT_VERSION = 1;

  /** 数値を min〜max の範囲に収める */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * インポートした 1 件分のデータを保存形式 { h, s, v, a, hex } に整える
   * hex は必須。h / s / v / a がそろっていればそれを使い、無ければ hex から計算する
   * 解釈できないデータの場合は null を返す
   */
  function normalizeColor(item) {
    const C = window.ColorConvert;
    if (!item || typeof item.hex !== 'string') return null;
    const rgb = C.hexToRgb(item.hex);
    if (!rgb) return null;

    // カラーコードの表記ゆれ（小文字・短縮形など）をアプリ内の表記にそろえる
    const hex = C.rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a);

    const hasHsva = ['h', 's', 'v', 'a'].every(function (k) {
      return typeof item[k] === 'number' && Number.isFinite(item[k]);
    });
    if (hasHsva) {
      return {
        h: clamp(item.h, 0, 360),
        s: clamp(item.s, 0, 100),
        v: clamp(item.v, 0, 100),
        a: clamp(item.a, 0, 1),
        hex: hex
      };
    }
    // HSV が無い場合はカラーコードから求める
    const hsv = C.rgbToHsv(rgb.r, rgb.g, rgb.b, rgb.a);
    return { h: hsv.h, s: hsv.s, v: hsv.v, a: hsv.a, hex: hex };
  }

  /**
   * JSON 文字列から色の一覧を取り出す
   * エクスポート形式 { format, version, colors: [...] } と、色の配列そのものの両方を受け付ける
   * 形式が不正な場合は null を返す
   */
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return null;
    }
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.colors) ? data.colors : null);
    if (!list) return null;
    return list.map(normalizeColor).filter(Boolean);
  }

  /** 文字列をファイルとしてダウンロードさせる */
  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // ダウンロード開始後に一時 URL を解放する
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  /** 今日の日付を YYYYMMDD 形式で返す（ファイル名用） */
  function dateStamp() {
    const d = new Date();
    return String(d.getFullYear()) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
  }

  // ===== 初期化 =====

  function init(options) {
    const grid = document.getElementById('my-colors-grid');
    const empty = document.getElementById('my-colors-empty');
    const saveButton = document.getElementById('my-colors-save');
    const exportButton = document.getElementById('my-colors-export');
    const importButton = document.getElementById('my-colors-import');
    const importFile = document.getElementById('my-colors-import-file');

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

    // 「エクスポート」ボタン: 保存済みの色を JSON ファイルとしてダウンロードする
    exportButton.addEventListener('click', function () {
      if (colors.length === 0) {
        options.notify('エクスポートする色がありません');
        return;
      }
      const data = { format: EXPORT_FORMAT, version: EXPORT_VERSION, colors: colors };
      downloadText(JSON.stringify(data, null, 2), 'my-colors-' + dateStamp() + '.json');
      options.notify(colors.length + ' 色をエクスポートしました');
    });

    // 「インポート」ボタン: 非表示のファイル選択欄を開く
    importButton.addEventListener('click', function () {
      importFile.click();
    });

    // ファイルが選ばれたら読み込み、既存の一覧に追加する（同じ色は追加しない）
    importFile.addEventListener('change', function () {
      const file = importFile.files && importFile.files[0];
      // 同じファイルを続けて選んでも change が発生するよう選択状態を戻す
      importFile.value = '';
      if (!file) return;

      file.text().then(function (text) {
        const imported = parseImport(text);
        if (!imported) {
          options.notify('読み込めませんでした（JSON の形式が正しくありません）');
          return;
        }

        // 既存の色と、ファイル内で重複する色を除いて追加する
        const known = new Set(colors.map(function (c) { return c.hex.toLowerCase(); }));
        const added = imported.filter(function (c) {
          const key = c.hex.toLowerCase();
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        if (added.length === 0) {
          options.notify('追加できる新しい色はありませんでした');
          return;
        }

        const next = colors.concat(added);
        if (!save(next)) {
          options.notify('保存できませんでした（ブラウザの保存領域を利用できません）');
          return;
        }
        colors = next;
        render();
        options.notify(added.length + ' 色をインポートしました');
      }).catch(function () {
        options.notify('ファイルを読み込めませんでした');
      });
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
