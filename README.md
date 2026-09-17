# 开店吧！超市 🏪

2D 里画蓝图，3D 里看它活起来 —— 超市布局模拟经营小游戏。纯前端静态站点，可直接托管在 GitHub Pages。

## 玩法

1. **规划**（2D 俯视图）：从左侧设备栏放置货架/冷柜/收银台，选中货架上架品类。拖动移动、`R` 旋转、`Del` 删除（全额退款）。
2. **营业**（3D 视角）：点击「开门营业」，顾客从入口涌入，按购物清单寻路找货、路过堆头触发冲动消费、排队结账。
3. **日结**：看报表复盘 —— 排队太长加收银台、品类缺货补货架、动线绕远改布局。
4. **目标**：总资产达到 **¥20,000** 通关，之后可无尽经营。

零售小知识即策略：零食挨着饮料销量 +15%；饮料放冷柜价格 ×1.6；端头架/堆头放必经之路触发冲动消费；收银太少顾客会失去耐心弃购。

## 本地开发

```powershell
pnpm install
pnpm dev        # http://localhost:5173/sm-github/
pnpm test       # 单元测试（寻路 / 模拟 / 目录）
pnpm lint
pnpm typecheck
pnpm build      # 产出 dist/
```

要求 Node.js 22+、pnpm 9+。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（默认 `vite.config.ts` 的 `base` 按仓库名 `sm-github` 配置；**仓库名不同请同步修改 `base`**）。
2. 推送 `main` 分支，`.github/workflows/deploy.yml` 会自动构建并发布。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。

游戏数据保存在浏览器 localStorage，无任何后端。

## 素材致谢

- 货架、冷柜、展台、收银台模型来自 [Kenney Mini Market](https://www.kenney.nl/assets/mini-market)（[CC0 1.0](public/models/LICENSE-KENNEY-MINI-MARKET.txt)）。

## 设计文档

见 [GAME_DESIGN.md](GAME_DESIGN.md)。
