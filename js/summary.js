/**
 * Módulo de resumo da sessão
 */
const Summary = (() => {
    /**
     * Gera o resumo por documento
     * @param {Array} documents - Lista de documentos com metadados
     * @returns {Object} - Dados do resumo por documento
     */
    function generateDocSummary(documents) {
        const allRequests = Storage.getAllRequests();
        const summary = [];

        documents.forEach(doc => {
            const docId = doc.name;
            const requests = allRequests[docId] || [];
            const meta = doc.metadata || {};
            
            const councilors = requests.map(id => {
                const c = COUNCILORS.find(c => c.id === id);
                return c ? c.name : 'Desconhecido';
            });

            if (requests.length > 0) {
                // Criar object URL para o arquivo, se disponível
                let fileUrl = '';
                if (doc.file) {
                    fileUrl = URL.createObjectURL(doc.file);
                }
                summary.push({
                    docName: docId,
                    docType: meta.type || '',
                    docNumber: meta.number || '',
                    docSubject: meta.subject || '',
                    fileUrl: fileUrl,
                    count: requests.length,
                    councilors: councilors
                });
            }
        });

        return summary;
    }

    /**
     * Gera o resumo por vereador
     * @param {Array} documents - Lista de documentos com metadados
     * @returns {Array} - Dados do resumo por vereador
     */
    function generateCouncilorSummary(documents) {
        const allRequests = Storage.getAllRequests();
        const councilorDocs = {};

        // Inicializar estrutura para cada vereador
        COUNCILORS.forEach(c => {
            councilorDocs[c.id] = {
                name: c.name,
                initials: c.initials,
                documents: []
            };
        });

        // Agrupar documentos por vereador
        documents.forEach(doc => {
            const docId = doc.name;
            const requests = allRequests[docId] || [];
            const meta = doc.metadata || {};

            if (requests.length > 0) {
                const docDisplay = formatDocDisplay(meta, docId);
                
                requests.forEach(councilorId => {
                    if (councilorDocs[councilorId]) {
                        councilorDocs[councilorId].documents.push({
                            docName: docId,
                            display: docDisplay,
                            type: meta.type || 'Documento',
                            number: meta.number || '',
                            subject: meta.subject || ''
                        });
                    }
                });
            }
        });

        // Filtrar apenas vereadores com solicitações e ordenar
        return Object.values(councilorDocs)
            .filter(c => c.documents.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    /**
     * Formata a exibição do documento com tipo e número
     */
    function formatDocDisplay(meta, fallback) {
        if (meta.type && meta.type !== 'Documento' && meta.number) {
            return `${meta.type} nº ${meta.number}`;
        }
        if (meta.type && meta.type !== 'Documento') {
            return `${meta.type} - ${meta.number || fallback}`;
        }
        if (meta.number) {
            return `Documento nº ${meta.number}`;
        }
        return fallback;
    }

    /**
     * Renderiza o resumo no modal
     * @param {Array} documents - Lista de documentos
     */
    function render(documents) {
        const docSummary = generateDocSummary(documents);
        const councilorSummary = generateCouncilorSummary(documents);
        const container = document.getElementById('summaryBody');

        if (docSummary.length === 0) {
            container.innerHTML = `
                <div class="summary-empty">
                    <span class="icon">📋</span>
                    <p>Nenhuma solicitação registrada nesta sessão.</p>
                </div>
            `;
            return;
        }

        // Tabs navigation
        let html = `
            <div class="summary-tabs">
                <button class="summary-tab active" data-tab="docs">Por Documento</button>
                <button class="summary-tab" data-tab="councilors">Por Vereador</button>
            </div>
            <div class="summary-tab-content" id="tabDocs">
        `;

        // Tabela por documento
        html += `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Documento</th>
                        <th>Solicitações</th>
                        <th>Vereadores</th>
                    </tr>
                </thead>
                <tbody>
        `;

        docSummary.forEach(item => {
            html += `
                <tr>
                    <td class="doc-name">
                        <a href="#" class="doc-link" data-docname="${escapeHtml(item.docName)}">${escapeHtml(item.docName)}</a>
                    </td>
                    <td class="doc-count">${item.count}</td>
                    <td class="doc-councilors">${escapeHtml(item.councilors.join(', '))}</td>
                </tr>
            `;
        });

        const totalRequests = docSummary.reduce((sum, item) => sum + item.count, 0);
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>Total de documentos com solicitações:</strong> ${docSummary.length}</td>
                        <td class="doc-count"><strong>${totalRequests}</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        `;

        html += `</div><div class="summary-tab-content" id="tabCouncilors" style="display:none;">`;

        // Tabela por vereador
        if (councilorSummary.length > 0) {
            html += `<div class="councilor-summary">`;
            councilorSummary.forEach(c => {
                html += `
                    <div class="councilor-block">
                        <div class="councilor-block-header">
                            <span class="councilor-avatar">${c.initials}</span>
                            <span class="councilor-name">${escapeHtml(c.name)}</span>
                            <span class="councilor-count">${c.documents.length} documento(s)</span>
                        </div>
                        <ul class="councilor-docs-list">
                `;
                c.documents.forEach(doc => {
                    html += `
                        <li class="councilor-doc-item">
                            <span class="doc-indicator has-requests"></span>
                            <span class="doc-display">${escapeHtml(doc.display)}</span>
                        </li>
                    `;
                });
                html += `
                        </ul>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<p class="summary-empty">Nenhum dado disponível.</p>`;
        }

        html += `</div>`;
        container.innerHTML = html;

        // Event listeners for document links
        container.querySelectorAll('.doc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const docName = link.dataset.docname;
                // Buscar o item correspondente no docSummary
                const item = docSummary.find(d => d.docName === docName);
                if (item && item.fileUrl) {
                    window.open(item.fileUrl, '_blank');
                }
            });
        });

        // Tab switching
        container.querySelectorAll('.summary-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.summary-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabId = tab.dataset.tab;
                document.getElementById('tabDocs').style.display = tabId === 'docs' ? 'block' : 'none';
                document.getElementById('tabCouncilors').style.display = tabId === 'councilors' ? 'block' : 'none';
            });
        });
    }

    /**
     * Abre o modal de resumo
     * @param {Array} documents - Lista de documentos
     */
    function open(documents) {
        render(documents);
        document.getElementById('summaryModal').style.display = 'flex';
    }

    /**
     * Fecha o modal de resumo
     */
    function close() {
        document.getElementById('summaryModal').style.display = 'none';
    }

    /**
     * Escapa HTML para evitar XSS
     * @param {string} text 
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        generateDocSummary,
        generateCouncilorSummary,
        render,
        open,
        close
    };
})();