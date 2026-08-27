/**
 * Lazy Loading for Examples
 * Load code examples on-demand when user expands a section
 * TRUE LAZY LOADING: Code is not in DOM until section is expanded
 */

class LazyExampleLoader {
    constructor() {
        this.loadedExamples = new Set();
        this.currentLang = this.detectLanguage();
        this.init();
    }
    
    detectLanguage() {
        const savedLang = localStorage.getItem('hudhudscript_language');
        if (savedLang) return savedLang;
        
        if (window.SITE_LANGUAGE) return window.SITE_LANGUAGE;
        
        const browserLang = navigator.language || navigator.userLanguage;
        return browserLang.split('-')[0] || 'en';
    }
    
    init() {
        // Find all collapsible example sections
        const sections = document.querySelectorAll('[data-example-section]');
        
        sections.forEach(section => {
            const header = section.querySelector('[data-example-header]');
            const content = section.querySelector('[data-example-content]');
            const sampleId = section.dataset.exampleSection;
            
            if (!header || !content) return;
            
            // Store original content template
            const originalHTML = content.innerHTML;
            section.dataset.contentTemplate = originalHTML;
            
            // Clear content initially (TRUE lazy loading)
            content.innerHTML = '';
            content.classList.add('hidden');
            section.dataset.expanded = 'false';
            
            // Add click handler
            header.addEventListener('click', () => {
                this.toggleSection(section, sampleId, content);
            });
            
            // Add keyboard support
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleSection(section, sampleId, content);
                }
            });
        });
        
        // Auto-expand first example (Basic Example)
        if (sections.length > 0) {
            const firstSection = sections[0];
            const firstContent = firstSection.querySelector('[data-example-content]');
            const firstSampleId = firstSection.dataset.exampleSection;
            this.expandSection(firstSection, firstSampleId, firstContent);
        }
    }
    
    toggleSection(section, sampleId, content) {
        const isExpanded = section.dataset.expanded === 'true';
        
        if (isExpanded) {
            this.collapseSection(section, content);
        } else {
            this.expandSection(section, sampleId, content);
        }
    }
    
    collapseSection(section, content) {
        content.classList.add('hidden');
        section.dataset.expanded = 'false';
        
        const icon = section.querySelector('[data-expand-icon]');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    }
    
    async expandSection(section, sampleId, content) {
        content.classList.remove('hidden');
        section.dataset.expanded = 'true';
        
        const icon = section.querySelector('[data-expand-icon]');
        if (icon) {
            icon.style.transform = 'rotate(90deg)';
        }
        
        // Load content if not already loaded
        if (!this.loadedExamples.has(sampleId)) {
            await this.loadExample(sampleId, section, content);
            this.loadedExamples.add(sampleId);
        }

        // Notify page that a lazy section was expanded (for re-init of tabs, tree views, etc.)
        if (window.onLazySectionExpanded) {
            window.onLazySectionExpanded(sampleId);
        }
    }
    
    async loadExample(sampleId, section, container) {
        // Show loading indicator
        container.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span class="ml-3 text-gray-600">Loading example...</span>
            </div>
        `;
        
        try {
            // Get original content template
            const template = section.dataset.contentTemplate;
            
            if (!template) {
                container.innerHTML = '<p class="text-gray-500">No content template found.</p>';
                return;
            }
            
            // Restore original HTML structure
            container.innerHTML = template;
            
            // Small delay to ensure DOM is ready
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Find all multilang viewers in this container
            const viewers = container.querySelectorAll('[data-multilang]');
            
            if (viewers.length === 0) {
                console.warn(`No multilang viewers found in section ${sampleId}`);
                return;
            }
            
            // Initialize each viewer
            for (const viewer of viewers) {
                const viewerId = viewer.id;
                const sampleName = viewer.dataset.sample;
                
                if (!viewerId || !sampleName) {
                    console.warn(`Missing id or sample name for viewer in ${sampleId}`);
                    continue;
                }
                
                // Create MultiLangCodeViewer instance
                // This will trigger the actual code loading via AJAX
                new MultiLangCodeViewer(viewerId, sampleName);
            }
            
        } catch (error) {
            console.error(`Failed to load example ${sampleId}:`, error);
            var errDiv = document.createElement('div');
            errDiv.className = 'bg-red-50 border border-red-200 rounded-lg p-4';
            var errP = document.createElement('p');
            errP.className = 'text-red-600';
            errP.textContent = 'Failed to load example: ' + error.message;
            var reloadBtn = document.createElement('button');
            reloadBtn.className = 'mt-2 text-sm text-red-700 underline';
            reloadBtn.setAttribute('data-action', 'reload-page');
            reloadBtn.textContent = 'Reload page';
            errDiv.appendChild(errP);
            errDiv.appendChild(reloadBtn);
            container.innerHTML = '';
            container.appendChild(errDiv);
        }
    }
    
    // Update language for all loaded examples
    updateLanguage(newLang) {
        this.currentLang = newLang;
        localStorage.setItem('hudhudscript_language', newLang);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.lazyExampleLoader = new LazyExampleLoader();
});

// Export for use in other scripts
window.LazyExampleLoader = LazyExampleLoader;
