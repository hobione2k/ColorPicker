/**
 * 色形式の相互変換ユーティリティ
 * file:// で直接開いても動作するよう、ES Modules ではなくグローバル変数として公開する
 *
 * 各形式の値の範囲:
 *   RGBA : r,g,b = 0〜255 の整数, a = 0〜1
 *   HSV  : h = 0〜360, s,v = 0〜100
 *   HEX  : "#RRGGBB" または "#RRGGBBAA"（入力は #RGB / #RGBA の短縮形も可）
 */
(function (global) {
  'use strict';

  /** 値を min〜max の範囲に収める */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** HSV(+A) → RGBA に変換する */
  function hsvToRgb(h, s, v, a) {
    // 色相を 0〜360 に正規化し、彩度・明度を 0〜1 に変換
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s, 0, 100) / 100;
    const val = clamp(v, 0, 100) / 100;

    // 色相環を 60 度ずつ 6 区間に分けて RGB を求める
    const c = val * sat;                        // 彩度成分（最大値と最小値の差）
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = val - c;                          // 明度の底上げ分

    let r1 = 0, g1 = 0, b1 = 0;
    if (hue < 60)       { r1 = c; g1 = x; b1 = 0; }
    else if (hue < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (hue < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (hue < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (hue < 300) { r1 = x; g1 = 0; b1 = c; }
    else                { r1 = c; g1 = 0; b1 = x; }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
      a: a === undefined ? 1 : clamp(a, 0, 1)
    };
  }

  /** RGBA → HSV(+A) に変換する */
  function rgbToHsv(r, g, b, a) {
    // 0〜1 に正規化
    const rn = clamp(r, 0, 255) / 255;
    const gn = clamp(g, 0, 255) / 255;
    const bn = clamp(b, 0, 255) / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;

    // 色相: 最大成分によって計算式が変わる（無彩色の場合は 0）
    let h = 0;
    if (d !== 0) {
      if (max === rn)      h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else                 h = 60 * ((rn - gn) / d + 4);
    }
    if (h < 0) h += 360;

    // 彩度: 最大値に対する差の割合 / 明度: 最大値
    const s = max === 0 ? 0 : d / max;
    const v = max;

    return {
      h: h,
      s: s * 100,
      v: v * 100,
      a: a === undefined ? 1 : clamp(a, 0, 1)
    };
  }

  /** 0〜255 の数値を 2 桁の 16 進文字列にする */
  function toHex2(n) {
    return Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
  }

  /**
   * RGBA → カラーコードに変換する
   * 不透明（a = 1）なら #RRGGBB、半透明なら #RRGGBBAA を返す
   */
  function rgbToHex(r, g, b, a) {
    const base = '#' + toHex2(r) + toHex2(g) + toHex2(b);
    if (a === undefined || a >= 1) return base;
    return base + toHex2(a * 255);
  }

  /**
   * カラーコード → RGBA に変換する
   * 解釈できない文字列の場合は null を返す
   */
  function hexToRgb(hex) {
    // 先頭の # は省略可、前後の空白は無視
    let str = String(hex).trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]+$/.test(str)) return null;

    // 短縮形（#RGB / #RGBA）は各桁を 2 回繰り返して展開
    if (str.length === 3 || str.length === 4) {
      str = str.split('').map(function (ch) { return ch + ch; }).join('');
    }
    if (str.length !== 6 && str.length !== 8) return null;

    return {
      r: parseInt(str.slice(0, 2), 16),
      g: parseInt(str.slice(2, 4), 16),
      b: parseInt(str.slice(4, 6), 16),
      a: str.length === 8 ? parseInt(str.slice(6, 8), 16) / 255 : 1
    };
  }

  // ===== 文字列の解析（貼り付け用） =====

  /** 文字列から数値（末尾の % 付きも含む）を順に取り出す */
  function extractNumbers(text) {
    return String(text).match(/-?\d*\.?\d+%?/g) || [];
  }

  /**
   * 透明度の文字列を 0〜1 の数値にする
   * "50%" → 0.5、"0.5" → 0.5。範囲外・不正は null
   */
  function parseAlpha(token) {
    if (token === undefined) return 1;
    const isPercent = token.endsWith('%');
    const n = parseFloat(token) / (isPercent ? 100 : 1);
    if (Number.isNaN(n) || n < 0 || n > 1) return null;
    return n;
  }

  /**
   * RGBA 形式の文字列を解析する
   * 例: "rgba(69, 149, 230, 0.5)" / "rgb(69 149 230 / 50%)" / "69,149,230"
   * 解釈できない場合は null
   */
  function parseRgbText(text) {
    const nums = extractNumbers(text);
    if (nums.length !== 3 && nums.length !== 4) return null;

    // R/G/B は 0〜255 の数値のみ受け付ける（% 指定は非対応）
    const rgb = nums.slice(0, 3).map(function (t) { return t.endsWith('%') ? NaN : parseFloat(t); });
    if (rgb.some(function (n) { return Number.isNaN(n) || n < 0 || n > 255; })) return null;

    const a = parseAlpha(nums[3]);
    if (a === null) return null;
    return { r: Math.round(rgb[0]), g: Math.round(rgb[1]), b: Math.round(rgb[2]), a: a };
  }

  /**
   * HSV 形式の文字列を解析する
   * 例: "hsva(210, 70%, 90%, 1)" / "hsv(210 70 90)" / "210,70,90"
   * 解釈できない場合は null
   */
  function parseHsvText(text) {
    const nums = extractNumbers(text);
    if (nums.length !== 3 && nums.length !== 4) return null;

    // H は 0〜360、S/V は % の有無にかかわらず 0〜100 として扱う
    const h = parseFloat(nums[0]);
    const s = parseFloat(nums[1]);
    const v = parseFloat(nums[2]);
    if ([h, s, v].some(Number.isNaN)) return null;
    if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100) return null;

    const a = parseAlpha(nums[3]);
    if (a === null) return null;
    return { h: h % 360, s: s, v: v, a: a };
  }

  /**
   * 任意の色文字列を解析する
   * "rgb(...)" や "hsv(...)" のように形式が明示されていればそれに従い、
   * 無ければ preferred の形式 → カラーコードの順に試す
   * （"69,149,230" のような数値の並びは RGB か HSV か判別できないため、preferred の形式でのみ解釈する）
   * @param {string} text 解析する文字列
   * @param {'hex'|'rgba'|'hsv'} preferred 優先して試す形式
   * @returns {{type:'rgb', value:object}|{type:'hsv', value:object}|null}
   */
  function parseColorText(text, preferred) {
    const str = String(text).trim();
    const parsers = {
      hex: function () { const v = hexToRgb(str); return v && { type: 'rgb', value: v }; },
      rgba: function () { const v = parseRgbText(str); return v && { type: 'rgb', value: v }; },
      hsv: function () { const v = parseHsvText(str); return v && { type: 'hsv', value: v }; }
    };

    // 関数形式の接頭辞で形式を判定（hsb は hsv の別名）
    if (/^rgba?\s*\(/i.test(str)) return parsers.rgba();
    if (/^hs[vb]a?\s*\(/i.test(str)) return parsers.hsv();

    // 優先形式 → カラーコードの順に試す
    const order = preferred === 'hex' ? ['hex'] : [preferred, 'hex'];
    for (let i = 0; i < order.length; i++) {
      const parser = parsers[order[i]];
      const result = parser && parser();
      if (result) return result;
    }
    return null;
  }

  // グローバルに公開
  global.ColorConvert = {
    clamp: clamp,
    hsvToRgb: hsvToRgb,
    rgbToHsv: rgbToHsv,
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    parseColorText: parseColorText
  };
})(window);
