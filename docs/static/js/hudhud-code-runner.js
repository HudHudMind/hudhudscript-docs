/**
 * HudHudScript Universal Code Runner
 * Provides check/compile/run functionality for all code blocks across the site.
 *
 * Usage:
 *   Option A – inline code (homepage, docs with hardcoded blocks):
 *     <div class="hudhud-code-block" data-lang="en">
 *       <pre><code class="language-hudhudscript">...</code></pre>
 *     </div>
 *
 *   Option B – file-backed code (samples from .hudhud files):
 *     <div class="hudhud-code-block" data-lang="en" data-file="homepage/en.hudhud">
 *       <pre><code class="language-hudhudscript">...</code></pre>
 *     </div>
 *
 * The component auto-initialises on DOMContentLoaded and injects action buttons
 * + output areas into every .hudhud-code-block it finds.
 */

(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                            */
    /* ------------------------------------------------------------------ */

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    /* ------------------------------------------------------------------ */
    /*  Run / Check / Compile via API                                      */
    /* ------------------------------------------------------------------ */

    async function executeCode(code, action, lang, file, context) {
        var payload = { code: code, action: action };
        if (lang) payload.language = lang;
        if (file) payload.file_name = file;
        if (context) payload.context = context;
        if (window.CSRF_TOKEN) payload.csrf_token = window.CSRF_TOKEN;
        
        // Get HMAC nonce first (prevents curl abuse)
        try {
            var nonceResp = await fetch('/api/run-nonce?action=' + encodeURIComponent(action));
            var nonceData = await nonceResp.json();
            if (nonceData.success && nonceData.nonce) {
                payload._nonce = nonceData.nonce;
            }
        } catch (e) {
            // Nonce fetch failed — request will be rejected if required
        }
        
        var response = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.CSRF_TOKEN || '' },
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    /* ------------------------------------------------------------------ */
    /*  UI helpers                                                         */
    /* ------------------------------------------------------------------ */

    function setLoading(outputEl, action) {
        var label = action === 'check' ? 'Checking' : action === 'compile' ? 'Compiling' : action === 'run_compiled' ? 'Compiling & Running' : 'Running';
        outputEl.className = 'hudhud-output show';
        outputEl.textContent = '';
        var spinner = document.createElement('span');
        spinner.className = 'hudhud-spinner';
        outputEl.appendChild(spinner);
        outputEl.appendChild(document.createTextNode(' ' + label + '...'));
    }

    function showResult(outputEl, data, action, code) {
        if (data.success) {
            outputEl.className = 'hudhud-output show success';
            var output = '';
            if (data.output && data.output.trim()) {
                output = data.output;
            } else if (action === 'check') {
                output = 'Syntax is valid';
            } else if (action === 'compile') {
                output = 'Compiled successfully';
            } else {
                output = 'Executed successfully (no output)';
            }
            if (data.execution_time_ms !== undefined) {
                output += '\n⏱ ' + data.execution_time_ms + 'ms (toplam, başlatma dahil)';
            }
            outputEl.textContent = output;
        } else {
            outputEl.className = 'hudhud-output show error';
            var msg = (data.error_type || 'Error') + '\n' + (data.error || 'Unknown error');
            if (data.line) {
                msg += '\nLine ' + data.line + (data.column ? ', Column ' + data.column : '');
            }
            outputEl.textContent = msg;

            // Add Report Error button
            var reportBtn = document.createElement('button');
            reportBtn.className = 'hudhud-report-btn';
            reportBtn.textContent = 'Report Error';
            reportBtn.addEventListener('click', function () {
                var block = outputEl.closest('.hudhud-code-block');
                var context = 'unknown';
                var pathname = window.location.pathname;
                if (pathname.indexOf('/playground') === 0) context = 'playground';
                else if (pathname.indexOf('/docs') === 0) context = 'docs';
                else if (pathname.indexOf('/examples') === 0) context = 'samples';
                else if (pathname === '/') context = 'homepage';

                fetch('/api/report-error', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: action,
                        error: msg,
                        language: block ? (block.dataset.lang || '') : '',
                        file_name: block ? (block.dataset.file || '') : '',
                        page_url: pathname,
                        context: context
                    })
                }).then(function () {
                    reportBtn.textContent = 'Error reported, thank you!';
                    reportBtn.disabled = true;
                }).catch(function () {
                    reportBtn.textContent = 'Error reported, thank you!';
                    reportBtn.disabled = true;
                });
            });
            outputEl.appendChild(reportBtn);
        }
    }

    function showError(outputEl, err) {
        outputEl.className = 'hudhud-output show error';
        outputEl.textContent = 'Network Error: ' + err.message;
    }

    /* ------------------------------------------------------------------ */
    /*  Build action bar + output for a single block                       */
    /* ------------------------------------------------------------------ */

    function initBlock(block) {
        if (block.dataset.hudInit) return;  // already initialised
        block.dataset.hudInit = '1';

        var codeEl = block.querySelector('code');
        if (!codeEl) return;

        // --- action bar ---
        var bar = document.createElement('div');
        bar.className = 'hudhud-action-bar';

        // Allow blocks to specify which actions to show via data-actions="check,compile"
        var allowedActions = block.dataset.actions
            ? block.dataset.actions.split(',').map(function(s) { return s.trim(); })
            : ['check', 'run'];

        var tooltips = {
            check: 'Check syntax without running',
            compile: 'Compile to bytecode (.hudb)',
            run: 'Run with interpreter',
            run_compiled: 'Compile to bytecode, then run with VM'
        };

        allowedActions.forEach(function (action) {
            var btn = document.createElement('button');
            btn.className = 'hudhud-btn hudhud-btn-' + action;
            btn.textContent = action === 'check' ? 'Check' : action === 'compile' ? 'Compile' : action === 'run' ? 'Run' : 'Run Compiled';
            btn.title = tooltips[action] || '';
            btn.addEventListener('click', function () { handleAction(block, action); });
            bar.appendChild(btn);
        });

        // copy button
        var copyBtn = document.createElement('button');
        copyBtn.className = 'hudhud-btn hudhud-btn-copy';
        copyBtn.textContent = 'Copy';
        copyBtn.title = 'Copy code to clipboard';
        copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(codeEl.textContent).then(function () {
                copyBtn.textContent = 'Copied!';
                setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
            });
        });
        bar.appendChild(copyBtn);

        // --- output area ---
        var outputEl = document.createElement('div');
        outputEl.className = 'hudhud-output';

        // close button in output
        var closeBtn = document.createElement('button');
        closeBtn.className = 'hudhud-output-close';
        closeBtn.textContent = '\u2715';
        closeBtn.addEventListener('click', function () {
            outputEl.className = 'hudhud-output';
            outputEl.textContent = '';
        });

        // insert after the code block
        var pre = block.querySelector('pre');
        if (pre && pre.nextSibling) {
            block.insertBefore(bar, pre.nextSibling);
        } else {
            block.appendChild(bar);
        }
        block.appendChild(outputEl);

        // Store references
        block._hudOutput = outputEl;
        block._hudCloseBtn = closeBtn;
    }

    async function handleAction(block, action) {
        var codeEl = block.querySelector('code');
        var outputEl = block._hudOutput;
        var buttons = block.querySelectorAll('.hudhud-btn');
        var lang = block.dataset.lang || (window.SITE_LANGUAGE || 'en');
        var file = block.dataset.file || '';
        var pathname = window.location.pathname;
        var context = 'unknown';
        if (pathname.indexOf('/playground') === 0) context = 'playground';
        else if (pathname.indexOf('/docs') === 0) context = 'docs';
        else if (pathname.indexOf('/examples') === 0) context = 'samples';
        else if (pathname === '/') context = 'homepage';

        buttons.forEach(function (b) { b.disabled = true; });
        setLoading(outputEl, action);

        try {
            var data = await executeCode(codeEl.textContent, action, lang, file, context);
            showResult(outputEl, data, action, codeEl.textContent);
        } catch (err) {
            showError(outputEl, err);
        } finally {
            buttons.forEach(function (b) { b.disabled = false; });
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Auto-upgrade: wrap bare <pre><code class="language-hudhudscript">  */
    /*  blocks that are NOT already inside .hudhud-code-block              */
    /* ------------------------------------------------------------------ */

    function autoUpgrade() {
        document.querySelectorAll('pre > code.language-hudhudscript').forEach(function (codeEl) {
            var pre = codeEl.parentElement;
            // Skip if already inside a hudhud-code-block
            if (pre.closest('.hudhud-code-block')) return;
            // Skip if inside .no-runner (opt-out)
            if (pre.closest('.no-runner')) return;
            // Skip if inside .interactive-code-block (old macro already has buttons)
            if (pre.closest('.interactive-code-block')) return;

            // Wrap the <pre> in a .hudhud-code-block div
            var wrapper = document.createElement('div');
            wrapper.className = 'hudhud-code-block';
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
        });
    }

    /* ------------------------------------------------------------------ */
    /*  Auto-init on DOM ready                                             */
    /* ------------------------------------------------------------------ */

    function initAll() {
        autoUpgrade();
        document.querySelectorAll('.hudhud-code-block').forEach(initBlock);
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    // Expose for dynamic content (SPA-like pages, lazy loaded docs)
    window.HudHudCodeRunner = {
        init: initAll,
        initBlock: initBlock
    };
})();
