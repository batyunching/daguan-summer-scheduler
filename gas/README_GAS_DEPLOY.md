# 大觀國中暑期排課系統 GAS 部署說明

## 1. 建立 Google Sheets

建立一份 Google 試算表。你可以不用手動建立分頁，先部署 GAS 後執行 `initializeSheets`，程式會自動建立下列繁體中文分頁與表頭：

- `系統設定`
- `使用者帳號`
- `教師設定`
- `班級設定`
- `課程節數配額`
- `場地設定`
- `社會科安排`
- `預排與鎖定`
- `課表資料庫`
- `課表版本`
- `操作紀錄`

程式內部仍保留英文欄位代碼，所以前端可以穩定讀寫；使用者在 Google Sheets 看到的是中文欄位。

## 2. 建立 Apps Script

1. 在試算表中開啟「擴充功能」→「Apps Script」。
2. 將本資料夾的 `Code.gs` 貼到 Apps Script 編輯器。
3. 若 Apps Script 不是從試算表內建立，請到「專案設定」新增 Script Property：
   - Key：`SPREADSHEET_ID`
   - Value：你的 Google Sheets ID

## 3. 部署 Web App

1. 點選「部署」→「新增部署作業」。
2. 類型選擇「網頁應用程式」。
3. 執行身分選擇「我」。
4. 存取權建議先選「知道連結的任何人」。
5. 部署後複製 Web App URL。

## 4. 前端連線

打開 GitHub Pages 上的排課系統，進入「資料設定」，貼上 Web App URL 並儲存。

前端會用 `text/plain` POST 傳送 JSON，避免瀏覽器預檢請求造成 GAS 連線問題。

## 5. 初始化表頭

可用瀏覽器或前端 API 呼叫：

```text
https://script.google.com/macros/s/你的部署ID/exec?action=initializeSheets
```

初始化後，請在 `使用者帳號` 表新增至少一位管理者。密碼雜湊使用前端 `js/auth.js` 的 FNV-1a 簡易 hash；示範帳密如下：

| email | password | passwordHash |
|---|---|---|
| admin@daguan.ntpc.edu.tw | admin123 | 7045830c |
| teacher@daguan.ntpc.edu.tw | teacher123 | 6668142b |

正式上線建議改用 Google OAuth 或學校既有登入機制。

`教師設定` 會包含「教師職位」「可授課星期」「不可排課日期」與「排課節次」欄位，不再包含「備註」。教師職位可填 `組長`、`導師`、`專任`；可授課星期可填 `1,2,4,5` 或 `星期一,星期二,星期四,星期五`，留空代表週一到週五都可排；不可排課日期可填 `7/15,7/22` 或 `2026-07-15,2026-07-22`，留空代表沒有特定日期限制；排課節次可填 `1,2,3,4` 或 `3,4`，留空代表第 1-4 節都可排，若填 `3,4` 則只能排入第 3-4 節。若舊表尚未出現新欄位，請更新 `Code.gs` 後執行 `action=initializeSheets&forceHeaders=true` 或 `action=localizeHeaders`，再於最後欄位填入設定。

上課週數由 `系統設定` 控制，不需要在 `班級設定` 逐班填寫。請確認 `grade8Weeks` 為 `3`、`grade9Weeks` 為 `5`；班級只要填「年級」，前端就會依年級決定排課週數。若舊表還留有「上課週次」欄位，請更新 `Code.gs` 後執行 `action=initializeSheets&forceHeaders=true` 或 `action=localizeHeaders` 清理表頭。

`課表資料庫` 會包含「管理者同意連四」欄位。這個欄位由前端調課二次確認自動寫入，用來記錄同班同科同一天 4 節的管理者核准例外。若舊表尚未出現此欄位，請更新 `Code.gs` 後執行 `action=initializeSheets&forceHeaders=true` 或 `action=localizeHeaders`。

## 已經建立過英文表頭怎麼辦

如果你先前已用舊版程式建立過分頁，分頁名稱可能已經是中文，但第 1 列表頭仍是英文。請更新 Apps Script 的 `Code.gs` 後，在瀏覽器執行：

```text
https://script.google.com/macros/s/你的部署ID/exec?action=localizeHeaders
```

這個動作會依欄位名稱保留第 2 列以後的資料，並更新表頭；新版已移除的欄位，例如教師設定的「備註」，會從表頭與資料區移除。

也可以使用：

```text
https://script.google.com/macros/s/你的部署ID/exec?action=initializeSheets&forceHeaders=true
```
