// 全局变量
let uploadedFileName = '';
let supportedLanguages = {};
let fileHeaders = [];

// DOM元素
const csvFileInput = document.getElementById('csvFile');
const fileLabel = document.getElementById('fileLabel');
const fileInfo = document.getElementById('fileInfo');
const uploadAlert = document.getElementById('uploadAlert');
const sourceLanguageSelect = document.getElementById('sourceLanguage');
const languageGrid = document.getElementById('languageGrid');
const startTranslationBtn = document.getElementById('startTranslation');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const translationAlert = document.getElementById('translationAlert');
const downloadBtn = document.getElementById('downloadBtn');
const downloadAlert = document.getElementById('downloadAlert');

// 步骤元素
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadSupportedLanguages();
    setupEventListeners();
});

// 加载支持的语言列表
async function loadSupportedLanguages() {
    try {
        const response = await fetch('/api/languages');
        supportedLanguages = await response.json();
        console.log('支持的语言:', supportedLanguages);
    } catch (error) {
        console.error('加载语言列表失败:', error);
        showAlert(uploadAlert, 'error', '加载语言列表失败，请刷新页面重试');
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 文件选择
    csvFileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    fileLabel.addEventListener('dragover', handleDragOver);
    fileLabel.addEventListener('dragleave', handleDragLeave);
    fileLabel.addEventListener('drop', handleFileDrop);
    
    // 开始翻译
    startTranslationBtn.addEventListener('click', startTranslation);
    
    // 源语言选择变化
    sourceLanguageSelect.addEventListener('change', updateTargetLanguages);
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        uploadFile(file);
    }
}

// 处理拖拽
function handleDragOver(event) {
    event.preventDefault();
    fileLabel.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    fileLabel.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    fileLabel.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            csvFileInput.files = files;
            uploadFile(file);
        } else {
            showAlert(uploadAlert, 'error', '请选择CSV格式的文件');
        }
    }
}

// 上传文件
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    try {
        showAlert(uploadAlert, 'info', '正在上传文件...');
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            uploadedFileName = result.fileName;
            fileHeaders = result.headers;
            
            // 显示文件信息
            displayFileInfo(result);
            
            // 更新源语言选项
            updateSourceLanguageOptions(result.headers);
            
            // 激活步骤2
            activateStep(2);
            
            showAlert(uploadAlert, 'success', '文件上传成功！');
        } else {
            showAlert(uploadAlert, 'error', result.error || '文件上传失败');
        }
    } catch (error) {
        console.error('上传失败:', error);
        showAlert(uploadAlert, 'error', '文件上传失败: ' + error.message);
    }
}

// 显示文件信息
function displayFileInfo(fileData) {
    document.getElementById('fileName').textContent = `文件名: ${csvFileInput.files[0].name}`;
    document.getElementById('fileSize').textContent = `文件大小: ${formatFileSize(csvFileInput.files[0].size)}`;
    document.getElementById('rowCount').textContent = `数据行数: ${fileData.rowCount}`;
    document.getElementById('existingLanguages').textContent = `现有语言列: ${fileData.existingLanguages.join(', ')}`;
    
    // 显示预览表格
    if (fileData.preview && fileData.preview.length > 0) {
        const previewContainer = document.getElementById('previewContainer');
        previewContainer.innerHTML = '<h4>数据预览 (前5行):</h4>' + createPreviewTable(fileData.headers, fileData.preview);
    }
    
    fileInfo.style.display = 'block';
}

// 创建预览表格
function createPreviewTable(headers, data) {
    let html = '<table class="preview-table"><thead><tr>';
    
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            html += `<td>${row[header] || ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 更新源语言选项
function updateSourceLanguageOptions(headers) {
    sourceLanguageSelect.innerHTML = '<option value="">请选择源语言列</option>';
    
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header + (supportedLanguages[header] ? ` (${supportedLanguages[header]})` : '');
        sourceLanguageSelect.appendChild(option);
    });
}

// 更新目标语言选项
function updateTargetLanguages() {
    const sourceLanguage = sourceLanguageSelect.value;
    
    if (!sourceLanguage) {
        languageGrid.innerHTML = '';
        startTranslationBtn.disabled = true;
        return;
    }
    
    languageGrid.innerHTML = '';
    
    Object.entries(supportedLanguages).forEach(([code, name]) => {
        const languageItem = document.createElement('div');
        languageItem.className = 'language-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `lang_${code}`;
        checkbox.value = code;
        
        // 如果该语言列不存在于CSV中，默认选中
        if (!fileHeaders.includes(code)) {
            checkbox.checked = true;
        }
        
        // 如果是源语言，禁用选择
        if (code === sourceLanguage) {
            checkbox.disabled = true;
            checkbox.checked = false;
        }
        
        const label = document.createElement('label');
        label.htmlFor = `lang_${code}`;
        label.textContent = `${name} (${code})`;
        
        languageItem.appendChild(checkbox);
        languageItem.appendChild(label);
        languageGrid.appendChild(languageItem);
        
        // 添加变化监听
        checkbox.addEventListener('change', updateTranslationButton);
    });
    
    updateTranslationButton();
}

// 更新翻译按钮状态
function updateTranslationButton() {
    const checkedLanguages = languageGrid.querySelectorAll('input[type="checkbox"]:checked');
    startTranslationBtn.disabled = checkedLanguages.length === 0;
}

// 开始翻译
async function startTranslation() {
    const sourceLanguage = sourceLanguageSelect.value;
    const checkedBoxes = languageGrid.querySelectorAll('input[type="checkbox"]:checked');
    const targetLanguages = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (!sourceLanguage || targetLanguages.length === 0) {
        showAlert(translationAlert, 'error', '请选择源语言和目标语言');
        return;
    }
    
    try {
        // 显示进度条
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        startTranslationBtn.disabled = true;
        
        showAlert(translationAlert, 'info', '正在翻译，请稍候...');
        
        // 模拟进度更新
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            progressBar.style.width = progress + '%';
        }, 500);
        
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: uploadedFileName,
                sourceLanguage: sourceLanguage,
                targetLanguages: targetLanguages
            })
        });
        
        const result = await response.json();
        
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        
        if (result.success) {
            // 设置下载链接
            downloadBtn.href = `/api/download/${result.downloadFileName}`;
            downloadBtn.style.display = 'inline-block';
            
            // 激活步骤3
            activateStep(3);
            
            showAlert(translationAlert, 'success', `翻译完成！共翻译了 ${result.translatedRows} 行数据`);
        } else {
            showAlert(translationAlert, 'error', result.error || '翻译失败');
        }
    } catch (error) {
        console.error('翻译失败:', error);
        showAlert(translationAlert, 'error', '翻译失败: ' + error.message);
    } finally {
        startTranslationBtn.disabled = false;
    }
}

// 激活步骤
function activateStep(stepNumber) {
    // 移除所有步骤的active类
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    
    // 激活指定步骤
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // 滚动到激活的步骤
    document.getElementById(`step${stepNumber}`).scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// 显示提示信息
function showAlert(alertElement, type, message) {
    alertElement.className = `alert ${type}`;
    alertElement.textContent = message;
    alertElement.style.display = 'block';
    
    // 自动隐藏成功和信息提示
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 5000);
    }
}

// 错误处理
window.addEventListener('error', function(event) {
    console.error('页面错误:', event.error);
});

// 网络错误处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
});