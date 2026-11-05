/**
 * ライト / ダークテーマの切り替え
 * - <html> の data-theme 属性に "light" / "dark" を設定し、CSS 側で配色を切り替える
 * - 選んだテーマはブラウザ（localStorage）に保存し、次回開いたときも引き継ぐ
 * - 一度も選んでいない場合は OS の設定に従い、OS 側の変更にも追従する
 * ※ 描画前にテーマを確定させるため、head 内で同期的に読み込むこと
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'color-picker-theme';
  const root = document.documentElement;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /** 保存済みのテーマを取得する（未保存・ストレージ使用不可なら null） */
  function loadSavedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (e) {
      return null;
    }
  }

  /** テーマを保存する（プライベートモード等で失敗しても動作は続ける） */
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* 保存できなくても切り替え自体は有効なので無視する */
    }
  }

  /** 現在の OS 設定に応じたテーマ名を返す */
  function systemTheme() {
    return darkQuery.matches ? 'dark' : 'light';
  }

  /** ボタンの表示を「押すと切り替わる先のテーマ」に合わせて更新する */
  function updateButton(theme) {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    button.querySelector('.theme-toggle__icon').textContent = next === 'dark' ? '🌙' : '☀️';
    button.querySelector('.theme-toggle__label').textContent = next === 'dark' ? 'ダーク' : 'ライト';
    button.setAttribute('aria-label', (next === 'dark' ? 'ダーク' : 'ライト') + 'テーマに切り替え');
    button.title = button.getAttribute('aria-label');
  }

  /** テーマを適用する */
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    updateButton(theme);
  }

  // ===== 初期テーマの適用（描画前に実行される） =====
  applyTheme(loadSavedTheme() || systemTheme());

  // ユーザーが未選択の間は OS のテーマ変更に追従する
  darkQuery.addEventListener('change', function () {
    if (!loadSavedTheme()) applyTheme(systemTheme());
  });

  // ===== ボタンの準備（DOM 構築後） =====
  document.addEventListener('DOMContentLoaded', function () {
    const current = root.getAttribute('data-theme');
    updateButton(current);

    // クリックでライト ⇔ ダークを切り替えて保存する
    document.getElementById('theme-toggle').addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
    });
  });
})();
