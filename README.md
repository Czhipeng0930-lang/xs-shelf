# 像素货架 🏪

> 润达货架 · RUNDA SHELF 出品

在一间像素小店里，把货架摆到满、摆到分最高。一款 Islanders 式的超市货架放置计分小游戏：抽货架卡、放进网格、靠相邻关系与通道布局得分，分够了解锁更多货架与促销卡，摆满即开业结算。

纯前端静态站点，Canvas 2D 渲染、无 WebGL 依赖，直接托管在 GitHub Pages。

## 玩法

1. **抽卡**：手牌 3 张货架卡（双面 / 单面 / 端架 / 堆头 …，随分数解锁冷柜、仓储架、木架、卧式冰柜）。
2. **放置**：点卡片选牌，鼠标移到店面预览（绿可放 / 红不可放），点击落地；`R` 或右键旋转；手机上点一次预览、再点一次确认。
3. **得分**：每个**取货面前面必须留通道**才得分；端架贴双面货架端头 ×2；同类连排 +10%/件；冷柜贴 ⚡ 电源墙且连排成冷链区 +50%；木架靠门人气 +50%~100%；堆头靠主动线 ×3；被围死的空地和死面都扣分。
4. **解锁**：400 / 1000 / 1800 分解锁新货架，并三选一促销卡（本局规则修正）。
5. **开业**：收银台放在门口 3 格内后可开业；像素小人涌入逛店、拿货、结账，随后弹出计分板。
6. **分享**：结果是一串 emoji 网格 + 链接，链接打开可复现整家店。

模式：**每日挑战**（日期做种子，全球同店面同牌序）、**无尽模式**（牌抽干或无处可放就扩店）。

手机：竖屏 / 横屏均有专门布局；触屏点一下预览、再点 ✓ 放置；剪贴板不可用时可长按复制分享文本。

## 本地开发

```powershell
pnpm install
pnpm dev        # http://localhost:5173/xs-shelf/
pnpm test       # 单元测试（规则 / 引擎 / 分享编码）
pnpm lint
pnpm typecheck
pnpm build      # 产出 dist/
```

要求 Node.js 22+、pnpm 9+。开发模式下控制台可用 `__store` / `__engine` / `__grid` / `__share` 调试。

## 部署到 GitHub Pages

1. `vite.config.ts` 的 `base` 必须等于仓库名，例如仓库叫 `xs-shelf` 则 `base: '/xs-shelf/'`。
2. 推送 `main` 分支，`.github/workflows/deploy.yml` 会自动构建并发布。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. 改名后新地址是 `https://<用户名>.github.io/<新仓库名>/`。

进度、最高分保存在浏览器 localStorage，无任何后端。

## 目录

```
src/
├─ game/      规则引擎（纯数据）：catalog / grid / flow / scoring / engine / share / store
├─ render/    Canvas 2D：程序化像素 sprite / 场景绘制 / 棋盘输入 / 开业小人
└─ ui/        React HUD：菜单 / 顶栏 / 手牌栏 / 促销三选一 / 计分板 / 帮助
```

## 设计文档

见 [GAME_DESIGN.md](GAME_DESIGN.md)。
