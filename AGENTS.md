# AGENTS.md

## Project

本專案是大觀國中暑期課表排課系統，使用 GitHub Pages + Google Sheets + Google Apps Script。

## Rules for Codex

- 請使用繁體中文註解與介面文字。
- 不要加入 Firebase 或 Supabase。
- 不要把複雜排課演算法寫在 GAS。
- GAS 只做 Google Sheets 的讀取、寫入、更新、版本儲存。
- 前端 JavaScript 負責排課演算法、拖拉調課、衝突檢查、匯出功能。
- 每完成一個模組，請確認不會破壞既有功能。
- 新增功能時，請同步更新 README.md。

## Acceptance

- 系統必須可以在 GitHub Pages 執行。
- 系統必須可以透過 GAS API 讀寫 Google Sheets。
- 沒有 API URL 時，前端應顯示清楚錯誤訊息。
- 所有排課結果都必須先通過衝突檢查才能儲存。
