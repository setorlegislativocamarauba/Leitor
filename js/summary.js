/**
 * Módulo de resumo da sessão
 */
const Summary = (() => {
    /**
     * Gera o resumo completo de todos os documentos
     * @param {Array} documents - Lista de documentos
     * @returns {Array} - Dados de todos os documentos
     */
    function generateDocSummary(documents) {
        return documents.map((doc, index) => {
            const docId = doc.name;
            const description = Storage.getDescription(docId);
            const requests = Storage.getRequests(docId) || [];
            
            const councilors = requests.map(id => {
                const c = COUNCILORS.find(c => c.id === id);
                return c ? c.name : 'Desconhecido';
            });

            // Criar object URL para o arquivo, se disponível
            let fileUrl = '';
            if (doc.file) {
                try {
                    fileUrl = URL.createObjectURL(doc.file);
                } catch (e) {}
            }

            return {
                docName: docId,
                description: description,
                pageCount: doc.pageCount || 0,
                fileUrl: fileUrl,
                count: requests.length,
                councilors: councilors,
                hasRequests: requests.length > 0
            };
        });
    }

    /**
     * Gera o resumo por vereador (apenas documentos com solicitações)
     * @param {Array} documents - Lista de documentos
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

            if (requests.length > 0) {
                requests.forEach(councilorId => {
                    if (councilorDocs[councilorId]) {
                        councilorDocs[councilorId].documents.push({
                            docName: docId,
                            display: docId
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
     * Renderiza o resumo no modal
     * @param {Array} documents - Lista de documentos
     * @param {string} sessionDate - Data da sessão (dd/mm/aaaa)
     */
    function render(documents, sessionDate) {
        const docSummary = generateDocSummary(documents);
        const councilorSummary = generateCouncilorSummary(documents);
        const container = document.getElementById('summaryBody');

        // Atualizar título do modal com a data
        const titleEl = document.querySelector('.modal-header h2');
        if (titleEl) {
            titleEl.textContent = `Expediente da Sessão - ${sessionDate}`;
        }

        // Tabs navigation
        let html = `
            <div class="summary-tabs">
                <button class="summary-tab active" data-tab="docs">Documentos Lidos</button>
                <button class="summary-tab" data-tab="requests">Solicitações de Cópia</button>
            </div>
        `;

        // === TAB 1: TODOS OS DOCUMENTOS ===
        html += `<div class="summary-tab-content" id="tabDocs">`;
        html += `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Nº</th>
                        <th>Documento</th>
                        <th>Descrição</th>
                        <th>Páginas</th>
                    </tr>
                </thead>
                <tbody>
        `;

        docSummary.forEach((item, index) => {
            const pageCount = item.pageCount > 0 ? item.pageCount : '-';
            html += `
                <tr>
                    <td class="doc-num">${index + 1}</td>
                    <td class="doc-name">
                        ${item.fileUrl 
                            ? `<a href="#" class="doc-link" data-docname="${escapeHtml(item.docName)}">${escapeHtml(item.docName)}</a>`
                            : escapeHtml(item.docName)}
                    </td>
                    <td class="doc-description">${escapeHtml(item.description) || '-'}</td>
                    <td class="doc-pages">${pageCount}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Total de documentos lidos:</strong> ${docSummary.length}</td>
                        <td></td>
                        <td class="doc-pages"><strong>${docSummary.reduce((sum, d) => sum + (d.pageCount || 0), 0)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
        html += `</div>`;

        // === TAB 2: SOLICITAÇÕES DE CÓPIA ===
        html += `<div class="summary-tab-content" id="tabRequests" style="display:none;">`;

        const docsWithRequests = docSummary.filter(d => d.hasRequests);

        if (docsWithRequests.length === 0) {
            html += `
                <div class="summary-empty">
                    <span class="icon">📋</span>
                    <p>Nenhuma solicitação de cópia registrada nesta sessão.</p>
                </div>
            `;
        } else {
            // Tabela por documento
            html += `
                <h3 style="margin-bottom:12px;font-size:1rem;">Por Documento</h3>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Descrição</th>
                            <th>Solicitações</th>
                            <th>Vereadores</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            docsWithRequests.forEach(item => {
                html += `
                    <tr>
                        <td class="doc-name">
                            ${item.fileUrl 
                                ? `<a href="#" class="doc-link" data-docname="${escapeHtml(item.docName)}">${escapeHtml(item.docName)}</a>`
                                : escapeHtml(item.docName)}
                        </td>
                        <td class="doc-description">${escapeHtml(item.description) || '-'}</td>
                        <td class="doc-count">${item.count}</td>
                        <td class="doc-councilors">${escapeHtml(item.councilors.join(', '))}</td>
                    </tr>
                `;
            });

            const totalRequests = docsWithRequests.reduce((sum, item) => sum + item.count, 0);
            html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Total:</strong> ${docsWithRequests.length} documentos</td>
                            <td></td>
                            <td class="doc-count"><strong>${totalRequests}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            `;

            // Por vereador
            if (councilorSummary.length > 0) {
                html += `<h3 style="margin:20px 0 12px;font-size:1rem;">Por Vereador</h3>`;
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
            }
        }

        html += `</div>`;
        container.innerHTML = html;

        // Event listeners for document links
        container.querySelectorAll('.doc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const docName = link.dataset.docname;
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
                container.querySelectorAll('.summary-tab-content').forEach(c => c.style.display = 'none');
                document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).style.display = 'block';
            });
        });
    }

    /**
     * Abre o modal de resumo
     * @param {Array} documents - Lista de documentos
     * @param {string} sessionDate - Data da sessão (dd/mm/aaaa)
     */
    function open(documents, sessionDate) {
        render(documents, sessionDate);
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