const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const BaiduTranslationService = require('./services/translationService');
const CSVService = require('./services/csvService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3123;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('只支持CSV文件格式'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

// 初始化服务
const csvService = new CSVService();
// 存储每个会话的翻译服务实例
const sessionTranslationServices = new Map();
// 存储会话信息
const sessionInfo = new Map();
const activeTranslations = new Map(); // 存储正在进行的翻译任务

// API路由

// 获取支持的语言列表
app.get('/api/languages', (req, res) => {
    const tempService = new BaiduTranslationService('', '');
    res.json({
        success: true,
        languages: tempService.getSupportedLanguages()
    });
});

// 配置百度翻译API
app.post('/api/config', (req, res) => {
    const { appId, secretKey, sessionId } = req.body;
    
    if (!appId || !secretKey) {
        return res.status(400).json({
            success: false,
            message: '请提供百度翻译API的AppID和SecretKey'
        });
    }
    
    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: '缺少会话ID'
        });
    }
    
    // 为特定会话创建翻译服务实例
    const translationService = new BaiduTranslationService(appId, secretKey);
    sessionTranslationServices.set(sessionId, translationService);
    
    res.json({
        success: true,
        message: '百度翻译API配置成功',
        sessionId: sessionId
    });
});

// 上传CSV文件
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: '请选择CSV文件'
        });
    }

    const filePath = req.file.path;
    const { headers, data } = await csvService.parseCSV(filePath);
    
    // 清理上传的临时文件
    csvService.cleanupFile(filePath);
    
    res.json({
        success: true,
        message: '文件上传成功',
        data: {
            headers,
            rowCount: data.length,
            preview: data.slice(0, 5), // 返回前5行预览
            fileName: req.file.originalname
        }
    });
});

// 翻译CSV文件
app.post('/api/translate', upload.single('csvFile'), async (req, res) => {
    const {
        sourceColumn,
        targetLanguages,
        forceRetranslate = false,
        sessionId
    } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: '缺少会话ID'
        });
    }
    
    const translationService = sessionTranslationServices.get(sessionId);
    if (!translationService) {
        return res.status(400).json({
            success: false,
            message: '请先配置百度翻译API'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: '请选择CSV文件'
        });
    }

    if (!sourceColumn) {
        return res.status(400).json({
            success: false,
            message: '请指定源语言列'
        });
    }

    const targetLangs = JSON.parse(targetLanguages || '[]');
    if (targetLangs.length === 0) {
        return res.status(400).json({
            success: false,
            message: '请选择目标翻译语言'
        });
    }

    const filePath = req.file.path;
    let { headers, data } = await csvService.parseCSV(filePath);
    
    // 添加缺失的语言列
    const result = csvService.addMissingLanguageColumns(data, headers, targetLangs);
    data = result.data;
    headers = result.headers;

    // 获取源文本
    const sourceTexts = csvService.getSourceTexts(data, sourceColumn);
    
    // 创建翻译任务控制器
    const translationController = {
        shouldStop: false,
        stop: () => {
            translationController.shouldStop = true;
        }
    };
    
    // 将翻译任务添加到活动任务列表
    activeTranslations.set(sessionId, translationController);
    
    // 翻译进度跟踪
    let completedTranslations = 0;
    const totalTranslations = targetLangs.length * sourceTexts.length;
    const sessionSocket = sessionInfo.get(sessionId);
        
        // 为每种目标语言进行翻译
        for (const targetLang of targetLangs) {
            // 检查是否需要停止翻译
            if (translationController.shouldStop) {
                console.log(`翻译已被停止 - 会话: ${sessionId}`);
                break;
            }
            
            if (targetLang === sourceColumn) {
                continue; // 跳过源语言列
            }

            console.log(`开始翻译到 ${targetLang}...`);
             
             // 筛选需要翻译的文本
             const textsToTranslate = [];
             const indices = [];
             
             sourceTexts.forEach((text, index) => {
                 const existingTranslation = data[index][targetLang];
                 if (csvService.needsTranslation(existingTranslation, forceRetranslate === 'true')) {
                     textsToTranslate.push(text);
                     indices.push(index);
                 }
             });

             if (textsToTranslate.length > 0) {
                 // 使用直接翻译，每翻译一个文本立即反馈
                 const sessionSocket = sessionInfo.get(sessionId);
                 
                 const translations = await translationService.translateDirect(
                     textsToTranslate,
                     'auto',
                     targetLang,
                     (feedback) => {
                         // 检查是否需要停止翻译
                         if (translationController.shouldStop) {
                             return false; // 返回false表示停止翻译
                         }
                         
                         // 实时反馈回调函数
                         const dataIndex = indices[feedback.index];
                         data[dataIndex][targetLang] = feedback.translatedText;
                         completedTranslations++;
                         
                         // 立即发送翻译日志到客户端
                         if (sessionSocket) {
                             // 数据验证和清理，防止JSON序列化错误
                             const logData = {
                                 originalText: String(feedback.originalText || '').replace(/[\x00-\x1F\x7F-\x9F]/g, ''),
                                 translatedText: String(feedback.translatedText || '').replace(/[\x00-\x1F\x7F-\x9F]/g, ''),
                                 targetLanguage: targetLang,
                                 status: feedback.error ? 'error' : 'success',
                                 progress: Math.round((completedTranslations / totalTranslations) * 100),
                                 sessionId: sessionId,
                                 error: feedback.error ? String(feedback.error).replace(/[\x00-\x1F\x7F-\x9F]/g, '') : null
                             };
                             
                             // 安全发送数据，捕获可能的序列化错误
                             try {
                                 sessionSocket.emit('translationLog', logData);
                             } catch (emitError) {
                                 console.error('发送翻译日志失败:', emitError);
                                 // 发送简化版本的日志
                                 try {
                                     sessionSocket.emit('translationLog', {
                                         originalText: '数据包含特殊字符',
                                         translatedText: '翻译完成',
                                         targetLanguage: targetLang,
                                         status: 'success',
                                         progress: Math.round((completedTranslations / totalTranslations) * 100),
                                         sessionId: sessionId,
                                         error: null
                                     });
                                 } catch (fallbackError) {
                                     console.error('发送简化翻译日志也失败:', fallbackError);
                                 }
                             }
                         }
                         
                         return true; // 返回true表示继续翻译
                     },
                     translationController // 传递控制器以便在翻译服务中检查停止状态
                 );
             }
             
             console.log(`${targetLang} 翻译完成`);
        }
        
        // 移除活动翻译任务
        activeTranslations.delete(sessionId);

        // 生成输出文件
        const outputFileName = `translated_${Date.now()}.csv`;
        let outputPath;
        
        outputPath = await csvService.generateCSV(data, headers, outputFileName);
        console.log(`CSV文件生成成功: ${outputFileName}`);
        
        // 清理上传的临时文件
        csvService.cleanupFile(filePath);
        
        // 获取缓存统计信息
        const cacheStats = translationService.getCacheStats();
        
        // 检查翻译是否被停止
        if (translationController.shouldStop) {
            console.log('翻译被停止，生成部分翻译结果');
            
            // 生成部分翻译结果的CSV文件
            const partialOutputFileName = `partial_translated_${Date.now()}.csv`;
            let partialOutputPath;
            
            try {
                partialOutputPath = await csvService.generateCSV(data, headers, partialOutputFileName);
                console.log(`部分翻译CSV文件生成成功: ${partialOutputFileName}`);
            } catch (error) {
                console.error('生成部分翻译文件失败:', error);
            }
            
            // 清理上传的临时文件
            csvService.cleanupFile(filePath);
            
            // 发送翻译停止状态到客户端
            if (sessionSocket) {
                sessionSocket.emit('translationStopped', {
                    sessionId: sessionId,
                    message: '翻译已停止，已生成部分翻译结果',
                    fileName: partialOutputPath ? partialOutputFileName : null,
                    downloadUrl: partialOutputPath ? `/api/download/${partialOutputFileName}` : null,
                    completedTranslations: completedTranslations
                });
            }
            
            return res.json({
                success: false,
                message: '翻译已停止',
                data: {
                    fileName: partialOutputPath ? partialOutputFileName : null,
                    downloadUrl: partialOutputPath ? `/api/download/${partialOutputFileName}` : null,
                    completedTranslations: completedTranslations
                }
            });
        }
        
        // 发送最终完成状态到客户端
        if (sessionSocket) {
            sessionSocket.emit('translationComplete', {
                sessionId: sessionId,
                fileName: outputFileName,
                totalTranslations: completedTranslations,
                message: '翻译任务完成，CSV文件已生成'
            });
        }
        
        res.json({
            success: true,
            message: '翻译完成',
            data: {
                fileName: outputFileName,
                downloadUrl: `/api/download/${outputFileName}`,
                translatedRows: data.length,
                translatedLanguages: targetLangs.length,
                totalTranslations: completedTranslations,
                cacheStats: cacheStats
            }
        });
        
});

// 下载翻译后的文件
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'outputs', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: '文件不存在'
        });
    }
    
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('下载错误:', err);
            res.status(500).json({
                success: false,
                message: '下载失败'
            });
        }
    });
});

// 获取缓存统计信息
app.get('/api/cache/stats/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const translationService = sessionTranslationServices.get(sessionId);
    if (!translationService) {
        return res.status(400).json({
            success: false,
            message: '会话不存在或未配置翻译服务'
        });
    }
    
    const stats = translationService.getCacheStats();
    res.json({
        success: true,
        data: stats
    });
});

// 清理缓存
app.post('/api/cache/clear/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const translationService = sessionTranslationServices.get(sessionId);
    if (!translationService) {
        return res.status(400).json({
            success: false,
            message: '会话不存在或未配置翻译服务'
        });
    }
    
    translationService.clearCache();
    res.json({
        success: true,
        message: '缓存已清理'
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CSV翻译服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        message: '服务器内部错误'
    });
});

// Socket.IO连接处理
io.on('connection', (socket) => {
    console.log('客户端已连接:', socket.id);
    
    // 生成唯一的会话ID
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 建立会话映射
    sessionInfo.set(sessionId, socket);
    
    // 向客户端发送会话ID
    socket.emit('sessionAssigned', { sessionId });
    
    // 监听客户端注册会话ID事件
    socket.on('registerSession', (data) => {
        if (data.sessionId) {
            sessionInfo.set(data.sessionId, socket);
            console.log('会话已注册:', data.sessionId, 'Socket ID:', socket.id);
        }
    });
    
    // 心跳处理
    socket.on('heartbeat', (data) => {
        // 响应心跳
        socket.emit('heartbeat_response', { timestamp: Date.now() });
    });
    
    // 停止翻译处理
    socket.on('stopTranslation', (data) => {
        const { sessionId } = data;
        console.log('收到停止翻译请求:', sessionId);
        
        if (sessionId) {
            const translationController = activeTranslations.get(sessionId);
            if (translationController) {
                translationController.stop();
                console.log('翻译任务已标记为停止:', sessionId);
                
                // 向客户端确认停止请求已收到
                socket.emit('translationStopped', {
                    sessionId: sessionId,
                    message: '翻译停止请求已处理',
                    fileName: null // 如果有部分结果文件，可以在这里设置
                });
            } else {
                console.log('没有找到活动的翻译任务:', sessionId);
                socket.emit('translationStopped', {
                    sessionId: sessionId,
                    message: '没有正在进行的翻译任务',
                    fileName: null
                });
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('客户端已断开连接:', socket.id);
        
        // 清理会话信息并停止翻译
        for (const [sessionId, sessionSocket] of sessionInfo.entries()) {
            if (sessionSocket === socket) {
                // 停止正在进行的翻译任务
                const translationController = activeTranslations.get(sessionId);
                if (translationController) {
                    translationController.stop();
                    activeTranslations.delete(sessionId);
                    console.log('翻译任务已停止:', sessionId);
                }
                
                sessionInfo.delete(sessionId);
                sessionTranslationServices.delete(sessionId);
                console.log('会话已清理:', sessionId);
                break;
            }
        }
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`CSV翻译服务器运行在 http://localhost:${PORT}`);
    console.log('支持的功能:');
    console.log('- CSV文件上传和解析');
    console.log('- 百度翻译API集成');
    console.log('- 28种语言翻译支持');
    console.log('- 翻译结果下载');
    console.log('- 实时翻译日志推送');
});

module.exports = app;