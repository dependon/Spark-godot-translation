# CSV翻译工具

一个基于腾讯翻译API的CSV文件翻译工具，支持15种语言的智能翻译。

## 功能特性

- 🌐 支持15种语言互译
- 📁 支持CSV文件上传和下载
- 🎯 可选择任意列作为源语言
- 🔄 自动补充缺失的语言列
- 💻 现代化的Web界面
- 🚀 基于Node.js和Express

## 支持的语言

| 语言代码 | 语言名称 |
|---------|----------|
| zh | 简体中文 |
| zh-TW | 繁体中文 |
| en | 英语 |
| ar | 阿拉伯语 |
| de | 德语 |
| es | 西班牙语 |
| fr | 法语 |
| it | 意大利语 |
| ja | 日语 |
| pt | 葡萄牙语 |
| ru | 俄语 |
| ko | 韩语 |
| tr | 土耳其语 |
| vi | 越南语 |
| th | 泰语 |

## 安装和配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置腾讯翻译API

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入您的腾讯云API密钥：
```env
TENCENT_SECRET_ID=your_secret_id_here
TENCENT_SECRET_KEY=your_secret_key_here
TENCENT_REGION=ap-beijing
PORT=3000
```

### 3. 获取腾讯云API密钥

1. 访问 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 注册/登录账户
3. 进入 "访问管理" > "API密钥管理"
4. 创建新的API密钥
5. 开通 "机器翻译" 服务

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动。

## 使用方法

### CSV文件格式要求

您的CSV文件应该遵循以下格式：

```csv
keys,es,en,zh
I'm test string,Soy un texto de prueba,I'm test string,我是测试字符串
Hello World,Hola Mundo,Hello World,你好世界
```

- 第一列必须是 `keys` 或任意标识符列
- 其他列为各种语言的翻译
- 第一行为标题行

### 翻译流程

1. **上传CSV文件**
   - 点击上传区域选择文件
   - 或直接拖拽文件到上传区域
   - 系统会自动分析文件结构

2. **选择翻译选项**
   - 选择源语言列（可以是任意现有列）
   - 选择要翻译的目标语言
   - 系统会自动选中CSV中缺失的语言

3. **执行翻译**
   - 点击"开始翻译"按钮
   - 等待翻译完成（显示进度条）

4. **下载结果**
   - 翻译完成后点击下载按钮
   - 获取包含所有翻译的新CSV文件

## API接口

### 获取支持的语言
```http
GET /api/languages
```

### 上传CSV文件
```http
POST /api/upload
Content-Type: multipart/form-data

参数:
- csvFile: CSV文件
```

### 执行翻译
```http
POST /api/translate
Content-Type: application/json

{
  "fileName": "上传的文件名",
  "sourceLanguage": "源语言列名",
  "targetLanguages": ["目标语言数组"]
}
```

### 下载翻译文件
```http
GET /api/download/:fileName
```

## 项目结构

```
csv-translator/
├── server.js              # 后端服务器
├── package.json           # 项目配置
├── .env.example          # 环境变量模板
├── README.md             # 说明文档
├── public/               # 前端文件
│   ├── index.html        # 主页面
│   └── script.js         # 前端逻辑
├── uploads/              # 上传文件目录
└── downloads/            # 下载文件目录
```

## 注意事项

1. **API限制**：腾讯翻译API有调用频率限制，大文件翻译可能需要较长时间
2. **费用**：翻译服务按字符数收费，请注意控制成本
3. **文件大小**：建议单个CSV文件不超过1000行，以确保翻译效率
4. **编码格式**：请确保CSV文件使用UTF-8编码

## 故障排除

### 常见问题

1. **翻译失败**
   - 检查API密钥是否正确
   - 确认腾讯云账户余额充足
   - 检查网络连接

2. **文件上传失败**
   - 确认文件格式为CSV
   - 检查文件大小是否合理
   - 确认文件编码为UTF-8

3. **页面无法访问**
   - 检查端口是否被占用
   - 确认防火墙设置
   - 查看控制台错误信息

## 开发

### 开发环境

```bash
# 安装开发依赖
npm install

# 启动开发服务器（自动重启）
npm run dev
```

### 技术栈

- **后端**：Node.js, Express, Multer
- **前端**：原生HTML/CSS/JavaScript
- **翻译API**：腾讯云机器翻译
- **文件处理**：csv-parser, csv-writer

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！