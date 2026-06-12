# 图标文件

## 使用方法

请将您的应用图标放置在此目录下，命名为 `icon.ico`。

### 图标要求

- 格式：`.ico`（Windows 图标格式）
- 尺寸：至少包含 256x256、128x128、64x64、48x48、32x32、16x16
- 背景：建议使用透明背景

### 制作图标

您可以使用以下工具生成 `.ico` 文件：

1. **在线工具**：
   - https://www.icoconverter.com/
   - https://redketchup.io/icon-converter

2. **本地工具**：
   - GIMP（免费）
   - Photoshop + ICO 插件
   - Visual Studio 自带的图标编辑器

### 临时方案

如果您暂时没有图标，可以：
1. 从 `%SystemRoot%\System32\mstsc.exe` 提取图标作为临时使用
2. 或注释掉 `package.json` 中 `build.win.icon` 配置项后再打包