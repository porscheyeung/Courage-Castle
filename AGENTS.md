# 勇氣城堡

先讀 README.md 與 docs/TEST-RESULTS.md。純靜態 HTML／CSS／JavaScript，不需打包；GitHub Pages 用 main 根目錄。

- 存檔 key `courage-castle-save-v2` 與 V2.3 及強壯城堡共用：只可在事件內加欄位（目前 `ts`、`note`），不可改格式或排位演算法；`tests/engine.test.js` 會直接比對 v2.3.html 的排位。
- V3 額外設定放 `courage-castle-v3-extras`；第一次用 V3 打開時把原存檔另存到 `courage-castle-save-v2-before-v3`，之後不得覆寫。
- `v2.3.html` 是舊版原檔，不要修改。
- 日記預設不寫：改正後只在訊息欄顯示「✏️ 寫日記」，不可自動彈出日記對話框。
- iPhone：城堡上不可放文字。標籤只在頂部、工具列在底部，鏡頭 `home()` 會避開；手機上小紙條顯示在城堡下方的訊息欄而非氣泡。iPhone 測試會檢查遮擋。
- 光暈、燈串、藍圖要保持 `pointer-events:none`，否則會搶走點擊。
- 內容須符合使用者的基督教信仰：不用星座、門神、金剛等占星或其他宗教用語。文案用繁體中文、鼓勵語氣。

修改後執行 `npm test`，檢查手機及桌面截圖，更新 docs/TEST-RESULTS.md。不要提交 node_modules 或 test-results。

## 勇氣寶庫（reward.html，2026-11-16）
- 規則只改 `reward/reward-engine.js`（純函數、回傳新 state），介面 `reward/reward-app.js`。存檔 `courage-reward-v1`；城堡抽獎券以 `seed:target` 記在 `claimed`，城堡 app.js 的 `rewardWaiting()` 用同一格式顯示 🎁 紅點，兩邊要一致。
- 寶庫只讀城堡存檔，絕不寫入 `courage-castle-save-v2`。
- 視覺參考課堂冒險局遊戲卡；插畫在 `reward/art/`（提示詞見 PROMPTS.md）。不要把 header 返回鍵命名為 `.back`（會撞卡背 `.face.back`）。
- `?test` 開放 `window.__rw`（state、setRng、reload）。軟件渲染的 WebKit 跑完整開箱動畫偶爾崩潰，iPhone 測試故此關動畫只驗版面；完整動畫在 Chromium 測試。
