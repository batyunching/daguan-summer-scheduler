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

## 已經建立過英文表頭怎麼辦

如果你先前已用舊版程式建立過分頁，分頁名稱可能已經是中文，但第 1 列表頭仍是英文。請更新 Apps Script 的 `Code.gs` 後，在瀏覽器執行：

```text
https://script.google.com/macros/s/你的部署ID/exec?action=localizeHeaders
```

這個動作只會把每個分頁的第 1 列改成繁體中文表頭，不會刪除第 2 列以後的資料。

也可以使用：

```text
https://script.google.com/macros/s/你的部署ID/exec?action=initializeSheets&forceHeaders=true
```
