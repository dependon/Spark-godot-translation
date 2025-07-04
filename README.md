# CSV翻译工具 - Godot多语言本地化助手

一个专为Godot游戏引擎设计的CSV文件翻译工具，支持一键翻译28种语言，完美适配Godot的本地化工作流程。

## ✨ 主要功能

- 🎮 **专为Godot设计**：完美支持Godot的CSV本地化文件格式
- 🌍 **28种语言支持**：覆盖全球主要语言，满足国际化需求
- 🚀 **一键批量翻译**：选择目标语言，一次性完成所有翻译
- 📊 **智能CSV处理**：自动识别源语言列，智能添加目标语言列
- 💰 **成本友好**：使用百度翻译API，每月100万字免费额度
- 🔄 **实时进度**：实时显示翻译进度和日志
- 📱 **现代化界面**：响应式设计，支持桌面和移动设备
- 🛡️ **安全可靠**：本地部署，数据安全有保障

## 🌐 支持的语言

中文(简体)、中文(繁体)、英语、日语、韩语、西班牙语、法语、德语、俄语、阿拉伯语、意大利语、葡萄牙语、荷兰语、瑞典语、丹麦语、芬兰语、挪威语、波兰语、捷克语、匈牙利语、罗马尼亚语、保加利亚语、斯洛文尼亚语、爱沙尼亚语、拉脱维亚语、立陶宛语、越南语、泰语

## 🚀 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器

### 安装部署

1. **克隆项目**
```bash
git clone https://github.com/dependon/Spark-godot-translation.git
cd Spark-godot-translation
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务**
```bash
npm start
```

4. **访问应用**
打开浏览器访问：http://localhost:3000

### 百度翻译API配置

1. **注册百度翻译API**
   - 访问 [百度翻译开放平台](https://fanyi-api.baidu.com/)
   - 注册账号并创建应用
   - 获取 APP ID 和密钥

2. **配置API信息**
   - 在应用界面的"API配置"区域
   - 输入您的百度翻译 APP ID
   - 输入您的百度翻译密钥
   - 点击"保存配置"

> 💡 **提示**：百度翻译API提供每月100万字符的免费额度，对于大多数项目来说完全够用！

## 📖 使用指南

### 1. 准备CSV文件

确保您的CSV文件格式符合Godot本地化标准：
```csv
keys,zh_CN
WELCOME,欢迎
START_GAME,开始游戏
SETTINGS,设置
EXIT,退出
```

### 2. 上传和翻译

1. **上传CSV文件**：点击上传区域选择您的CSV文件
2. **选择源语言列**：指定包含原文的列（如：zh_CN）
3. **选择目标语言**：勾选需要翻译的目标语言
4. **开始翻译**：点击"开始翻译"按钮
5. **实时监控**：查看翻译进度和实时日志
6. **下载结果**：翻译完成后下载包含所有语言的CSV文件

### 3. 在Godot中使用

1. 将翻译后的CSV文件放入Godot项目的本地化目录
2. 在项目设置中配置本地化
3. 在代码中使用 `tr()` 函数调用翻译文本

```gdscript
# 示例代码
label.text = tr("WELCOME")
button.text = tr("START_GAME")
```

## 🛠️ 开发模式

如果您需要进行开发或自定义：

```bash
# 开发模式（自动重启）
npm run dev

# 构建生产版本
npm run build
```

## 📁 项目结构

```
csv-translator/
├── public/              # 前端静态文件
│   ├── index.html      # 主页面
│   ├── script.js       # 前端逻辑
│   └── styles.css      # 样式文件
├── services/           # 后端服务
│   ├── csvService.js   # CSV处理服务
│   └── translationService.js # 翻译服务
├── outputs/            # 翻译结果输出目录
├── server.js           # 服务器主文件
└── package.json        # 项目配置
```

## 🔧 配置选项

### 环境变量

您可以通过环境变量自定义配置：

```bash
# 服务器端口（默认：3000）
PORT=3000

# 上传文件大小限制（默认：10MB）
MAX_FILE_SIZE=10485760
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [百度翻译API](https://fanyi-api.baidu.com/) - 提供翻译服务
- [Godot Engine](https://godotengine.org/) - 优秀的游戏引擎
- 所有贡献者和用户的支持

## 📞 支持

如果您在使用过程中遇到问题：

1. 查看本README的常见问题
2. 搜索已有的Issues
3. 创建新的Issue描述问题

---

**让Godot游戏的国际化变得简单高效！** 🎮✨