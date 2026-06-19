/**
 * Módulo de análise inteligente de documentos PDF
 * Extrai texto e identifica tipo, número e assunto do documento
 */
const Parser = (() => {
    // Padrões para identificar tipos de documentos
    const DOCUMENT_PATTERNS = [
        { type: 'Ofício', patterns: [/of[ií]cio/i, /of\.?\s*n[º°]?/i] },
        { type: 'Projeto de Lei', patterns: [/projeto\s+de\s+lei/i, /pl\s*n[º°]?/i, /projeto\s+lei/i] },
        { type: 'Requerimento', patterns: [/requerimento/i, /req\.?\s*n[º°]?/i] },
        { type: 'Indicação', patterns: [/indica[cç][aã]o/i, /indic\.?\s*n[º°]?/i] },
        { type: 'Moção', patterns: [/mo[cç][aã]o/i, /mo[cç][aã]o\s+n[º°]?/i] },
        { type: 'Correspondência', patterns: [/correspond[eê]ncia/i, /corresp\.?\s*n[º°]?/i] },
        { type: 'Tribuna Livre', patterns: [/tribuna\s+livre/i] },
        { type: 'Resposta', patterns: [/resposta/i, /resposta\s+a\s+proposi[cç][aã]o/i] },
        { type: 'Atestado', patterns: [/atestado/i] },
        { type: 'Convite', patterns: [/convite/i] },
        { type: 'Edital', patterns: [/edital/i] },
        { type: 'Parecer', patterns: [/parecer/i] },
        { type: 'Ata', patterns: [/ata\s+n[º°]?/i, /ata\s+da\s+sess[aã]o/i] },
        { type: 'Declaração', patterns: [/declara[cç][aã]o/i] },
        { type: 'Portaria', patterns: [/portaria/i] },
        { type: 'Decreto', patterns: [/decreto/i] },
        { type: 'Memorando', patterns: [/memorando/i, /mem\.?\s*n[º°]?/i] }
    ];

    // Padrão para número do documento (ex: nº 145/2026, n° 52/2026, Nº 123/2024)
    const NUMBER_PATTERN = /n[º°]?\s*\.?\s*(\d+)\s*\/?\s*(\d{4})?/i;

    // Padrões para assunto
    const SUBJECT_PATTERNS = [
        /assunto[s]?[:\s]+([^\n\r]+)/i,
        /ementa[:\s]+([^\n\r]+)/i,
        /objeto[:\s]+([^\n\r]+)/i,
        /ref[.:]\s*([^\n\r]+)/i,
        /referente\s+a[o]?\s+([^\n\r]+)/i,
        /solicita[cç][aã]o\s+de\s+([^\n\r]+)/i,
        /disp[õo]e\s+(sobre\s+)?([^\n\r]+)/i
    ];

    // Palavras-chave para identificar assunto
    const SUBJECT_KEYWORDS = [
        'solicita', 'requer', 'autoriza', 'dispõe', 'regulamenta',
        'institui', 'cria', 'altera', 'revoga', 'concede',
        'nomeia', 'exonera', 'aprova', 'declara', 'reconhece',
        'convoca', 'designa', 'fixa', 'estabelece', 'disciplina'
    ];

    /**
     * Extrai texto de todas as páginas de um PDF
     * @param {Object} pdfDoc - Documento PDF do PDF.js
     * @returns {Promise<string>} - Texto completo extraído
     */
    async function extractText(pdfDoc) {
        if (!pdfDoc) return '';

        let fullText = '';
        const totalPages = pdfDoc.numPages;

        for (let i = 1; i <= Math.min(totalPages, 3); i++) {
            try {
                const page = await pdfDoc.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            } catch (e) {
                console.warn(`Erro ao extrair texto da página ${i}:`, e);
            }
        }

        return fullText.trim();
    }

    /**
     * Identifica o tipo do documento baseado no texto
     * @param {string} text - Texto extraído do PDF
     * @returns {string} - Tipo do documento identificado
     */
    function identifyType(text) {
        if (!text) return 'Documento';

        // Verificar cada padrão
        for (const docType of DOCUMENT_PATTERNS) {
            for (const pattern of docType.patterns) {
                if (pattern.test(text)) {
                    return docType.type;
                }
            }
        }

        // Se não encontrou padrão específico, verificar palavras genéricas
        if (/lei|legisla/i.test(text)) return 'Documento Legislativo';
        if (/administrati|oficial/i.test(text)) return 'Documento Administrativo';
        
        return 'Documento';
    }

    /**
     * Extrai o número do documento
     * @param {string} text - Texto extraído do PDF
     * @returns {string} - Número do documento (ex: "145/2026") ou vazio
     */
    function extractNumber(text) {
        if (!text) return '';

        const match = text.match(NUMBER_PATTERN);
        if (match) {
            const num = match[1];
            const year = match[2] || new Date().getFullYear();
            return `${num}/${year}`;
        }

        // Tentar encontrar padrão alternativo: "Nº 145" ou "n. 145"
        const altMatch = text.match(/(?:n[º°]?|n\.|numero)\s*\.?\s*(\d+)/i);
        if (altMatch) {
            return altMatch[1];
        }

        return '';
    }

    /**
     * Extrai o assunto do documento
     * @param {string} text - Texto extraído do PDF
     * @returns {string} - Assunto do documento
     */
    function extractSubject(text) {
        if (!text) return '';

        // Procurar por padrões de assunto
        for (const pattern of SUBJECT_PATTERNS) {
            const match = text.match(pattern);
            if (match) {
                let subject = match[1] || match[2] || '';
                subject = subject.trim();
                // Limitar tamanho
                if (subject.length > 5 && subject.length < 200) {
                    return capitalizeFirst(subject);
                }
            }
        }

        // Procurar por palavras-chave no início do texto
        const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
        for (const sentence of sentences) {
            for (const keyword of SUBJECT_KEYWORDS) {
                if (sentence.toLowerCase().includes(keyword)) {
                    let subject = sentence.trim();
                    if (subject.length > 200) {
                        subject = subject.substring(0, 197) + '...';
                    }
                    return capitalizeFirst(subject);
                }
            }
        }

        // Se não encontrou, pegar a primeira frase significativa
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length > 15 && trimmed.length < 200) {
                return capitalizeFirst(trimmed);
            }
        }

        return '';
    }

    /**
     * Analisa um documento PDF completo
     * @param {Object} pdfDoc - Documento PDF do PDF.js
     * @returns {Promise<Object>} - { type, number, subject, text }
     */
    async function analyze(pdfDoc) {
        const text = await extractText(pdfDoc);
        
        return {
            type: identifyType(text),
            number: extractNumber(text),
            subject: extractSubject(text),
            text: text.substring(0, 500) // Primeiros 500 caracteres para referência
        };
    }

    /**
     * Capitaliza a primeira letra de uma string
     * @param {string} str 
     * @returns {string}
     */
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    return {
        analyze,
        extractText,
        identifyType,
        extractNumber,
        extractSubject
    };
})();