# dsh-function-plot

DeepSeek Harness 插件：在对话里画 2D 函数图（激活函数、分布、课堂曲线）。

图保存在工作区 `.dsh-plots/*.svg`。对话里只返回公式和关键点。默认不画导数，除非你明确要求。

需要已安装的 [`dsh`](https://github.com/deepseek-ai/deepseek-harness)。装进 **web** profile，用 `dsh web` 启动。不要用 `--patch`。

## 用 npm 安装（推荐）

```sh
dsh plugin --profile web add dsh-function-plot
dsh --profile web --dump-config
dsh web
```

`dump-config` 里应出现 `# == dsh-function-plot`。锁版本：

```sh
dsh plugin --profile web add dsh-function-plot@0.1.4
```

## 从源码安装

git 拉下来的是源码，没有现成的 `lib/`。要先检出版本、本地构建，再交给 `dsh plugin`。

```sh
git clone https://github.com/kirineko/dsh-function-plot.git
cd dsh-function-plot
git checkout v0.1.4
pnpm install
pnpm build
dsh plugin --profile web add "$(pwd)"
```

若 `add` 因 `prepare` 被拒绝而失败（pnpm ≥10），把下面写进 **`~/.dsh/profiles/web/pnpm-workspace.yaml`**：

```yaml
allowBuilds:
  dsh-function-plot: true
```

保存后再执行一次：

```sh
dsh plugin --profile web add "$(pwd)"
```

`allowBuilds` 表示允许该包在安装时于本机执行构建脚本，且不在 agent 沙箱内。只对你刚 clone 的这份源码授权。

确认层已叠上并启动：

```sh
dsh --profile web --dump-config
dsh web
```

## 使用

打开 `http://127.0.0.1:3080`，直接说要画什么。图会出现在 `plot_function` 卡片里：可切换远景 / 近景 / 对照，查看完整函数信息，或下载 SVG。不必再让模型调用 `read_image`。例如：

- 对比 ReLU 和 GELU
- 画标准正态密度
- 画线性需求和供给
- 画 sigmoid 的导数
- 画 y = x^2 / 2，x 从 -3 到 3

画完后打开工作区里的 `.dsh-plots/*.svg`。不要让模型对 SVG 调用 `read_image`（只接受 PNG/JPEG/WebP/GIF，且 DeepSeek 官方模型不接收图像）。

同图画需求和供给时会标均衡点。改主题或采样数，编辑 `~/.dsh/profiles/web/cordis.patch.yml`，按 `id` 整行覆盖：

```yaml
- id: function-plot
  name: dsh-function-plot
  config:
    outputDir: .dsh-plots
    samples: 400
    width: 960
    height: 540
    theme: light
```

## 卸载

```sh
dsh plugin --profile web remove dsh-function-plot
```
