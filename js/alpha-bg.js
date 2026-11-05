/**
 * 透明色の背景（市松模様 / 白 / 黒）の切り替え
 * - <html> の data-alpha-bg 属性に "checker" / "white" / "black" を設定し、CSS 側で .checker の背景を切り替える
 * - 選んだ背景はブラウザ（localStorage）に保存し、次回開いたときも引き継ぐ
 * ※ 描画前に背景を確定させるため、head 内で同期的に読み込むこと
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'color-picker-alpha-bg';
  const VALUES = ['checker', 'white', 'black'];
  const DEFAULT_VALUE = 'checker';
  const root = document.documentElement;

  /** 保存済みの背景を取得する（未保存・不正値・ストレージ使用不可なら既定値） */
  function loadSaved() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return VALUES.indexOf(value) !== -1 ? value : DEFAULT_VALUE;
    } catch (e) {
      return DEFAULT_VALUE;
    }
  }

  /** 背景を保存する（プライベートモード等で失敗しても動作は続ける） */
  function save(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* 保存できなくても切り替え自体は有効なので無視する */
    }
  }

  /** 選択中のボタンだけ押下状態にする */
  function updateButtons(value) {
    document.querySelectorAll('[data-alpha-bg-option]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.alphaBgOption === value));
    });
  }

  /** 背景を適用する */
  function apply(value) {
    root.setAttribute('data-alpha-bg', value);
    updateButtons(value);
  }

  // ===== 初期背景の適用（描画前に実行される） =====
  apply(loadSaved());

  // ===== ボタンの準備（DOM 構築後） =====
  document.addEventListener('DOMContentLoaded', function () {
    updateButtons(root.getAttribute('data-alpha-bg'));

    // クリックしたボタンの背景に切り替えて保存する
    document.querySelectorAll('[data-alpha-bg-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        const value = button.dataset.alphaBgOption;
        apply(value);
        save(value);
      });
    });
  });
})();
