/**
 * Multi-Language Code Viewer
 * Shows code examples with language switcher flags
 */

// Language configurations with flag emojis
const LANGUAGES = {
    'en': { name: 'English', flag: '🇬🇧', dir: 'ltr' },
    'tr': { name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
    'ja': { name: '日本語', flag: '🇯🇵', dir: 'ltr' },
    'ar': { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
    'bn': { name: 'বাংলা', flag: '🇧🇩', dir: 'ltr' },
    'ru': { name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
    'es': { name: 'Español', flag: '🇪🇸', dir: 'ltr' },
    'de': { name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
    'fr': { name: 'Français', flag: '🇫🇷', dir: 'ltr' },
    'it': { name: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
    'pt': { name: 'Português', flag: '🇵🇹', dir: 'ltr' },
    'zh': { name: '中文', flag: '🇨🇳', dir: 'ltr' },
    'hi': { name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
    'id': { name: 'Indonesia', flag: '🇮🇩', dir: 'ltr' },
    'vi': { name: 'Tiếng Việt', flag: '🇻🇳', dir: 'ltr' },
    'el': { name: 'Ελληνικά', flag: '🇬🇷', dir: 'ltr' },
    'pl': { name: 'Polski', flag: '🇵🇱', dir: 'ltr' },
    'th': { name: 'ไทย', flag: '🇹🇭', dir: 'ltr' },
    'bs': { name: 'Bosanski', flag: '🇧🇦', dir: 'ltr' },
    'hr': { name: 'Hrvatski', flag: '🇭🇷', dir: 'ltr' },
    'sr': { name: 'Српски', flag: '🇷🇸', dir: 'ltr' },
    'fa': { name: 'فارسی', flag: '🇮🇷', dir: 'rtl' },
    'ku': { name: 'Kurdî', flag: '🌍', dir: 'ltr' }
};

// Module file name mappings per language
const MODULE_FILE_NAMES = {
    'math': {
        'en': 'math', 'tr': 'cebir', 'ja': 'sugaku', 'ar': 'رياضيات',
        'ru': 'matematika', 'es': 'matematicas', 'zh': 'shuxue',
        'de': 'mathematik', 'fr': 'mathematiques', 'it': 'math',
        'pt': 'math', 'pl': 'math', 'th': 'math', 'id': 'math',
        'vi': 'math', 'el': 'math', 'sr': 'math', 'bs': 'math',
        'hr': 'math', 'ku': 'math', 'fa': 'math', 'hi': 'math', 'bn': 'math'
    },
    'physics': {
        'en': 'physics', 'tr': 'fizik', 'ja': 'butsuri', 'ar': 'فيزياء',
        'ru': 'fizika', 'es': 'fisica', 'zh': 'wuli',
        'de': 'physik', 'fr': 'physique', 'it': 'physics',
        'pt': 'physics', 'pl': 'physics', 'th': 'physics', 'id': 'physics',
        'vi': 'physics', 'el': 'physics', 'sr': 'physics', 'bs': 'physics',
        'hr': 'physics', 'ku': 'physics', 'fa': 'physics', 'hi': 'physics', 'bn': 'physics'
    },
    'chemistry': {
        'en': 'chemistry', 'tr': 'kimya', 'ja': 'kagaku', 'ar': 'كيمياء',
        'ru': 'himiya', 'es': 'quimica', 'zh': 'huaxue',
        'de': 'chemie', 'fr': 'chimie', 'it': 'chemistry',
        'pt': 'chemistry', 'pl': 'chemistry', 'th': 'chemistry', 'id': 'chemistry',
        'vi': 'chemistry', 'el': 'chemistry', 'sr': 'chemistry', 'bs': 'chemistry',
        'hr': 'chemistry', 'ku': 'chemistry', 'fa': 'chemistry', 'hi': 'chemistry', 'bn': 'chemistry'
    }
};

// Get localized file name for a sample
function getLocalizedSampleName(sampleName, lang) {
    // Check if this is a module file that needs translation
    if (MODULE_FILE_NAMES[sampleName] && MODULE_FILE_NAMES[sampleName][lang]) {
        return MODULE_FILE_NAMES[sampleName][lang];
    }
    // Return original name if no translation exists
    return sampleName;
}

class MultiLangCodeViewer {
    constructor(containerId, sampleName, availableLanguages = null) {
        this.container = document.getElementById(containerId);
        this.sampleName = sampleName;
        this.availableLanguages = availableLanguages || Object.keys(LANGUAGES);
        this.currentLang = this.detectBrowserLanguage();
        this.codeCache = {};
        
        this.init();
    }
    
    detectBrowserLanguage() {
        // 1. Check localStorage first (user preference)
        const savedLang = localStorage.getItem('hudhudscript_language');
        if (savedLang && this.availableLanguages.includes(savedLang)) {
            return savedLang;
        }
        
        // 2. Check if site language is set and available
        if (window.SITE_LANGUAGE && this.availableLanguages.includes(window.SITE_LANGUAGE)) {
            return window.SITE_LANGUAGE;
        }
        
        // 3. Get browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const langCode = browserLang.split('-')[0]; // Get 'en' from 'en-US'
        
        // Check if this language is available
        if (this.availableLanguages.includes(langCode)) {
            return langCode;
        }
        
        // 4. Default to English
        return 'en';
    }
    
    init() {
        if (!this.container) {
            console.error('Container not found:', this.container);
            return;
        }
        
        // Set initial data-current-lang attribute
        this.container.setAttribute('data-current-lang', this.currentLang);
        
        this.render();
        this.loadCode(this.currentLang);
    }
    
    render() {
        // Create a safe function name by replacing hyphens with underscores
        const safeFuncName = `switchLanguage_${this.container.id.replace(/-/g, '_')}`;
        
        this.container.innerHTML = `
            <div class="multilang-code-viewer">
                <!-- Code Display -->
                <div class="code-container">
                    <div class="code-header">
                        <span class="current-language">
                            <span class="flag">${LANGUAGES[this.currentLang].flag}</span>
                            <span class="name">${LANGUAGES[this.currentLang].name}</span>
                        </span>
                        <div class="header-actions">
                            <!-- Language Selector Dropdown -->
                            <select class="language-selector" data-action="switch-lang" data-container="${this.container.id}">
                                ${this.renderLanguageOptions()}
                            </select>
                            <button class="copy-button" data-action="copy-code" data-container="${this.container.id}">
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    <pre class="code-content" dir="${LANGUAGES[this.currentLang].dir}"><code id="${this.container.id}-code" class="language-hudhud">Loading...</code></pre>
                    
                    <!-- Action Buttons -->
                    <div class="code-actions">
                        <button class="action-button check-button" data-action="execute" data-mode="check" data-container="${this.container.id}" title="Check syntax">
                            ✓ Check
                        </button>
                        <button class="action-button run-button" data-action="execute" data-mode="run" data-container="${this.container.id}" title="Run code">
                            ▶ Run
                        </button>
                    </div>
                    
                    <!-- Output Area -->
                    <div id="${this.container.id}-output" class="code-output hidden">
                        <div class="output-header">
                            <span class="output-title">Output</span>
                            <button class="close-output" data-action="close-output" data-container="${this.container.id}">✕</button>
                        </div>
                        <pre class="output-content"></pre>
                    </div>
                </div>
            </div>
        `;
        
        // Create global function for this instance
        window[safeFuncName] = (lang) => {
            this.switchLanguage(lang);
        };

        // Attach change event listener to the language selector
        const selector = this.container.querySelector('.language-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.switchLanguage(e.target.value);
            });
        }
    }
    
    renderLanguageOptions() {
        return this.availableLanguages.map(lang => {
            const config = LANGUAGES[lang];
            const isSelected = lang === this.currentLang;
            return `<option value="${lang}" ${isSelected ? 'selected' : ''}>${config.flag} ${config.name}</option>`;
        }).join('');
    }
    
    switchLanguage(lang) {
        if (lang === this.currentLang) {
            return;
        }
        
        this.currentLang = lang;
        
        // Save to localStorage for persistence
        localStorage.setItem('hudhudscript_language', lang);
        
        // Update data-current-lang attribute for API calls
        this.container.setAttribute('data-current-lang', lang);
        
        this.render();
        this.loadCode(lang);
    }
    
    async loadCode(lang) {
        // Check cache first
        if (this.codeCache[lang]) {
            this.displayCode(this.codeCache[lang]);
            return;
        }
        
        // Get localized sample name
        const localizedSampleName = getLocalizedSampleName(this.sampleName, lang);
        
        // Add file extension based on language
        const extension = lang === 'ar' ? '.هدهد' : '.hudhud';
        const fileName = `${localizedSampleName}${extension}`;
        
        try {
            const url = `/api/samples/${lang}/${fileName}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const code = await response.text();
            
            this.codeCache[lang] = code;
            this.displayCode(code);
        } catch (error) {
            console.error('Error loading code:', error);
            this.displayCode(`// Error loading ${LANGUAGES[lang].name} version\n// ${error.message}`);
        }
    }
    
    displayCode(code) {
        const codeElement = document.getElementById(`${this.container.id}-code`);
        if (!codeElement) {
            console.error('Code element not found:', `${this.container.id}-code`);
            return;
        }
        
        // Split code into lines
        const lines = code.split('\n');
        const lineCount = lines.length;
        
        // Create line numbers HTML
        const lineNumbersHTML = Array.from({ length: lineCount }, (_, i) => 
            `<span>${i + 1}</span>`
        ).join('');
        
        // Find the pre element (parent of code element)
        const preElement = codeElement.parentElement;
        if (!preElement || preElement.tagName !== 'PRE') {
            console.error('Pre element not found or invalid structure');
            return;
        }
        
        // Find or create the wrapper structure
        let wrapper = preElement.parentElement;

        // Check if we already have the line numbers structure
        // After first wrap, pre's parent is 'code-lines', so check both parent and grandparent
        const alreadyWrapped = (wrapper && wrapper.classList.contains('code-content-with-lines')) ||
                               (wrapper && wrapper.classList.contains('code-lines') &&
                                wrapper.parentElement && wrapper.parentElement.classList.contains('code-content-with-lines'));

        if (!alreadyWrapped) {
            // First time - need to create the structure
            const grandParent = preElement.parentElement;
            
            // Create wrapper
            wrapper = document.createElement('div');
            wrapper.className = 'code-content-with-lines';
            
            // Create line numbers div
            const lineNumbersDiv = document.createElement('div');
            lineNumbersDiv.className = 'line-numbers';
            lineNumbersDiv.innerHTML = lineNumbersHTML;
            
            // Create code lines div
            const codeLinesDiv = document.createElement('div');
            codeLinesDiv.className = 'code-lines';
            
            // Build structure
            wrapper.appendChild(lineNumbersDiv);
            wrapper.appendChild(codeLinesDiv);
            
            // Replace pre element with wrapper
            grandParent.replaceChild(wrapper, preElement);
            
            // Move pre element into code-lines div
            codeLinesDiv.appendChild(preElement);
        } else {
            // Already have structure - just update line numbers
            // If wrapper is 'code-lines', go up to the actual 'code-content-with-lines' container
            const actualWrapper = wrapper.classList.contains('code-content-with-lines')
                ? wrapper
                : wrapper.parentElement;
            const lineNumbersDiv = actualWrapper.querySelector('.line-numbers');
            if (lineNumbersDiv) {
                lineNumbersDiv.innerHTML = lineNumbersHTML;
            }
        }
        
        // Update code content
        codeElement.textContent = code;
        
        // Trigger syntax highlighting
        if (window.Prism) {
            Prism.highlightElement(codeElement);
        } else if (window.hljs) {
            hljs.highlightElement(codeElement);
        }
    }
}

// Helper function to highlight error line
function highlightErrorLine(containerId, lineNumber, columnNumber) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Find line numbers div
    const lineNumbersDiv = container.querySelector('.line-numbers');
    if (!lineNumbersDiv) return;
    
    // Remove any existing highlights
    clearErrorHighlights(containerId);
    
    // Highlight the specific line number
    const lineSpans = lineNumbersDiv.querySelectorAll('span');
    if (lineSpans[lineNumber - 1]) {
        lineSpans[lineNumber - 1].classList.add('error-line-highlight');
        
        // Scroll to the error line
        lineSpans[lineNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Also highlight the code line
    const codeElement = document.getElementById(`${containerId}-code`);
    if (codeElement) {
        const lines = codeElement.textContent.split('\n');
        if (lines[lineNumber - 1]) {
            // Add a visual indicator in the code
            const codeLines = container.querySelector('.code-lines');
            if (codeLines) {
                codeLines.classList.add('has-error');
            }
        }
    }
}

// Helper function to clear error highlights
function clearErrorHighlights(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Remove line number highlights
    const existingHighlights = container.querySelectorAll('.error-line-highlight');
    existingHighlights.forEach(el => el.classList.remove('error-line-highlight'));
    
    // Remove code line highlights
    const codeLines = container.querySelector('.code-lines');
    if (codeLines) {
        codeLines.classList.remove('has-error');
    }
}

// Helper function to copy code
function copyCode(containerId) {
    const codeElement = document.getElementById(`${containerId}-code`);
    if (codeElement) {
        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            // Show feedback
            const button = document.querySelector(`#${containerId} .copy-button`);
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
}

// Helper function to execute code
async function executeCode(containerId, action) {
    const codeElement = document.getElementById(`${containerId}-code`);
    const outputContainer = document.getElementById(`${containerId}-output`);
    const outputContent = outputContainer.querySelector('.output-content');
    const outputTitle = outputContainer.querySelector('.output-title');
    
    if (!codeElement || !outputContainer) {
        console.error('Elements not found');
        return;
    }
    
    const code = codeElement.textContent;
    
    // Show output container with loading state
    outputContainer.classList.remove('hidden');
    outputContainer.style.display = 'block';
    outputContent.textContent = `${action === 'check' ? 'Checking' : action === 'compile' ? 'Compiling' : 'Running'}...`;
    outputContent.className = 'output-content loading';
    outputTitle.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)}ing...`;
    
    // Find the button that was clicked and disable it
    const button = document.querySelector(`#${containerId} .${action}-button`);
    if (button) {
        button.disabled = true;
        button.classList.add('loading');
    }
    
    try {
        console.log(`Executing ${action} for ${containerId}`);
        
        // Get current language from the code viewer
        const codeViewer = document.querySelector(`#${containerId}`);
        const currentLang = codeViewer ? codeViewer.getAttribute('data-current-lang') || 'en' : 'en';
        
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': window.CSRF_TOKEN || ''
            },
            body: JSON.stringify({
                code: code,
                action: action,
                language: currentLang,
                csrf_token: window.CSRF_TOKEN || ''
            })
        });
        
        console.log(`Response status: ${response.status}`);
        
        // Parse JSON response regardless of status code
        const data = await response.json();
        console.log('Result:', data);
        
        // Check if execution was successful
        if (!data.success) {
            // Handle syntax/runtime errors
            const errorType = data.error_type || 'Error';
            const errorIcon = errorType === 'SyntaxError' ? '⚠' : '✗';
            
            // Highlight error line if available
            if (data.line) {
                highlightErrorLine(containerId, data.line, data.column);
            }
            
            // Build error message
            let errorMsg = `${errorIcon} ${errorType}\n${data.error || 'Unknown error'}`;
            if (data.line) {
                errorMsg += `\n\nLine ${data.line}${data.column ? `, Column ${data.column}` : ''}`;
            }
            
            throw new Error(errorMsg);
        }
        
        // Update output
        if (data.success) {
            // Clear any error highlights
            clearErrorHighlights(containerId);
            
            outputContent.className = 'output-content success';
            outputTitle.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} - Success ✓`;
            
            let output = data.output || 'Success!';
            if (action === 'check') {
                output = data.output || '✓ Syntax check passed!';
            } else if (action === 'compile') {
                output = data.output || '✓ Compilation successful!';
            }
            
            outputContent.textContent = output;
        }
    } catch (error) {
        console.error('Execution error:', error);
        outputContent.className = 'output-content error';
        
        // Only show "Network error" for actual network issues
        if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
            outputTitle.textContent = 'Network Error ✗';
            outputContent.textContent = `Cannot connect to server.\n\nPlease make sure the server is running.`;
        } else {
            outputTitle.textContent = 'Error ✗';
            outputContent.textContent = `Error: ${error.message}`;
        }
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }
}

// Helper function to close output
function closeOutput(containerId) {
    const outputContainer = document.getElementById(`${containerId}-output`);
    if (outputContainer) {
        outputContainer.classList.add('hidden');
    }
}

// Initialize viewers on page load
document.addEventListener('DOMContentLoaded', () => {
    // Store all viewer instances globally
    window.codeViewers = [];
    
    // Auto-initialize all elements with data-multilang attribute
    document.querySelectorAll('[data-multilang]').forEach(element => {
        const sampleName = element.dataset.sample;
        const languages = element.dataset.languages ? 
            element.dataset.languages.split(',') : null;
        
        const viewer = new MultiLangCodeViewer(element.id, sampleName, languages);
        window.codeViewers.push(viewer);
    });
});

// Global function to change all code examples to a specific language
window.changeAllExamplesLanguage = function(lang) {
    if (window.codeViewers) {
        window.codeViewers.forEach(viewer => {
            if (viewer.availableLanguages.includes(lang)) {
                viewer.switchLanguage(lang);
            }
        });
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MultiLangCodeViewer, LANGUAGES };
}

// Apply data-width to width for progress bars (CSP compliant)
function applyDataWidths() {
    document.querySelectorAll('[data-width]').forEach(el => {
        const width = el.getAttribute('data-width');
        if (width) {
            el.style.width = width + '%';
        }
    });
}

// Apply on load and when mutations occur
document.addEventListener('DOMContentLoaded', applyDataWidths);
const widthObserver = new MutationObserver(applyDataWidths);
widthObserver.observe(document.body, { childList: true, subtree: true });
