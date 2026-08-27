/**
 * Prism syntax definition for HudHudScript.
 * Keep first-class language constructs in sync with parser keywords.
 */
(function (Prism) {
    var declarations = [
        'provider', 'agent', 'tool', 'resource', 'mcp', 'action',
        'constitution', 'law', 'rule', 'council', 'swarm', 'community',
        'contract', 'treaty', 'protocol', 'role',
        'subject', 'relation', 'effect', 'compose',
        'loop', 'step', 'gate', 'chain', 'attach',
        'store', 'entity', 'statemachine', 'event',
        'class', 'trait', 'enum'
    ].join('|');

    var modifiers = [
        'public', 'private', 'protected', 'static', 'abstract',
        'extends', 'implements', 'constructor', 'new', 'this', 'self', 'super',
        'has', 'of', 'can', 'uses', 'via', 'on',
        'goal', 'mode', 'once', 'cyclic', 'times', 'until', 'until_converged',
        'when', 'done', 'fail', 'retry', 'escalate', 'next',
        'on_done', 'on_fail', 'combine', 'override', 'before', 'after',
        'correspond', 'separate', 'mandatory', 'advisory', 'optional'
    ].join('|');

    var control = [
        'let', 'const', 'var', 'fn', 'function', 'return',
        'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'match',
        'break', 'continue', 'try', 'catch', 'finally', 'throw',
        'async', 'await', 'promise', 'future', 'yield',
        'use', 'import', 'export', 'from', 'as',
        'spawn', 'despawn', 'send', 'receive', 'require', 'perform',
        'in', 'instanceof', 'typeof'
    ].join('|');

    var turkish = [
        'tanım', 'değişken', 'sabit', 'işlev', 'iş', 'dön',
        'eğer', 'değilse', 'döngü', 'iken', 'herbir', 'içinde',
        'kır', 'çık', 'dur', 'devam', 'dene', 'yakala', 'sonunda', 'fırlat',
        'sınıf', 'yeni', 'bu', 'kendi', 'üst', 'açık', 'özel', 'korumalı',
        'sağlayıcı', 'ajan', 'araç', 'kaynak',
        'anayasa', 'yasa', 'kural', 'konsey', 'sürü', 'topluluk',
        'rol', 'özne', 'ilişki', 'etki', 'birleşim',
        'adım', 'kapı', 'zincir', 'hedef', 'koşul',
        'doğru', 'yanlış', 'boş'
    ].join('|');

    Prism.languages.hudhudscript = {
        'comment': [
            {
                pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
                lookbehind: true,
                greedy: true
            },
            {
                pattern: /(^|[^\\:])\/\/.*/,
                lookbehind: true,
                greedy: true
            }
        ],
        'string': {
            pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
            greedy: true
        },
        'class-name': {
            pattern: RegExp('(\\b(?:' + declarations + '|extends|implements|new)\\s+)[A-Za-z_][\\w]*'),
            lookbehind: true
        },
        'declaration': {
            pattern: RegExp('\\b(?:' + declarations + ')\\b'),
            alias: 'keyword'
        },
        'keyword': RegExp('\\b(?:' + modifiers + '|' + control + '|' + turkish + ')\\b', 'u'),
        'builtin': /\b(?:print|env|Web|tui|tokenomics|get_relation|json|http|file|fs|exec|Temp|Path|Glob|Terminal|Math|Date|Regex)\b/,
        'boolean': /\b(?:true|false|doğru|yanlış)\b/,
        'null': {
            pattern: /\b(?:null|undefined|boş|tanımsız)\b/,
            alias: 'keyword'
        },
        'number': /\b(?:0[xX][\dA-Fa-f]+|0[bB][01]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)\b/,
        'operator': /<->|->|=>|===?|!==?|<=?|>=?|\+\+|--|&&|\|\||[+\-*\/%]=?|[!?~^&|]=?/,
        'punctuation': /[{}[\];(),.:]/
    };

    Prism.languages.hudhud = Prism.languages.hudhudscript;
}(Prism));
