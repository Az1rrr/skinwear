# Skinwear

CS2 皮肤汰换合同磨损计算器。自动从 BUFF 爬取在售饰品磨损数据，计算最优汰换配方，最大化利润。

## 功能

- **自动登录** — 通过内置浏览器（Windows 优先 Edge，macOS 用 Chrome）手动登录 BUFF，自动提取 Cookie
- **批量爬取** — 根据商品 URL 批量爬取在售饰品的磨损值
- **磨损计算** — 输入目标磨损区间，计算最优投入组合与期望利润

## 技术栈

| 层 | 技术 |
|---|------|
| GUI 框架 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 核心逻辑 | Rust (`core/`) |
| 浏览器自动化 | headless_chrome |
| 打包 | Tauri CLI |

## 项目结构

```
skinwear/
├── core/                   # Rust 核心库
│   ├── src/
│   │   ├── browser.rs      # 跨平台浏览器自动检测
│   │   ├── calc.rs         # 磨损计算引擎
│   │   ├── cookie.rs       # Cookie 提取
│   │   ├── scrape.rs       # BUFF 商品爬取
│   │   ├── types.rs        # 公共类型定义
│   │   └── lib.rs
│   └── Cargo.toml
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   │   ├── WizardPage.tsx  # 步骤导航主页
│   │   ├── CookieStep.tsx  # 登录步骤
│   │   ├── ScrapeStep.tsx  # 爬取步骤
│   │   ├── CalculateStep.tsx # 计算步骤
│   │   ├── StepIndicator.tsx
│   │   └── NavBar.tsx
│   ├── main.tsx
│   └── App.tsx
├── src-tauri/              # Tauri 桌面端
│   ├── src/lib.rs          # Rust 命令层
│   ├── tauri.conf.json     # Tauri 配置
│   └── Cargo.toml
├── Cargo.toml              # Rust workspace
├── package.json            # 前端依赖
└── vite.config.ts
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run tauri dev

# 打包生产版本
npm run tauri build
```

## CI / CD

每次 push 到 `main` 分支自动构建 macOS (`aarch64`) 和 Windows (`x64`) 安装包，产物可在 GitHub Actions 的 Artifacts 中下载。
