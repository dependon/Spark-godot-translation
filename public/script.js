class CSVTranslator {
    constructor() {
        this.apiConfigured = false;
        this.currentFile = null;
        this.supportedLanguages = {};
        this.translationLog = [];
        this.sessionId = null;
        this.socket = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSupportedLanguages();
        this.setupDragAndDrop();
        this.initSocket();
    }

    bindEvents() {
        // API配置
        document.getElementById('configBtn').addEventListener('click', () => this.configureAPI());
        
        // 文件上传
        document.getElementById('csvFile').addEventListener('change', (e) => this.handleFileSelect(e));
        
        // 翻译按钮
        document.getElementById('translateBtn').addEventListener('click', () => this.startTranslation());
        
        // 下载按钮
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadFile());
        
        // 清空日志按钮
        document.getElementById('clearLogBtn').addEventListener('click', () => this.clearTranslationLog());
        
        // 缓存统计按钮
        document.getElementById('cacheStatsBtn')?.addEventListener('click', () => this.showCacheStats());
        
        // 清理缓存按钮
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.clearCache());
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.endsWith('.csv')) {
                this.processFile(files[0]);
            } else {
                this.showMessage('请选择CSV文件', 'error');
            }
        });
    }

    async loadSupportedLanguages() {
        try {
            const response = await fetch('/api/languages');
            const data = await response.json();
            
            if (data.success) {
                this.supportedLanguages = data.languages;
                this.renderLanguageOptions();
            }
        } catch (error) {
            console.error('加载语言列表失败:', error);
        }
    }

    renderLanguageOptions() {
        const languageGrid = document.getElementById('languageGrid');
        languageGrid.innerHTML = '';
        
        Object.entries(this.supportedLanguages).forEach(([code, name]) => {
            if (code === 'auto') return; // 跳过自动检测
            
            const languageItem = document.createElement('div');
            languageItem.className = 'language-item';
            languageItem.innerHTML = `
                <input type="checkbox" id="lang_${code}" value="${code}" checked>
                <label for="lang_${code}">${name} (${code})</label>
            `;
            languageGrid.appendChild(languageItem);
        });
    }

    async configureAPI() {
        const appId = document.getElementById('appId').value.trim();
        const secretKey = document.getElementById('secretKey').value.trim();
        
        if (!appId || !secretKey) {
            this.showConfigMessage('请填写完整的API配置信息', 'error');
            return;
        }
        
        if (!this.sessionId) {
            this.showConfigMessage('会话未初始化，请刷新页面', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ appId, secretKey, sessionId: this.sessionId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.apiConfigured = true;
                this.showConfigMessage('API配置成功 (会话ID: ' + this.sessionId + ')', 'success');
            } else {
                this.showConfigMessage(data.message, 'error');
            }
        } catch (error) {
            this.showConfigMessage('配置失败: ' + error.message, 'error');
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        if (!file.name.endsWith('.csv')) {
            this.showMessage('请选择CSV文件', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('csvFile', file);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentFile = file;
                this.displayFileInfo(data.data);
                this.populateSourceColumns(data.data.headers);
                this.showTranslationSection();
            } else {
                this.showMessage(data.message, 'error');
            }
        } catch (error) {
            this.showMessage('文件处理失败: ' + error.message, 'error');
        }
    }

    displayFileInfo(fileData) {
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `
            <h3>文件信息</h3>
            <p><strong>文件名:</strong> ${fileData.fileName}</p>
            <p><strong>行数:</strong> ${fileData.rowCount}</p>
            <p><strong>列数:</strong> ${fileData.headers.length}</p>
            <p><strong>列名:</strong> ${fileData.headers.join(', ')}</p>
            <h4>数据预览:</h4>
            <div class="preview-table">
                ${this.renderPreviewTable(fileData.headers, fileData.preview)}
            </div>
        `;
    }

    renderPreviewTable(headers, preview) {
        let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
        
        // 表头
        html += '<tr>';
        headers.forEach(header => {
            html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${header}</th>`;
        });
        html += '</tr>';
        
        // 数据行
        preview.forEach(row => {
            html += '<tr>';
            headers.forEach(header => {
                html += `<td style="border: 1px solid #ddd; padding: 8px;">${row[header] || ''}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</table>';
        return html;
    }

    populateSourceColumns(headers) {
        const sourceColumn = document.getElementById('sourceColumn');
        sourceColumn.innerHTML = '<option value="">请选择源语言列</option>';
        
        headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            sourceColumn.appendChild(option);
        });
    }

    showTranslationSection() {
        document.getElementById('translationSection').style.display = 'block';
        document.getElementById('translationSection').classList.add('fade-in');
    }

    async startTranslation() {
        if (!this.apiConfigured) {
            this.showMessage('请先配置百度翻译API', 'error');
            return;
        }
        
        if (!this.currentFile) {
            this.showMessage('请先上传CSV文件', 'error');
            return;
        }
        
        const sourceColumn = document.getElementById('sourceColumn').value;
        if (!sourceColumn) {
            this.showMessage('请选择源语言列', 'error');
            return;
        }
        
        const selectedLanguages = this.getSelectedLanguages();
        if (selectedLanguages.length === 0) {
            this.showMessage('请至少选择一种目标语言', 'error');
            return;
        }
        
        const forceRetranslate = document.getElementById('forceRetranslate').checked;
        
        this.showProgressSection();
        this.updateProgress(0, '准备开始翻译...');
        
        // 清空之前的日志
        this.clearTranslationLog();
        
        const formData = new FormData();
        formData.append('csvFile', this.currentFile);
        formData.append('sourceColumn', sourceColumn);
        formData.append('targetLanguages', JSON.stringify(selectedLanguages));
        formData.append('forceRetranslate', forceRetranslate);
        formData.append('sessionId', this.sessionId);
        
        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.updateProgress(100, '翻译完成!');
                this.showResult(data.data);
            } else {
                this.showMessage(data.message, 'error');
                this.hideProgressSection();
            }
        } catch (error) {
            this.showMessage('翻译失败: ' + error.message, 'error');
            this.hideProgressSection();
        }
    }

    getSelectedLanguages() {
        const checkboxes = document.querySelectorAll('#languageGrid input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    showProgressSection() {
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('progressSection').classList.add('fade-in');
    }

    hideProgressSection() {
        document.getElementById('progressSection').style.display = 'none';
    }

    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').textContent = text;
    }

    showResult(resultData) {
        const resultSection = document.getElementById('resultSection');
        const resultInfo = document.getElementById('resultInfo');
        
        // 构建缓存统计信息
        let cacheStatsHtml = '';
        if (resultData.cacheStats) {
            const stats = resultData.cacheStats;
            cacheStatsHtml = `
                <div class="cache-stats">
                    <h4>🚀 性能优化统计</h4>
                    <ul>
                        <li><strong>总请求数:</strong> ${stats.totalRequests}</li>
                        <li><strong>缓存命中:</strong> ${stats.cacheHits}</li>
                        <li><strong>缓存命中率:</strong> <span class="highlight">${stats.hitRate}</span></li>
                        <li><strong>缓存大小:</strong> ${stats.cacheSize} 条记录</li>
                    </ul>
                    <p class="performance-note">💡 缓存命中率越高，翻译速度越快！</p>
                </div>
            `;
        }
        
        resultInfo.innerHTML = `
            <h3>翻译完成!</h3>
            <div class="result-stats">
                <ul>
                    <li><strong>翻译行数:</strong> ${resultData.translatedRows}</li>
                    <li><strong>翻译语言数:</strong> ${resultData.translatedLanguages}</li>
                    <li><strong>总翻译数:</strong> ${resultData.totalTranslations}</li>
                    <li><strong>文件名:</strong> ${resultData.fileName}</li>
                </ul>
            </div>
            ${cacheStatsHtml}
        `;
        
        // 保存下载URL
        this.downloadUrl = resultData.downloadUrl;
        
        resultSection.style.display = 'block';
        resultSection.classList.add('fade-in');
    }

    downloadFile() {
        if (this.downloadUrl) {
            window.open(this.downloadUrl, '_blank');
        } else {
            this.showMessage('没有可下载的文件', 'error');
        }
    }

    showMessage(message, type) {
        // 可以在页面顶部显示通知消息
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background-color: #28a745;' : 'background-color: #dc3545;'}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showConfigMessage(message, type) {
        const statusElement = document.getElementById('configStatus');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, 3000);
    }

    // 翻译日志相关方法
    addTranslationLog(originalText, translatedText, targetLanguage, status = 'success') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            originalText,
            translatedText,
            targetLanguage,
            status
        };
        
        this.translationLog.push(logEntry);
        this.renderLogEntry(logEntry);
        this.scrollLogToBottom();
    }

    renderLogEntry(logEntry) {
        const logContainer = document.getElementById('translationLog');
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${logEntry.status}`;
        
        const languageName = this.supportedLanguages[logEntry.targetLanguage] || logEntry.targetLanguage;
        
        logElement.innerHTML = `
            <div class="log-timestamp">${logEntry.timestamp}</div>
            <div class="log-content">
                <div><span class="log-original">原文:</span> ${this.escapeHtml(logEntry.originalText)}</div>
                <div><span class="log-translated">译文:</span> ${this.escapeHtml(logEntry.translatedText)}</div>
                <div class="log-language">目标语言: ${languageName} (${logEntry.targetLanguage})</div>
            </div>
        `;
        
        logContainer.appendChild(logElement);
    }

    clearTranslationLog() {
        this.translationLog = [];
        const logContainer = document.getElementById('translationLog');
        logContainer.innerHTML = '';
    }

    scrollLogToBottom() {
        const logContainer = document.getElementById('translationLog');
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 更新会话显示
    updateSessionDisplay() {
        const sessionDisplay = document.getElementById('sessionDisplay');
        if (sessionDisplay) {
            if (this.sessionId) {
                sessionDisplay.innerHTML = `<span class="session-info">当前会话: ${this.sessionId}</span>`;
                sessionDisplay.style.display = 'block';
            } else {
                sessionDisplay.innerHTML = '<span class="session-info">未连接</span>';
                sessionDisplay.style.display = 'block';
            }
        }
    }

    // Socket.IO初始化
     initSocket() {
         if (typeof io !== 'undefined') {
             this.socket = io();
             
             this.socket.on('connect', () => {
                 console.log('已连接到服务器');
             });
             
             // 接收服务器分配的会话ID
             this.socket.on('sessionAssigned', (data) => {
                 this.sessionId = data.sessionId;
                 console.log('会话ID已分配:', this.sessionId);
                 this.updateSessionDisplay();
                 // 向服务器注册会话ID
                 this.socket.emit('registerSession', { sessionId: this.sessionId });
             });
             
             this.socket.on('translationLog', (logData) => {
                 // 只处理属于当前会话的翻译日志
                 if (logData.sessionId === this.sessionId) {
                     this.addTranslationLog(
                         logData.originalText,
                         logData.translatedText,
                         logData.targetLanguage,
                         logData.status
                     );
                     
                     // 更新进度
                     if (logData.progress !== undefined) {
                         this.updateProgress(logData.progress, `翻译进度: ${logData.progress}%`);
                     }
                 }
             });
             
             this.socket.on('disconnect', () => {
                 console.log('与服务器断开连接');
                 this.sessionId = null;
                 this.updateSessionDisplay();
             });
         }
     }

     // 显示缓存统计信息
     async showCacheStats() {
         if (!this.sessionId) {
             this.showMessage('会话未初始化', 'error');
             return;
         }
         
         try {
             const response = await fetch(`/api/cache/stats/${this.sessionId}`);
             const data = await response.json();
             
             if (data.success) {
                 const stats = data.data;
                 const message = `缓存统计:\n总请求: ${stats.totalRequests}\n缓存命中: ${stats.cacheHits}\n命中率: ${stats.hitRate}\n缓存大小: ${stats.cacheSize} 条记录`;
                 alert(message);
             } else {
                 this.showMessage(data.message, 'error');
             }
         } catch (error) {
             this.showMessage('获取缓存统计失败: ' + error.message, 'error');
         }
     }
     
     // 清理缓存
     async clearCache() {
         if (!this.sessionId) {
             this.showMessage('会话未初始化', 'error');
             return;
         }
         
         if (!confirm('确定要清理翻译缓存吗？这将删除所有已缓存的翻译结果。')) {
             return;
         }
         
         try {
             const response = await fetch(`/api/cache/clear/${this.sessionId}`, {
                 method: 'POST'
             });
             const data = await response.json();
             
             if (data.success) {
                 this.showMessage('缓存已清理', 'success');
             } else {
                 this.showMessage(data.message, 'error');
             }
         } catch (error) {
             this.showMessage('清理缓存失败: ' + error.message, 'error');
         }
     }

     // 模拟翻译过程中的实时日志更新（保留作为备用）
     simulateTranslationProgress() {
         // 这个方法现在主要用于演示，实际翻译会通过Socket.IO接收实时数据
         const sampleTranslations = [
             { original: '你好', translated: 'Hello', language: 'en' },
             { original: '世界', translated: 'World', language: 'en' },
             { original: '游戏', translated: 'Game', language: 'en' },
             { original: '开始', translated: 'Start', language: 'en' }
         ];
         
         sampleTranslations.forEach((item, index) => {
             setTimeout(() => {
                 this.addTranslationLog(item.original, item.translated, item.language);
             }, (index + 1) * 1000);
         });
     }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        animation: slideIn 0.3s ease-out;
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new CSVTranslator();
});