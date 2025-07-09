class CSVTranslator {
    constructor() {
        this.apiConfigured = false;
        this.currentFile = null;
        this.supportedLanguages = {};
        this.translationLog = [];
        this.sessionId = null;
        this.socket = null;
        this.heartbeatInterval = null;
        this.lastHeartbeat = Date.now();
        this.connectionStable = true;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSupportedLanguages();
        this.setupDragAndDrop();
        this.disableSessionDependentButtons(); // 初始时禁用会话相关按钮
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
        
        // 缓存统计按钮 - 添加会话检查
        document.getElementById('cacheStatsBtn')?.addEventListener('click', () => {
            if (!this.sessionId) {
                this.showMessage('请等待与服务器连接建立', 'warning');
                return;
            }
            this.showCacheStats();
        });
        
        // 清理缓存按钮 - 添加会话检查
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
            if (!this.sessionId) {
                this.showMessage('请等待与服务器连接建立', 'warning');
                return;
            }
            this.clearCache();
        });
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
        const response = await fetch('/api/languages');
        const data = await response.json();
        
        if (data.success) {
            this.supportedLanguages = data.languages;
            this.renderLanguageOptions();
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
        
        this.updateProgress(0, '准备开始翻译...');
        
        
        const formData = new FormData();
        formData.append('csvFile', this.currentFile);
        formData.append('sourceColumn', sourceColumn);
        formData.append('targetLanguages', JSON.stringify(selectedLanguages));
        formData.append('forceRetranslate', forceRetranslate);
        formData.append('sessionId', this.sessionId);
        
        // 设置较长的超时时间
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时
        
        const response = await fetch('/api/translate', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            this.updateProgress(100, '翻译完成!');
            this.showResult(data.data);
        } else {
            this.showMessage(data.message, 'error');
            this.addTranslationLog('系统', data.message, '系统', 'error', data.message);
            this.updateProgress(100, '翻译失败');
        }
    }

    getSelectedLanguages() {
        const checkboxes = document.querySelectorAll('#languageGrid input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // 进度区域现在始终显示，不需要显示/隐藏方法

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

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        // 根据类型设置背景色
        switch(type) {
            case 'success':
                messageDiv.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                messageDiv.style.backgroundColor = '#ff9800';
                break;
            default:
                messageDiv.style.backgroundColor = '#2196F3';
        }
        
        // 添加到页面
        document.body.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }
    
    // 开始心跳检测
    startHeartbeat() {
        this.stopHeartbeat(); // 先停止之前的心跳
        this.lastHeartbeat = Date.now();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                // 发送心跳
                this.socket.emit('heartbeat', { timestamp: Date.now() });
                
                // 检查是否超时
                const now = Date.now();
                if (now - this.lastHeartbeat > 30000) { // 30秒超时
                    console.warn('心跳超时，连接可能不稳定');
                    if (this.connectionStable) {
                        this.connectionStable = false;
                        this.showMessage('连接不稳定，正在尝试重连...', 'warning');
                    }
                }
            }
        }, 10000); // 每10秒发送一次心跳
    }
    
    // 停止心跳检测
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // 处理心跳响应
    handleHeartbeatResponse() {
        this.lastHeartbeat = Date.now();
        if (!this.connectionStable) {
            this.connectionStable = true;
            this.showMessage('连接已恢复稳定', 'success');
        }
    }
    
    showDownloadLink(fileName) {
        // 在结果区域显示下载链接
        const resultSection = document.getElementById('resultSection');
        if (!resultSection) {
            // 如果结果区域不存在，创建一个临时的下载区域
            const downloadSection = document.createElement('div');
            downloadSection.id = 'downloadSection';
            downloadSection.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            `;
            downloadSection.innerHTML = `
                <h3>📥 下载翻译结果</h3>
                <p>翻译已完成，点击下面的链接下载结果文件：</p>
                <a href="/api/download/${fileName}" class="btn btn-primary" download>
                    📄 下载 ${fileName}
                </a>
            `;
            
            // 插入到进度区域后面
            const progressSection = document.getElementById('progressSection');
            if (progressSection && progressSection.parentNode) {
                progressSection.parentNode.insertBefore(downloadSection, progressSection.nextSibling);
            } else {
                document.querySelector('.container').appendChild(downloadSection);
            }
        } else {
            // 如果结果区域存在，更新下载链接
            this.downloadUrl = `/api/download/${fileName}`;
            resultSection.style.display = 'block';
            resultSection.classList.add('fade-in');
            
            // 更新结果信息，添加下载链接
            const resultInfo = document.getElementById('resultInfo');
            if (resultInfo) {
                const downloadLinkHtml = `
                    <div class="download-section" style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 5px;">
                        <h4>📥 下载翻译结果</h4>
                        <a href="/api/download/${fileName}" class="btn btn-primary" download>
                            📄 下载 ${fileName}
                        </a>
                    </div>
                `;
                resultInfo.innerHTML += downloadLinkHtml;
            }
        }
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
    addTranslationLog(originalText, translatedText, targetLanguage, status = 'success', error = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            originalText,
            translatedText,
            targetLanguage,
            status,
            error
        };
        
        // 如果这是第一条真实的翻译日志，清除初始提示
        if (this.translationLog.length === 0) {
            const logContainer = document.getElementById('translationLog');
            logContainer.innerHTML = '';
        }
        
        this.translationLog.push(logEntry);
        this.renderLogEntry(logEntry);
        this.scrollLogToBottom();
    }

    renderLogEntry(logEntry) {
        const logContainer = document.getElementById('translationLog');
        const logElement = document.createElement('div');
        logElement.className = `log-entry ${logEntry.status}`;
        
        const languageName = this.supportedLanguages[logEntry.targetLanguage] || logEntry.targetLanguage;
        
        // 构建错误信息显示
        let errorHtml = '';
        if (logEntry.error && logEntry.status === 'error') {
            errorHtml = `<div class="log-error">❌ 错误: ${this.escapeHtml(logEntry.error)}</div>`;
        }
        
        logElement.innerHTML = `
            <div class="log-timestamp">${logEntry.timestamp}</div>
            <div class="log-content">
                <div><span class="log-original">原文:</span> ${this.escapeHtml(logEntry.originalText)}</div>
                <div><span class="log-translated">译文:</span> ${this.escapeHtml(logEntry.translatedText)}</div>
                <div class="log-language">目标语言: ${languageName} (${logEntry.targetLanguage})</div>
                ${errorHtml}
            </div>
        `;
        
        logContainer.appendChild(logElement);
    }

    clearTranslationLog() {
        this.translationLog = [];
        const logContainer = document.getElementById('translationLog');
        logContainer.innerHTML = `
            <div class="log-entry" style="border-left-color: #6c757d; background: #f8f9fa;">
                <div class="log-timestamp">系统</div>
                <div class="log-content">
                    <div style="color: #6c757d; font-style: italic;">翻译日志将在此处显示...</div>
                </div>
            </div>
        `;
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
    
    // 启用依赖会话的按钮
    enableSessionDependentButtons() {
        const cacheStatsBtn = document.getElementById('cacheStatsBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        if (cacheStatsBtn) {
            cacheStatsBtn.disabled = false;
            cacheStatsBtn.title = '查看翻译缓存统计信息';
        }
        
        if (clearCacheBtn) {
            clearCacheBtn.disabled = false;
            clearCacheBtn.title = '清理翻译缓存';
        }
        
        console.log('会话相关功能已启用');
    }
    
    // 禁用依赖会话的按钮
    disableSessionDependentButtons() {
        const cacheStatsBtn = document.getElementById('cacheStatsBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        if (cacheStatsBtn) {
            cacheStatsBtn.disabled = true;
            cacheStatsBtn.title = '请等待与服务器连接建立';
        }
        
        if (clearCacheBtn) {
            clearCacheBtn.disabled = true;
            clearCacheBtn.title = '请等待与服务器连接建立';
        }
    }

    // Socket.IO初始化
     initSocket() {
         if (typeof io !== 'undefined') {
             // 配置Socket.IO选项，包括重连机制
             this.socket = io({
                 reconnection: true,
                 reconnectionDelay: 1000,
                 reconnectionAttempts: 5,
                 timeout: 20000
             });
             
             this.socket.on('connect', () => {
                 console.log('已连接到服务器');
                 this.showMessage('已连接到服务器', 'success');
                 this.connectionStable = true;
                 this.startHeartbeat();
             });
             
             this.socket.on('reconnect', (attemptNumber) => {
                 console.log('重新连接成功，尝试次数:', attemptNumber);
                 this.showMessage('重新连接成功', 'success');
             });
             
             this.socket.on('reconnect_attempt', (attemptNumber) => {
                 console.log('尝试重新连接...', attemptNumber);
                 this.showMessage(`尝试重新连接... (${attemptNumber}/5)`, 'warning');
             });
             
             this.socket.on('reconnect_failed', () => {
                 console.log('重新连接失败');
                 this.showMessage('连接失败，请刷新页面重试', 'error');
             });
             
             this.socket.on('connect_error', (error) => {
                 console.error('连接错误:', error);
                 this.showMessage('连接服务器时出错', 'error');
             });
             
             // 接收服务器分配的会话ID
             this.socket.on('sessionAssigned', (data) => {
                 try {
                     this.sessionId = data.sessionId;
                     console.log('会话ID已分配:', this.sessionId);
                     this.updateSessionDisplay();
                     // 向服务器注册会话ID
                     this.socket.emit('registerSession', { sessionId: this.sessionId });
                     
                     // 会话建立后，启用相关按钮
                     this.enableSessionDependentButtons();
                 } catch (error) {
                     console.error('处理会话分配时出错:', error);
                     this.showMessage('会话初始化失败', 'error');
                 }
             });
             
             this.socket.on('translationLog', (logData) => {
                 try {
                     // 数据验证
                     if (!logData || typeof logData !== 'object') {
                         console.warn('收到无效的翻译日志数据:', logData);
                         return;
                     }
                     
                     // 只处理属于当前会话的翻译日志
                     if (logData.sessionId === this.sessionId) {
                         this.addTranslationLog(
                             logData.originalText || '数据错误',
                             logData.translatedText || '翻译错误',
                             logData.targetLanguage || 'unknown',
                             logData.status || 'error',
                             logData.error
                         );
                         
                         // 更新进度（无论成功还是失败都要更新）
                         if (logData.progress !== undefined && !isNaN(logData.progress)) {
                             const progressText = logData.status === 'error' ? 
                                 `翻译进度: ${logData.progress}% (有错误)` : 
                                 `翻译进度: ${logData.progress}%`;
                             this.updateProgress(logData.progress, progressText);
                         }
                     }
                 } catch (error) {
                     console.error('处理翻译日志时出错:', error);
                     // 显示错误但不中断翻译进程
                     this.showMessage('接收翻译日志时出现错误，但翻译继续进行', 'warning');
                 }
             });
             
             // 监听翻译完成事件
             this.socket.on('translationComplete', (data) => {
                 if (data.sessionId === this.sessionId) {
                     console.log('翻译任务完成:', data.message);
                     
                     // 根据是否有错误显示不同的消息
                     if (data.hasErrors) {
                         this.updateProgress(100, '翻译完成(有错误) - 已生成部分结果');
                         this.showMessage(`翻译过程中遇到错误，但已生成部分翻译结果。文件: ${data.fileName}`, 'warning');
                     } else {
                         this.updateProgress(100, '翻译任务完成!');
                         this.showMessage(`翻译任务完成！文件: ${data.fileName}`, 'success');
                     }
                     
                     // 显示下载链接
                     if (data.fileName) {
                         this.showDownloadLink(data.fileName);
                     }
                 }
             });
             
             // 监听翻译停止事件
             this.socket.on('translationStopped', (data) => {
                 if (data.sessionId === this.sessionId) {
                     console.log('翻译任务已停止:', data.message);
                     this.showMessage('翻译任务已停止 - 客户端连接断开', 'warning');
                     
                     // 更新进度显示
                     const progressElement = document.getElementById('progressText');
                     if (progressElement) {
                         progressElement.textContent = '翻译已停止';
                     }
                 }
             });
             
             // 心跳响应
             this.socket.on('heartbeat_response', () => {
                 this.handleHeartbeatResponse();
             });
             
             this.socket.on('disconnect', () => {
                   console.log('与服务器断开连接');
                   this.showMessage('与服务器断开连接', 'warning');
                   this.connectionStable = false;
                   this.stopHeartbeat();
                   this.sessionId = null;
                   this.updateSessionDisplay();
                   this.disableSessionDependentButtons();
               });
         }
     }

     // 显示缓存统计信息
     async showCacheStats() {
         if (!this.sessionId) {
             this.showMessage('会话未初始化，请等待连接建立', 'warning');
             return;
         }
         
         const response = await fetch(`/api/cache/stats/${this.sessionId}`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json'
             }
         });
         
         if (!response.ok) {
             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }
         
         const data = await response.json();
         
         if (data.success) {
             const stats = data.data;
             const message = `缓存统计:\n总请求: ${stats.totalRequests}\n缓存命中: ${stats.cacheHits}\n命中率: ${stats.hitRate}\n缓存大小: ${stats.cacheSize} 条记录`;
             alert(message);
         } else {
             this.showMessage(data.message, 'error');
         }
     }
     
     // 清理缓存
     async clearCache() {
         if (!this.sessionId) {
             this.showMessage('会话未初始化，请等待连接建立', 'warning');
             return;
         }
         
         if (!confirm('确定要清理翻译缓存吗？这将删除所有已缓存的翻译结果。')) {
             return;
         }
         
         const response = await fetch(`/api/cache/clear/${this.sessionId}`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json'
             }
         });
         
         if (!response.ok) {
             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }
         
         const data = await response.json();
         
         if (data.success) {
             this.showMessage('缓存已清理', 'success');
         } else {
             this.showMessage(data.message, 'error');
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