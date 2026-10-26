# 主题样式

- `dark.css`：原有深色主题的配色、组件背景、阴影和代码高亮。
- `light.css`：独立的浅色主题配色，使用同一组语义变量。
- 上层 `tokens.css`：公共字体、圆角等与主题无关的设计变量。
- 组件的 CSS Modules：布局、尺寸、交互，颜色通过 `var(--…)` 引用。

根元素使用 `data-theme="dark"` 或 `data-theme="light"`；默认保留深色。公开站右上角、登录页和后台顶栏提供切换按钮，偏好保存在 localStorage 的 `halley.theme` 中并同步其他标签页。

`public/theme-init.js` 在页面入口模块之前恢复偏好，避免刷新时先显示错误主题。新增主题颜色时应同时更新两套 CSS，避免在组件中增加 `data-theme` 特例或写死背景色。封面装饰渐变及终端的红黄绿状态点保持原有颜色。
