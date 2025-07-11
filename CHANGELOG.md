# 更新日志

本文档记录了CSV翻译工具的所有重要更改。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2024-01-XX

### 新增功能
- ✨ 支持CSV文件上传和解析
- 🌍 集成百度翻译API，支持28种语言翻译
- 🎮 专为Godot游戏引擎本地化设计
- 📊 智能识别源语言列，自动添加目标语言列
- 🚀 一键批量翻译功能
- 📱 响应式Web界面，支持桌面和移动设备
- 🔄 实时翻译进度显示
- 📝 实时翻译日志功能
- 🧹 翻译日志清空功能
- 💾 翻译结果自动下载
- ⚙️ 百度翻译API配置管理
- 🛡️ 文件上传安全验证
- 🎨 现代化UI设计

### 技术特性
- 🔌 Socket.IO实时通信
- 📦 模块化代码架构
- 🔧 Express.js后端框架
- 📄 CSV文件处理优化
- 🚦 错误处理和状态管理
- 📊 进度条和状态提示
- 🎯 RESTful API设计

### 支持的语言
- 中文(简体/繁体)
- 英语、日语、韩语
- 欧洲语言：西班牙语、法语、德语、俄语、意大利语、葡萄牙语、荷兰语
- 北欧语言：瑞典语、丹麦语、芬兰语、挪威语
- 东欧语言：波兰语、捷克语、匈牙利语、罗马尼亚语、保加利亚语
- 波罗的海语言：爱沙尼亚语、拉脱维亚语、立陶宛语、斯洛文尼亚语
- 亚洲语言：阿拉伯语、越南语、泰语

### 文档
- 📖 完整的README.md使用指南
- 📄 MIT开源许可证
- 📝 更新日志文档
- 🔧 项目配置文件
- 📋 示例CSV文件

---

## 版本说明

### 版本号格式
版本号格式：主版本号.次版本号.修订号

- **主版本号**：不兼容的API修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 更新类型
- `新增` - 新功能
- `更改` - 对现有功能的更改
- `弃用` - 即将移除的功能
- `移除` - 已移除的功能
- `修复` - 错误修复
- `安全` - 安全相关修复