/**
 * Módulo principal - orquestra todos os componentes da aplicação
 */
const App = (() => {
    // Estado da aplicação
    let documents = [];
    let currentIndex = 0;
    let currentDocId = null;

    // Elementos DOM
    const els = {};

    /**
     * Inicializa a aplicação
     */
    function init() {
        // Cache de elementos DOM
        els.folderSection = document.getElementById('folderSection');
        els.viewerSection = document.getElementById('viewerSection');
        els.folderInput = document.getElementById('folderInput');
        els.folderStatus = document.getElementById('folderStatus');
        els.councilorsGrid = document.getElementById('councilorsGrid');
        els.pdfViewer = document.getElementById('pdfViewer');
        els.currentDoc = document.getElementById('currentDoc');
        els.totalDocs = document.getElementById('totalDocs');
        els.documentName = document.getElementById('documentName');
        els.requestsList = document.getElementById('requestsList');
        els.btnPrev = document.getElementById('btnPrev');
        els.btnNext = document.getElementById('btnNext');
        els.btnSummary = document.getElementById('btnSummary');
        els.btnExportExcel = document.getElementById('btnExportExcel');
        els.btnExportPDF = document.getElementById('btnExportPDF');
        els.toggleCouncilors = document.getElementById('toggleCouncilors');
        els.closeSummary = document.getElementById('closeSummary');
        els.btnExportExcelFromSummary = document.getElementById('btnExportExcelFromSummary');
        els.btnExportPDFFromSummary = document.getElementById('btnExportPDFFromSummary');
        els.sidebar = document.getElementById('sidebar');
        els.sidebarList = document.getElementById('sidebarList');
        els.searchDocs = document.getElementById('searchDocs');
        els.btnToggleSidebar = document.getElementById('btnToggleSidebar');
        els.btnOpenSidebar = document.getElementById('btnOpenSidebar');
        
        // Inicializar módulos
        Storage.init();
        PdfViewer.init();

        // Configurar eventos
        setupEvents();

        // Renderizar vereadores
        renderCouncilors();
    }

    /**
     * Configura todos os eventos da aplicação
     */
    function setupEvents() {
        // Seleção de pasta
        els.folderInput.addEventListener('change', handleFolderSelect);

        // Navegação
        els.btnPrev.addEventListener('click', () => navigate(-1));
        els.btnNext.addEventListener('click', () => navigate(1));

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
            if (e.key === 'Escape') {
                Summary.close();
                closeSidebar();
            }
        });

        // Toque - swipe
        let touchStartX = 0;
        let touchEndX = 0;
        els.pdfViewer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        els.pdfViewer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        function handleSwipe() {
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) navigate(1);
                else navigate(-1);
            }
        }

        // Councilors toggle
        els.toggleCouncilors.addEventListener('click', toggleCouncilors);
        document.querySelector('.councilors-header').addEventListener('click', toggleCouncilors);

        // Summary
        els.btnSummary.addEventListener('click', () => Summary.open(documents));
        els.closeSummary.addEventListener('click', Summary.close);
        document.querySelector('.modal-backdrop').addEventListener('click', Summary.close);

        // Export
        els.btnExportExcel.addEventListener('click', () => Export.exportExcel(documents));
        els.btnExportPDF.addEventListener('click', () => Export.exportPDF(documents));
        els.btnExportExcelFromSummary.addEventListener('click', () => {
            Export.exportExcel(documents);
        });
        els.btnExportPDFFromSummary.addEventListener('click', () => {
            Export.exportPDF(documents);
        });

        // Sidebar
        els.btnOpenSidebar.addEventListener('click', openSidebar);
        els.btnToggleSidebar.addEventListener('click', closeSidebar);
        
        // Search with debounce
        let searchTimeout;
        els.searchDocs.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderSidebarList();
            }, 200);
        });

        // Redimensionamento
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => PdfViewer.resize(), 300);
        });
    }

    /**
     * Renderiza os botões dos vereadores
     */
    function renderCouncilors() {
        els.councilorsGrid.innerHTML = COUNCILORS.map(c => `
            <button class="councilor-btn" data-id="${c.id}">
                <span class="councilor-avatar">${c.initials}</span>
                ${c.name}
            </button>
        `).join('');

        // Eventos dos vereadores
        els.councilorsGrid.querySelectorAll('.councilor-btn').forEach(btn => {
            btn.addEventListener('click', () => handleCouncilorClick(parseInt(btn.dataset.id)));
        });
    }

    /**
     * Atualiza o estado ativo dos vereadores baseado no documento atual
     */
    function updateCouncilorsState() {
        if (!currentDocId) return;

        const requests = Storage.getRequests(currentDocId);
        
        els.councilorsGrid.querySelectorAll('.councilor-btn').forEach(btn => {
            const id = parseInt(btn.dataset.id);
            btn.classList.toggle('active', requests.includes(id));
        });
    }

    /**
     * Alterna a visualização da lista de vereadores
     */
    function toggleCouncilors() {
        els.councilorsGrid.classList.toggle('collapsed');
        els.toggleCouncilors.classList.toggle('collapsed');
    }

    /**
     * Manipula o clique em um vereador
     * @param {number} councilorId 
     */
    function handleCouncilorClick(councilorId) {
        if (!currentDocId) {
            showNotification('Selecione um documento primeiro.', 'error');
            return;
        }

        const hasRequest = Storage.hasRequest(currentDocId, councilorId);
        
        if (hasRequest) {
            Storage.removeRequest(currentDocId, councilorId);
            showNotification('Solicitação removida.', 'error');
        } else {
            Storage.addRequest(currentDocId, councilorId);
            showNotification('Solicitação registrada!', 'success');
        }

        updateCouncilorsState();
        renderRequests();
        renderSidebarList();
    }

    /**
     * Manipula a seleção da pasta de documentos
     */
    function handleFolderSelect(e) {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) {
            showNotification('Nenhum arquivo selecionado.', 'error');
            return;
        }

        // Filtrar apenas PDFs
        const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        
        if (pdfFiles.length === 0) {
            showNotification('Nenhum arquivo PDF encontrado na pasta.', 'error');
            return;
        }

        // Ordenar por nome
        pdfFiles.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));

        documents = pdfFiles.map(f => ({
            name: f.name,
            file: f,
            metadata: null // Será preenchido após análise
        }));

        // Atualizar interface
        els.folderStatus.textContent = `${pdfFiles.length} documento(s) encontrado(s).`;
        els.folderSection.style.display = 'none';
        els.viewerSection.style.display = 'block';

        // Carregar primeiro documento
        currentIndex = 0;
        renderSidebarList();
        loadDocument(0);
    }

    /**
     * Navega entre documentos
     * @param {number} direction 
     */
    function navigate(direction) {
        const newIndex = currentIndex + direction;
        
        if (newIndex < 0 || newIndex >= documents.length) {
            showNotification(
                direction < 0 ? 'Primeiro documento.' : 'Último documento.',
                'error'
            );
            return;
        }

        currentIndex = newIndex;
        loadDocument(currentIndex);
    }

    /**
     * Carrega um documento pelo índice e faz análise inteligente do PDF
     * @param {number} index 
     */
    async function loadDocument(index) {
        if (index < 0 || index >= documents.length) return;

        const doc = documents[index];
        currentDocId = doc.name;

        // Atualizar contador
        els.currentDoc.textContent = index + 1;
        els.totalDocs.textContent = documents.length;
        els.documentName.textContent = doc.name;

        // Carregar PDF
        const success = await PdfViewer.loadFile(doc.file);
        
        if (!success) {
            showNotification('Erro ao carregar o documento.', 'error');
            return;
        }

        // Análise inteligente do PDF (extrair texto, identificar tipo/número/assunto)
        await analyzeDocument(doc);

        // Atualizar estado dos vereadores e solicitações
        updateCouncilorsState();
        renderRequests();
        updateSidebarActiveItem();
    }

    /**
     * Analisa o documento PDF para extrair metadados
     * @param {Object} doc - Documento com {name, file, metadata}
     */
    async function analyzeDocument(doc) {
        try {
            const pdfDoc = PdfViewer.getPdfDoc();
            if (!pdfDoc) return;

            // Analisar com o Parser
            const result = await Parser.analyze(pdfDoc);
            
            // Armazenar metadados no documento
            doc.metadata = {
                type: result.type,
                number: result.number,
                subject: result.subject
            };

            // Atualizar sidebar com tipo/número
            renderSidebarList();
        } catch (e) {
            console.warn('Erro na análise do documento:', e);
            doc.metadata = { type: '', number: '', subject: '' };
        }
    }

    /**
     * Renderiza a lista de solicitações do documento atual
     */
    function renderRequests() {
        if (!currentDocId) {
            els.requestsList.innerHTML = '<p class="requests-empty">Nenhuma solicitação para este documento.</p>';
            return;
        }

        const requests = Storage.getRequests(currentDocId);

        if (requests.length === 0) {
            els.requestsList.innerHTML = '<p class="requests-empty">Nenhuma solicitação para este documento.</p>';
            return;
        }

        els.requestsList.innerHTML = requests.map(id => {
            const councilor = COUNCILORS.find(c => c.id === id);
            if (!councilor) return '';
            return `
                <span class="request-tag">
                    ${councilor.name}
                    <button class="remove-request" data-id="${id}" title="Remover solicitação">&times;</button>
                </span>
            `;
        }).join('');

        // Eventos de remoção
        els.requestsList.querySelectorAll('.remove-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                Storage.removeRequest(currentDocId, id);
                updateCouncilorsState();
                renderRequests();
                renderSidebarList();
                showNotification('Solicitação removida.', 'error');
            });
        });
    }

    // ============================================
    // Sidebar Functions
    // ============================================

    function openSidebar() {
        els.sidebar.classList.add('open');
    }

    function closeSidebar() {
        els.sidebar.classList.remove('open');
    }

    /**
     * Renderiza a lista de documentos no sidebar com tipo e número
     */
    function renderSidebarList() {
        if (!els.sidebarList) return;

        const query = els.searchDocs.value.toLowerCase().trim();
        
        let filteredDocs = documents;
        if (query) {
            filteredDocs = documents.filter(doc => 
                doc.name.toLowerCase().includes(query)
            );
        }

        if (filteredDocs.length === 0) {
            els.sidebarList.innerHTML = `
                <div class="sidebar-empty">
                    ${query ? 'Nenhum documento encontrado para "' + escapeHtml(query) + '".' : 'Nenhum documento disponível.'}
                </div>
            `;
            return;
        }

        els.sidebarList.innerHTML = filteredDocs.map((doc) => {
            const actualIndex = documents.indexOf(doc);
            const requests = Storage.getRequests(doc.name);
            const requestCount = requests.length;
            const isActive = currentDocId === doc.name;
            const hasRequests = requestCount > 0;
            const meta = doc.metadata || {};
            
            // Nome de exibição: se tiver tipo e número, mostra formatado
            let displayName = doc.name;
            if (meta.type && meta.type !== 'Documento' && meta.number) {
                displayName = `${meta.type} nº ${meta.number}`;
            } else if (meta.type && meta.type !== 'Documento') {
                displayName = `${meta.type} - ${doc.name}`;
            }

            return `
                <div class="sidebar-item ${isActive ? 'active' : ''}" data-index="${actualIndex}">
                    <span class="doc-indicator ${hasRequests ? 'has-requests' : ''}"></span>
                    <div class="doc-info">
                        <div class="doc-name-text">${escapeHtml(displayName)}</div>
                        <div class="doc-request-count ${hasRequests ? 'has-requests' : ''}">
                            ${requestCount} solicitação(ões)
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Eventos de clique nos itens
        els.sidebarList.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                if (index >= 0 && index !== currentIndex) {
                    currentIndex = index;
                    loadDocument(currentIndex);
                    updateSidebarActiveItem();
                    closeSidebar();
                }
            });
        });
    }

    function updateSidebarActiveItem() {
        els.sidebarList.querySelectorAll('.sidebar-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            item.classList.toggle('active', index === currentIndex);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type) {
        const el = document.getElementById('notification');
        if (!el) return;
        
        el.textContent = message;
        el.className = 'notification' + (type ? ' ' + type : '');
        el.style.display = 'block';
        
        clearTimeout(el._timeout);
        el._timeout = setTimeout(() => {
            el.style.display = 'none';
        }, 3000);
    }

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init,
        navigate,
        loadDocument,
        openSidebar,
        closeSidebar
    };
})();