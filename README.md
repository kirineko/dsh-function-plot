# dsh-function-plot

DeepSeek Harness 的 **2D 函数图**组合包。对话里让模型画激活函数、分布、课堂曲线；图写成 workspace 里的 SVG，工具结果用文字回报公式和关键点。

主攻深度学习（ReLU、GELU、sigmoid…），兼顾统计、初等数学和经济教学。**默认不画导数**，只有你明确要斜率 / 边际 / 梯度时才叠加。

官方 DeepSeek 适配器是纯文本：这个工具**不会**把图片塞进模型上下文，否则下一轮会失败。人看 `.dsh-plots/*.svg`，模型看文字。

---

## 用户怎么装

先装好 [`dsh` CLI](https://github.com/deepseek-ai/deepseek-harness)。装进 **web** profile 后用 `dsh web` 启动，**不要**再加 `--patch`。

### 方式一：npm（推荐）

包名：[`dsh-function-plot`](https://www.npmjs.com/package/dsh-function-plot)。装的是预构建 `lib/`，不需要 `allowBuilds`。

```sh
dsh plugin --profile web add dsh-function-plot
dsh --profile web --dump-config    # 应出现 "# == dsh-function-plot"
dsh web
```

锁版本（建议）：

```sh
dsh plugin --profile web add dsh-function-plot@0.1.0
```

### 方式二：本地目录或 tarball

作者在插件目录里：

```sh
pnpm install
pnpm pack
```

用户：

```sh
dsh plugin --profile web add ./dsh-function-plot-0.1.0.tgz
dsh web
```

或直接链 checkout：`dsh plugin --profile web add /绝对路径/dsh-function-plot`。  
在 **deepseek-harness 源码树**里开发时，把 `dsh` 换成 `pnpm dsh`。

### 方式三：从 GitHub 装源码

源码仓库：<https://github.com/kirineko/dsh-function-plot>

git 安装拉的是源码，不是 npm 上的构建产物。第一次会失败：pnpm ≥10 默认拒绝跑 `prepare`。把包键写进 `~/.dsh/profiles/web/pnpm-workspace.yaml` 后再 `add` 一次：

```yaml
allowBuilds:
  dsh-function-plot: true
```

```sh
dsh plugin --profile web add github:kirineko/dsh-function-plot#d877d8759103a60e5283c5b910334d3d682026f8
```

只对可信源码授权，并钉死 commit SHA。日常使用请走方式一。

### 卸掉

```sh
dsh plugin --profile web remove dsh-function-plot
```

---

## 启动后怎么用

打开 `http://127.0.0.1:3080`，直接用自然语言提画图要求即可。模型会调用 `plot_function`。

可以这样说：

- `对比 ReLU 和 GELU`
- `画标准正态密度，标出均值和 ±σ`
- `画线性需求和供给，标出均衡点`
- `把 sigmoid 画出来`（不要提导数，就不会画导数）
- `再画一下 sigmoid 的导数`（只有这时才叠加虚线）
- `画 y = x^2 / 2，x 从 -3 到 3`

画完后：

1. 工作区出现 `.dsh-plots/<标题>.svg`，用浏览器或编辑器打开。
2. 对话里的工具结果是文字：公式、坐标窗口、截距 / 极值 / 渐近线。
3. 指定 `path` 可改保存位置。

不要让模型 `read_image` 这张 SVG：附件通道只收 PNG/JPEG/WebP/GIF，而且当前 DeepSeek 路由不接受图像输入。

---

## 工具参数

工具名：`plot_function`。每条曲线 **`fn` 和 `expr` 恰好填一个**。

| 参数 | 必填 | 说明 |
|------|------|------|
| `series` | 是 | 1–6 条曲线 |
| `series[].fn` | 与 expr 二选一 | 目录名，见下表 |
| `series[].expr` | 与 fn 二选一 | 受限表达式，如 `1/(1+exp(-x))` |
| `series[].params` | 否 | 目录函数的数值参数（`mu`、`sigma`、`alpha`…） |
| `series[].derivative` | 否 | 默认 `false`。`true` 才叠加该曲线的导数 |
| `series[].label` | 否 | 图例 |
| `xMin` / `xMax` | 否 | 不填则用目录推荐窗口；纯表达式默认 `[-5, 5]` |
| `samples` | 否 | 50–2000，默认 400 |
| `title` | 否 | 图标题 |
| `xLabel` / `yLabel` | 否 | 轴名，经济图可用 Quantity / Price |
| `path` | 否 | workspace 相对路径，默认 `.dsh-plots/<标题>.svg` |

`expr` 只允许数字、`x`、`e`、`pi`、四则运算、`^`、括号，以及 `sin cos tan exp log ln abs sqrt min max tanh sigmoid relu`。不能写任意 JavaScript。

---

## 函数目录

模型应优先用 `fn`（标注完整）。目录里没有的式子再用 `expr`。

**深度学习**

| `fn` | 含义 | 常用 `params` |
|------|------|----------------|
| `sigmoid` / `tanh` | 激活 | — |
| `relu` / `leaky_relu` / `elu` | 激活 | `alpha` |
| `softplus` / `gelu` / `silu` / `mish` | 光滑激活 | — |
| `softmax_pair` | 二维 softmax 的一支 | `c` |
| `mse` / `mae` / `huber` / `bce` | 标量损失切片 | Huber 用 `delta` |

**统计**

| `fn` | 常用 `params` |
|------|----------------|
| `normal_pdf` / `normal_cdf` | `mu`（默认 0）、`sigma`（默认 1） |
| `uniform_pdf` / `uniform_cdf` | `a`、`b` |
| `exponential_pdf` / `exponential_cdf` | `lambda` |
| `lognormal_pdf` | `mu`、`sigma` |
| `beta_pdf` | `alpha`、`beta` |

**数学**

| `fn` | 常用 `params` |
|------|----------------|
| `exp` / `log` | `base`（默认 e） |
| `pow` | `n`（默认 2） |
| `sqrt` / `abs` / `step` / `sin` / `cos` / `tan` | — |
| `quadratic` | `a` `b` `c` |
| `logistic` | `L` `k` `x0` |

**经济教学**

| `fn` | 含义 | 常用 `params` |
|------|------|----------------|
| `linear_demand` / `linear_supply` | 同图画时会标均衡点 | `intercept`、`slope` |
| `isoelastic` | \(A x^{\varepsilon}\) | `A`、`epsilon` |
| `cobb_douglas_slice` | 要素切片 | `a` |
| `crra_utility` | CRRA 效用 | `eta` |
| `quadratic_cost` | 总成本 | `a` `b` `c` |
| `exponential_discount` | \(e^{-rt}\) | `r` |

---

## 配置

组合包自带默认配置。用户要改主题或采样数，写在 **profile** 的 `~/.dsh/profiles/web/cordis.patch.yml`，按 `id` 整行覆盖（不会和包内默认深合并）：

```yaml
- id: function-plot
  name: dsh-function-plot
  config:
    outputDir: .dsh-plots
    samples: 400
    width: 960
    height: 540
    theme: light   # 或 dark
```

| 字段 | 默认 | 说明 |
|------|------|------|
| `width` / `height` | 960 / 540 | 画布像素 |
| `samples` | 400 | 默认采样点 |
| `outputDir` | `.dsh-plots` | 未指定 `path` 时的目录 |
| `theme` | `light` | `light` 或 `dark` |

---

## 限制

- 只画 2D 显函数。没有 3D、隐函数、极坐标。
- 不把图作为模型可见图像。
- Web 对话里的工具卡目前是通用卡片；图在写出的 SVG 文件里。
- 覆盖已有 SVG 时，若 filesystem 观察策略要求先读再写，换一个 `path` 或先读该文件。

---

## 开发者

```sh
pnpm install
pnpm test
pnpm build          # 写出 lib/index.js
pnpm pack           # 预构建 tarball
```

在 deepseek-harness 源码树旁做热加载（不是发布路径）：

```sh
pnpm dsh web --patch ./function-plot/cordis.yml
```

这条 overlay 用绝对路径加载 TypeScript 源文件，只适合作者本机。发给用户请用上面的 `dsh plugin add`。

### 用 GitHub Actions 发布到 npm

日常发版走 CI，**不要**把 npm token 写进 GitHub Secrets。2026 年官方做法是 [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)（OIDC）：npm 只信任本仓库里名为 `publish.yml` 的工作流。

首次发布有先有后：npm 必须先有这个包，才能在网页上绑定 Trusted Publisher。所以 **0.1.0 在本机发一次**，之后的版本全部打 tag 交给 Actions。

#### 一次性：本机发出 0.1.0，并绑上 GitHub

1. 登录官方源（本机默认若是 npmmirror，必须带 `--registry`）：

```sh
npm login --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/
```

2. 在插件目录发第一个版本：

```sh
pnpm test
pnpm publish --access public
```

开了 2FA 就加 `--otp`。核对：

```sh
npm view dsh-function-plot version --registry https://registry.npmjs.org/
```

3. 打开包设置：<https://www.npmjs.com/package/dsh-function-plot/access>  
   找到 **Trusted Publisher**，选 **GitHub Actions**，填：

   | 字段 | 值 |
   |------|-----|
   | Organization or user | `kirineko` |
   | Repository | `dsh-function-plot` |
   | Workflow filename | `publish.yml` |
   | Environment name | **留空** |

   只填文件名，不要写成 `.github/workflows/publish.yml`。

4. （建议）同一页把发布策略改成要求 2FA，并在熟悉流程后考虑禁止 token，只允许 Trusted Publisher。

#### 以后每个版本

1. 改 `package.json` 的 `version`（例如 `0.1.1`），提交到 `main`。
2. 打**和 version 完全一致**的 tag 并推送：

```sh
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

3. GitHub → Actions 里看 **Publish** 是否变绿。用户即可：

```sh
dsh plugin --profile web add dsh-function-plot
```

`publish.yml` 会跑测试、构建，并检查 tag `vX.Y.Z` 与 `package.json` 的 `version` 一致，不一致会拒绝发布。同一版本号不能发第二次。

不要给这个仓库加 `NPM_TOKEN`。工作流用 `id-token: write` 向 npm 换短期凭证。
