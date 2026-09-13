# 博客发布

游戏以独立静态页面部署到 `LuLuEric/lulu_blog`，继续在本项目维护源码。发布不需要安装依赖、后端或修改 Pages 配置。

## 目标与边界

- 游戏地址：`https://lulueric.github.io/lulu_blog/games/second-chair/`。
- 介绍页：`https://lulueric.github.io/lulu_blog/2026/09/12/second-chair/`。
- Pages 发布源：`main` 分支的根目录，HTTPS 开启；2026-09-12 通过 GitHub CLI 只读核实。
- 本地博客克隆：`.deploy/lulu_blog/`；该目录有独立 Git 历史，整个 `.deploy/` 已忽略。
- 运行文件：`index.html`、`favicon.svg`、8 个 `src/` 文件（含新手引导和效果预览）和 `assets/congress-hall.png`，共 11 个文件。
- 2026-09-13 用户确认将代码上传博客 GitHub 做版本管理：同目录同时保存 21 个项目说明、测试和开发脚本。完整清单在 `scripts/stage-blog.mjs`，仅这些文件进入游戏提交。
- 存档属于当前浏览器和网站来源，本地预览与线上网站的进度不互通。

## 准备与验证

在本项目目录运行；第一次先将博客克隆到上述指定位置：

```powershell
git clone --branch main --single-branch https://github.com/LuLuEric/lulu_blog.git .deploy/lulu_blog
node scripts/stage-blog.mjs
node --test
node scripts/preview-blog.mjs
```

`stage-blog.mjs` 同步显式清单中的 11 个运行文件与 21 个源码维护文件，并生成 `.deploy/release-manifest.json` 记录类别、字节数和 SHA-256。本地 `.deploy/` 基线、验收临时文件及任何环境配置不上传。介绍页与首页入口在博客克隆中单独维护。

预览使用 `http://127.0.0.1:4174/lulu_blog/`，完整模拟项目网站的路径前缀。检查从首页进入介绍页、点击开始游戏、出牌、12 轮终局和刷新续玩；同时复查原飞机大战入口。

## 发布与维护

1. 记录远端 `main` 基线并确认本地差异；只暂存游戏目录、介绍页和确有需要的首页入口。保持已有博客文件的 Git 换行格式，并核对暂存区运行文件的字节哈希，避免 Windows 换行转换造成整页无关差异。
2. 确保原博客文件没有意外改动，提交说明使用中文并明确发布内容。
3. 在用户授权范围内推送 `main`；如果远端有新提交，先重新审查差异，不强制覆盖。
4. 等待本次提交对应的 Pages 发布成功，核对线上资源哈希并实际打开游戏。
5. 将提交、发布记录、线上验收结果记录到 `docs/VERIFICATION.md` 与 `ROADMAP.md`。

新版还要检查：首次进入暂停电脑、跳过与重看、实际费用和选牌、受袭时的两种回应、刷新恢复待响应攻击，以及旧版中途存档升级后仍能继续。引导使用 `second-chair:guide:v1`，新版游戏使用 `second-chair:v2`；旧 `second-chair:v1` 项保留为原始副本，已有债务与部署防护继续履约。

版本号在 `package.json`、页面页脚和 `CHANGELOG.md` 对齐。博客克隆可在 `games/second-chair/` 直接执行 `node --test` 和 `node scripts/serve.mjs`。发布采用普通 Git 提交与快进推送，不改写历史，也不自动打标签或创建 GitHub Release。

当前博客仓库存放 Hexo 的静态产物。将来重新生成整站时，需要把游戏运行文件和介绍页纳入发布流程，避免覆盖此次入口。每次规则更新还需单独完成相应规则验证；页面上线不能替代玩法平衡验收。
