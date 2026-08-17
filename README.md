# dsh-function-plot

DeepSeek Harness 的 **2D 函数图**组合包。对话里让模型画激活函数、分布、课堂曲线；图写成 workspace 里的 SVG，工具结果用文字回报公式和关键点。

主攻深度学习（ReLU、GELU、sigmoid…），兼顾统计、初等数学和经济教学。**默认不画导数**，只有你明确要斜率 / 边际 / 梯度时才叠加。

官方 DeepSeek 适配器是纯文本：这个工具**不会**把图片塞进模型上下文，否则下一轮会失败。人看 `.dsh-plots/*.svg`，模型看文字。

---

## 用户怎么装

先装好 [`dsh` CLI](https://github.com/deepseek-ai/deepseek-harness)。下面三条里选一条，装进 **web** profile。装好后用 `dsh web` 启动，**不要**再加 `--patch`。

### 方式一：本地目录或 tarball（推荐）

不需要 `allowBuilds`，装的是已经编好的 `lib/`。

在插件目录里打包：

```sh
pnpm install
pnpm pack
```

得到 `dsh-function-plot-0.1.0.tgz`，发给用户后：

```sh
dsh plugin --profile web add ./dsh-function-plot-0.1.0.tgz
dsh --profile web --dump-config    # 应出现 "# == dsh-function-plot"
dsh web
```

开发者若就在本仓库旁，也可以直接链本地 checkout（同样无需授权）：

```sh
dsh plugin --profile web add /绝对路径/dsh-function-plot
dsh web
```

若你是在 **deepseek-harness 源码树**里开发，把上面的 `dsh` 换成 `pnpm dsh`，并先完成该仓库的从源码运行准备。

### 方式二：从 GitHub 装源码

```sh
dsh plugin --profile web add github:kirineko/dsh-function-plot#<commit-sha>
```

git 安装拉的是源码。第一次会失败：pnpm ≥10 默认拒绝跑依赖的 `prepare`。把报错里的包键写进 **该 profile** 的 `pnpm-workspace.yaml`（一般是 `~/.dsh/profiles/web/pnpm-workspace.yaml`）：

```yaml
allowBuilds:
  dsh-function-plot: true
```

再执行一次同样的 `add`。这表示允许该包在安装时于你的机器上执行构建脚本，且不在 agent 沙箱内。只对可信源码授权，并钉死 commit SHA。

### 方式三：npm（发布到注册表之后）

```sh
dsh plugin --profile web add dsh-function-plot
dsh web
```

装的是预构建包，不需要 `allowBuilds`。

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
pnpm pack           # 预构建 tarball，给方式一用
```

在 deepseek-harness 源码树旁做热加载（不是发布路径）：

```sh
pnpm dsh web --patch ./function-plot/cordis.yml
```

这条 overlay 用绝对路径加载 TypeScript 源文件，只适合作者本机。发给用户请用上面的 `dsh plugin add`。
