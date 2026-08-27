/**
 * HudHudScript Keywords by Language
 * Used for autocomplete/suggestions in the playground
 */

const HUDHUDSCRIPT_KEYWORDS = {
    'en': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task', 'action',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from',
                   'subject', 'role', 'relation', 'effect', 'state', 'can', 'has', 'uses', 'via',
                   'spawn', 'send', 'receive', 'require', 'perform', 'memory', 'perception',
                   'store', 'remember', 'recall', 'forget', 'embed',
                   'class', 'new', 'this', 'super', 'extends', 'constructor',
                   'enum', 'match', 'try', 'catch', 'throw', 'finally',
                   'entity', 'event', 'on', 'contract', 'treaty'],
        builtins: ['print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'tr': {
        keywords: ['tanım', 'sabit', 'fonksiyon', 'dön', 'eğer', 'yoksa', 'iken', 'için', 'kır', 'devam',
                   'doğru', 'yanlış', 'boş', 'asenkron', 'bekle', 'söz', 'ajan', 'sağlayıcı', 'görev', 'eylem',
                   'anayasa', 'yasa', 'konsey', 'kural', 'sürü', 'topluluk', 'içe_aktar', 'dışa_aktar', 'dan',
                   'özne', 'rol', 'ilişki', 'etki', 'durum', 'yapabilir', 'sahiptir', 'kullanır', 'vasıtasıyla',
                   'oluştur', 'gönder', 'al', 'gerektirir', 'gerçekleştir', 'bellek', 'algı',
                   'depo', 'hatırla', 'anımsa', 'unut', 'göm',
                   'sınıf', 'yeni', 'bu', 'üst', 'türetir', 'kurucu',
                   'sayım', 'eşle', 'dene', 'yakala', 'fırlat', 'sonunda'],
        builtins: ['yaz', 'yazdır', 'çıktı', 'uzunluk', 'ekle', 'çıkar', 'eşle', 'filtrele', 'azalt', 'herBiri', 'bul', 'bazı', 'hepsi']
    },
    'ja': {
        keywords: ['れっと', 'こんすと', 'ふぁんくしょん', 'りたーん', 'いふ', 'えるせ', 'わいる', 'ふぉー', 'ぶれーく', 'こんてぃにゅー',
                   'とぅるー', 'ふぁるせ', 'ぬる', 'あしんく', 'あうぇいと', 'ぷろみせ', 'えーじぇんと', 'ぷろばいだー', 'たすく',
                   'けんぽう', 'ほうりつ', 'かいぎ', 'るーる', 'すうぉーむ', 'こみゅにてぃ', 'いんぽーと', 'えくすぽーと', 'ふろむ'],
        builtins: ['ぷりんと', 'かく', 'ひょうじ', '書く', '表示', 'れん', 'ぷっしゅ', 'ぽっぷ', 'まっぷ', 'ふぃるたー', 'りでゅーす']
    },
    'ar': {
        keywords: ['دع', 'ثابت', 'دالة', 'ارجع', 'اذا', 'والا', 'بينما', 'لكل', 'اكسر', 'استمر',
                   'صحيح', 'خطأ', 'فارغ', 'غير_متزامن', 'انتظر', 'وعد', 'وكيل', 'مزود', 'مهمة',
                   'دستور', 'قانون', 'مجلس', 'قاعدة', 'سرب', 'مجتمع', 'استيراد', 'تصدير', 'من'],
        builtins: ['اطبع', 'طول', 'ادفع', 'اسحب', 'خريطة', 'فلتر', 'قلل', 'لكل_عنصر', 'ابحث', 'بعض', 'الكل']
    },
    'bn': {
        keywords: ['ধরি', 'ধ্রুবক', 'ফাংশন', 'ফেরত', 'যদি', 'নাহলে', 'যতক্ষণ', 'প্রতিটির_জন্য', 'ভাঙো', 'চালিয়ে_যাও',
                   'সত্য', 'মিথ্যা', 'শূন্য', 'অসমলয়', 'অপেক্ষা', 'প্রতিশ্রুতি', 'এজেন্ট', 'প্রদানকারী', 'কাজ',
                   'সংবিধান', 'আইন', 'পরিষদ', 'নিয়ম', 'ঝাঁক', 'সম্প্রদায়', 'আমদানি', 'রপ্তানি', 'থেকে'],
        builtins: ['প্রিন্ট', 'দৈর্ঘ্য', 'যোগ', 'সরাও', 'ম্যাপ', 'ফিল্টার', 'হ্রাস', 'প্রতিটি', 'খুঁজুন', 'কিছু', 'সব']
    },
    'ru': {
        keywords: ['пусть', 'константа', 'функция', 'вернуть', 'если', 'иначе', 'пока', 'для', 'прервать', 'продолжить',
                   'истина', 'ложь', 'нуль', 'асинхронный', 'ждать', 'обещание', 'агент', 'провайдер', 'задача',
                   'конституция', 'закон', 'совет', 'правило', 'рой', 'сообщество', 'импорт', 'экспорт', 'из'],
        builtins: ['печать', 'длина', 'добавить', 'удалить', 'карта', 'фильтр', 'свернуть', 'для_каждого', 'найти', 'некоторые', 'все']
    },
    'es': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['imprimir', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'de': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['drucken', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'fr': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['imprimer', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'it': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['stampare', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'pt': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['imprimir', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'zh': {
        keywords: ['让', '常量', '函数', '返回', '如果', '否则', '当', '对于', '中断', '继续',
                   '真', '假', '空', '异步', '等待', '承诺', '代理', '提供者', '任务',
                   '宪法', '法律', '理事会', '规则', '群', '社区', '导入', '导出', '从'],
        builtins: ['打印', '长度', '推入', '弹出', '映射', '过滤', '归约', '每个', '查找', '某些', '全部']
    },
    'hi': {
        keywords: ['मान', 'स्थिर', 'फ़ंक्शन', 'वापसी', 'अगर', 'नहीं_तो', 'जबकि', 'प्रत्येक_के_लिए', 'तोड़ो', 'जारी_रखें',
                   'सत्य', 'असत्य', 'शून्य', 'async', 'प्रतीक्षा', 'वादा', 'एजेंट', 'प्रदाता', 'कार्य',
                   'संविधान', 'कानून', 'परिषद', 'नियम', 'झुंड', 'समुदाय', 'आयात', 'निर्यात', 'से'],
        builtins: ['प्रिंट', 'लंबाई', 'जोड़ें', 'हटाएं', 'मैप', 'फ़िल्टर', 'कम_करें', 'प्रत्येक', 'खोजें', 'कुछ', 'सभी']
    },
    'id': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['cetak', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'vi': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['in', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'el': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['εκτύπωση', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'pl': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['drukuj', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'th': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['พิมพ์', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'bs': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['štampaj', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'hr': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['ispiši', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'sr': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['штампај', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    },
    'fa': {
        keywords: ['بگذار', 'ثابت', 'تابع', 'برگشت', 'اگر', 'وگرنه', 'تا_زمانی_که', 'برای', 'شکستن', 'ادامه',
                   'درست', 'نادرست', 'تهی', 'ناهمزمان', 'انتظار', 'وعده', 'عامل', 'ارائه_دهنده', 'وظیفه',
                   'قانون_اساسی', 'قانون', 'شورا', 'قاعده', 'ازدحام', 'جامعه', 'وارد_کردن', 'صادر_کردن', 'از'],
        builtins: ['چاپ', 'طول', 'فشار', 'بیرون_کشیدن', 'نقشه', 'فیلتر', 'کاهش', 'برای_هر', 'یافتن', 'برخی', 'همه']
    },
    'ku': {
        keywords: ['let', 'const', 'function', 'return', 'if', 'else', 'while', 'for', 'break', 'continue',
                   'true', 'false', 'null', 'async', 'await', 'promise', 'agent', 'provider', 'task',
                   'constitution', 'law', 'council', 'rule', 'swarm', 'community', 'import', 'export', 'from'],
        builtins: ['çap', 'print', 'out', 'len', 'push', 'pop', 'map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every']
    }
};

/**
 * Detect language from shebang line
 * @param {string} code - The code to analyze
 * @returns {string|null} - Language code or null
 */
function detectLanguageFromShebang(code) {
    const firstLine = code.split('\n')[0];
    const shebangMatch = firstLine.match(/^#!.*lang=(\w+)/);
    return shebangMatch ? shebangMatch[1] : null;
}

/**
 * Get keywords for a specific language
 * @param {string} lang - Language code
 * @returns {Array} - Array of keywords and builtins
 */
function getKeywordsForLanguage(lang) {
    const langData = HUDHUDSCRIPT_KEYWORDS[lang] || HUDHUDSCRIPT_KEYWORDS['en'];
    return [...langData.keywords, ...langData.builtins];
}

/**
 * Get keyword hints for autocomplete
 * @param {string} lang - Language code
 * @param {string} prefix - Current word prefix
 * @returns {Array} - Array of matching keywords
 */
function getKeywordHints(lang, prefix) {
    const keywords = getKeywordsForLanguage(lang);
    if (!prefix) return keywords;
    
    const lowerPrefix = prefix.toLowerCase();
    return keywords.filter(kw => kw.toLowerCase().startsWith(lowerPrefix));
}
