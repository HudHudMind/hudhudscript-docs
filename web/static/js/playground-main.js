/**
 * HudHudScript Playground - Main Module
 * Modular, component-based architecture
 */

// ============================================================================
// Custom Exceptions
// ============================================================================
class SyntaxErrorException extends Error {
    constructor(message, errorType = 'SyntaxError', line = null, column = null) {
        super(message);
        this.name = 'SyntaxErrorException';
        this.errorType = errorType;
        this.line = line;
        this.column = column;
    }
}

class RuntimeErrorException extends Error {
    constructor(message, errorType = 'RuntimeError') {
        super(message);
        this.name = 'RuntimeErrorException';
        this.errorType = errorType;
    }
}

// ============================================================================
// API Module - Handles all API communication
// ============================================================================
const API = {
    baseUrl: '/api',
    
    async run(code, action) {
        // Get HMAC nonce first
        let nonce = null;
        try {
            const nonceResp = await fetch(`${this.baseUrl}/run-nonce?action=${encodeURIComponent(action)}`);
            const nonceData = await nonceResp.json();
            if (nonceData.success && nonceData.nonce) {
                nonce = nonceData.nonce;
            }
        } catch (e) { /* nonce fetch failed */ }
        
        const payload = { code, action, context: 'playground' };
        if (nonce) payload._nonce = nonce;
        if (window.CSRF_TOKEN) payload.csrf_token = window.CSRF_TOKEN;
        
        const response = await fetch(`${this.baseUrl}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.CSRF_TOKEN || '' },
            body: JSON.stringify(payload)
        });
        
        // Always parse JSON, regardless of status code
        const data = await response.json();
        
        // DEBUG: Log the response
        console.log('API Response:', { status: response.status, data });
        
        // If not successful, throw appropriate exception
        if (!data.success) {
            if (data.error_type === 'SyntaxError') {
                throw new SyntaxErrorException(data.error, data.error_type, data.line, data.column);
            } else if (data.error_type === 'RuntimeError') {
                throw new RuntimeErrorException(data.error, data.error_type);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        }
        
        return { response, data };
    },
    
    async getSample(lang, sampleName) {
        const response = await fetch(`${this.baseUrl}/samples/${lang}/${sampleName}`);
        if (!response.ok) {
            throw new Error(`Failed to load sample: ${response.statusText}`);
        }
        return await response.text();
    }
};

// ============================================================================
// UI Module - Handles all UI updates
// ============================================================================
const UI = {
    elements: {
        outputConsole: null,
        langSelector: null
    },
    
    init() {
        this.elements.outputConsole = document.getElementById('output-console');
        this.elements.langSelector = document.getElementById('lang-selector');
    },
    
    updateOutput(type, message) {
        if (!this.elements.outputConsole) return;

        const timestamp = new Date().toLocaleTimeString();
        const className = type === 'success' ? 'output-success' :
                         type === 'error' ? 'output-error' : 'output-info';

        let prefix, icon;
        if (type === 'success') {
            prefix = '<span class="output-prompt">$</span> ';
            icon = '✓';
        } else if (type === 'error') {
            prefix = '<span class="output-error">$</span> ';
            icon = '✗';
        } else {
            prefix = '<span class="output-prompt">$</span> ';
            icon = '⏳';
        }

        this.elements.outputConsole.innerHTML =
            `${prefix}<span class="output-dim">[${timestamp}]</span> <span class="${className}">${icon} ${this.escapeHtml(message)}</span>`;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    getCurrentLanguage() {
        // Read from custom dropdown (data-lang-selector) or fallback to window
        const dd = document.querySelector('[data-lang-selector]');
        if (dd && dd.dataset.current) return dd.dataset.current;
        return window.SITE_LANGUAGE || 'en';
    }
};

// ============================================================================
// Editor Module - Manages CodeMirror editor
// ============================================================================
const EditorModule = {
    instance: null,
    currentLang: window.SITE_LANGUAGE || 'en',
    
    init() {
        const textarea = document.getElementById('code-editor');
        if (!textarea) {
            console.error('Code editor textarea not found');
            return;
        }
        
        this.instance = CodeMirror.fromTextArea(textarea, {
            mode: 'javascript',
            theme: 'monokai',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            autofocus: true,
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-Enter': () => CodeRunner.run(),
                'Cmd-Enter': () => CodeRunner.run(),
                'Ctrl-S': () => CodeRunner.check(),
                'Cmd-S': () => CodeRunner.check()
            },
            hintOptions: {
                hint: this.getHints.bind(this),
                completeSingle: false
            }
        });
        
        // Auto-trigger autocomplete
        this.instance.on('inputRead', (cm, change) => {
            if (change.text[0].match(/[a-zA-Zа-яА-Яα-ωΑ-Ωぁ-んァ-ヶ一-龯\u0600-\u06FF\u0900-\u097F]/)) {
                cm.showHint({ completeSingle: false });
            }
        });
        
        // Set initial code
        this.setValue('// Loading example...');
    },
    
    getHints(editor) {
        const cur = editor.getCursor();
        const token = editor.getTokenAt(cur);
        const start = token.start;
        const end = cur.ch;
        const line = cur.line;
        const currentWord = token.string;
        
        // Detect language from shebang or use current selection
        const code = editor.getValue();
        const detectedLang = this.detectLanguageFromShebang(code);
        const lang = detectedLang || this.currentLang;
        
        // Get keyword hints (from hudhudscript-keywords.js)
        const hints = typeof getKeywordHints === 'function' 
            ? getKeywordHints(lang, currentWord) 
            : [];
        
        return {
            list: hints,
            from: CodeMirror.Pos(line, start),
            to: CodeMirror.Pos(line, end)
        };
    },
    
    detectLanguageFromShebang(code) {
        const firstLine = code.split('\n')[0];
        if (firstLine.startsWith('#!')) {
            const match = firstLine.match(/#!\s*hudhudscript\s+--lang[=\s]+(\w+)/);
            return match ? match[1] : null;
        }
        return null;
    },
    
    getValue() {
        return this.instance ? this.instance.getValue() : '';
    },
    
    setValue(code) {
        if (this.instance) {
            this.instance.setValue(code);
        }
    },
    
    setLanguage(lang) {
        this.currentLang = lang;
    }
};

// ============================================================================
// Code Runner Module - Handles code execution
// ============================================================================
const CodeRunner = {
    async execute(action) {
        const code = EditorModule.getValue().trim();
        
        if (!code) {
            UI.updateOutput('error', 'Please write some code first');
            return;
        }
        
        const actionText = action === 'check' ? 'Checking syntax' : 
                          action === 'compile' ? 'Compiling' : 'Running';
        UI.updateOutput('info', `${actionText}...`);
        
        try {
            const { response, data } = await API.run(code, action);
            
            // DEBUG: Log what we got
            console.log('CodeRunner received:', { success: data.success, error_type: data.error_type, error: data.error });
            
            // If we reach here, it means success!
            let output = '';
            
            if (data.output && data.output.trim()) {
                output = data.output;
            } else if (action === 'check') {
                output = 'Syntax is valid ✓';
            } else if (action === 'compile') {
                output = 'Compiled successfully ✓';
            } else {
                output = 'Executed successfully (no output)';
            }
            
            if (data.execution_time_ms !== undefined) {
                output += `\n\n⏱️ ${data.execution_time_ms}ms (toplam, başlatma dahil)`;
            }
            
            UI.updateOutput('success', output);
            
        } catch (error) {
            // Handle SyntaxError exceptions
            if (error instanceof SyntaxErrorException) {
                const errorIcon = '⚠';
                let errorMessage = `${errorIcon} ${error.errorType}\n${error.message}`;
                
                // Add line/column info if available
                if (error.line) {
                    errorMessage += `\n\nLine ${error.line}${error.column ? `, Column ${error.column}` : ''}`;
                }
                
                UI.updateOutput('error', errorMessage);
                console.log('Caught SyntaxErrorException:', error);
                return;
            }
            
            // Handle RuntimeError exceptions
            if (error instanceof RuntimeErrorException) {
                const errorIcon = '✗';
                const errorMessage = `${errorIcon} ${error.errorType}\n${error.message}`;
                UI.updateOutput('error', errorMessage);
                console.log('Caught RuntimeErrorException:', error);
                return;
            }
            
            // Handle network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                UI.updateOutput('error', 'Network Error\nCannot connect to server. Please make sure the server is running.');
                return;
            }
            
            // Handle other errors
            UI.updateOutput('error', `Error: ${error.message}`);
            console.error('Unexpected error:', error);
        }
    },
    
    check() {
        return this.execute('check');
    },
    
    compile() {
        return this.execute('compile');
    },
    
    run() {
        return this.execute('run');
    }
};

// ============================================================================
// Language Manager Module - Handles language switching
// ============================================================================
const LanguageManager = {
    async changeLanguage(lang) {
        EditorModule.setLanguage(lang);
        // Sync the playground lang-selector if it exists
        const selector = document.getElementById('lang-selector');
        if (selector && selector.value !== lang) {
            selector.value = lang;
        }
        await this.loadExample(lang);
    },
    
    async loadExample(lang) {
        try {
            const code = await API.getSample(lang || UI.getCurrentLanguage(), 'basic_example');
            EditorModule.setValue(code);
            UI.updateOutput('info', `Loaded example for ${(lang || UI.getCurrentLanguage()).toUpperCase()}`);
        } catch (error) {
            UI.updateOutput('error', `No example available for ${(lang || UI.getCurrentLanguage()).toUpperCase()}`);
        }
    }
};

// ============================================================================
// Quick Examples Module - Handles quick example loading
// ============================================================================
// Quick Examples Module - Loads examples from files
// ============================================================================
const QuickExamples = {
    // Load example from file
    async load(type) {
        const lang = UI.getCurrentLanguage();
        const filename = `/playground/quick-examples/${type}.${lang}.hudhud`;
        
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                // Fallback to English if language file not found
                const fallbackFilename = `/playground/quick-examples/${type}.en.hudhud`;
                const fallbackResponse = await fetch(fallbackFilename);
                if (!fallbackResponse.ok) {
                    throw new Error(`Example "${type}" not found`);
                }
                const code = await fallbackResponse.text();
                EditorModule.setValue(code);
                UI.updateOutput('info', `Loaded ${type} example (English fallback)`);
                return;
            }
            
            const code = await response.text();
            EditorModule.setValue(code);
            UI.updateOutput('info', `Loaded ${type} example`);
        } catch (error) {
            console.error('Failed to load example:', error);
            UI.updateOutput('error', `Failed to load example: ${error.message}`);
        }
    }
};

// ============================================================================
// Global Functions - Exposed to HTML onclick handlers
// ============================================================================
window.loadExample = () => QuickExamples.load('hello');
window.loadQuickExample = (type) => QuickExamples.load(type);
window.clearEditor = () => {
    EditorModule.setValue('');
    UI.updateOutput('info', 'Editor cleared');
};
window.runCode = (action) => CodeRunner.execute(action);

// ============================================================================
// Application Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    EditorModule.init();
    UI.updateOutput('info', 'Ready to run code...');
});
