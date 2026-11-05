/**
 * 色の変更履歴（Undo / Redo）
 * 「確定済みの色」を 1 つ持ち、確定のたびに直前の確定色を Undo 用の履歴に積む
 * ドラッグ中などの途中経過は確定しないことで、1 回の操作を 1 件の履歴にまとめる
 *
 * 使い方: const history = ColorHistory.create(初期の色 { h, s, v, a })
 *   history.commit(current) : 現在の色を確定する（確定色から変化していれば履歴に積む）
 *   history.undo(current)   : 1 つ前の色を返す（無ければ null）
 *   history.redo(current)   : 取り消した色を返す（無ければ null）
 *   history.canUndo(current) / history.canRedo(current) : 実行できるかどうか
 */
window.ColorHistory = (function () {
  'use strict';

  // 履歴として保持する最大件数（古いものから捨てる）
  const MAX_HISTORY = 100;

  /** 色の複製を作る（状態オブジェクトを直接共有しないため） */
  function copy(color) {
    return { h: color.h, s: color.s, v: color.v, a: color.a };
  }

  /** 2 つの色が同じかどうか */
  function equals(x, y) {
    return x.h === y.h && x.s === y.s && x.v === y.v && x.a === y.a;
  }

  function create(initial) {
    // 確定済みの色（Undo / Redo の基準）
    let committed = copy(initial);
    // 取り消し用の履歴（末尾が最新）と、やり直し用の履歴
    const undoStack = [];
    let redoStack = [];

    /** 現在の色を確定する。変化があれば直前の確定色を履歴に積み、やり直し履歴は破棄する */
    function commit(current) {
      if (equals(current, committed)) return false;
      undoStack.push(committed);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
      committed = copy(current);
      return true;
    }

    /** 1 つ前の色に戻す。未確定の変更があれば先に確定し、その変更から取り消す */
    function undo(current) {
      commit(current);
      if (undoStack.length === 0) return null;
      redoStack.push(committed);
      committed = undoStack.pop();
      return copy(committed);
    }

    /** 取り消した色をやり直す。未確定の変更があればそれを確定し、やり直し履歴は破棄される */
    function redo(current) {
      commit(current);
      if (redoStack.length === 0) return null;
      undoStack.push(committed);
      committed = redoStack.pop();
      return copy(committed);
    }

    return {
      commit: commit,
      undo: undo,
      redo: redo,
      // 未確定の変更がある場合も取り消し可能とみなす
      canUndo: function (current) { return undoStack.length > 0 || !equals(current, committed); },
      // 未確定の変更がある場合はやり直し履歴が破棄されるため不可とみなす
      canRedo: function (current) { return redoStack.length > 0 && equals(current, committed); }
    };
  }

  return { create: create };
})();
