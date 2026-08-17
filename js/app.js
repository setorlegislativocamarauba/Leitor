/**
 * Módulo principal - orquestra todos os componentes da aplicação
 */
const App = (() => {
    // Estado da aplicação
    let documents = [];
    let currentIndex = 0;
    let currentDocId = null;
    let sessionDate = '';
    let openedDocs = new Set();

    // Elementos DOM
    const els = {};

    /**
     * Inicializa a aplicação
     */
    function init() {
        // Cache de elementos DOM
        els.sessionSection = document.getElementById('sessionSection');
        els.sessionDate = document.getElementById('sessionDate');
        els.btnStartSession = document.getElementById('btnStartSession');
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
        els.docDescription = document.getElementById('docDescription');
        els.descriptionCount = document.getElementById('descriptionCount');
        els.descriptionStatus = document.getElementById('descriptionStatus');
        
        // Inicializar módulos
        Storage.init();
        PdfViewer.init();

        // Preencher data atual no campo de data
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        els.sessionDate.value = `${year}-${month}-${day}`;

        // Configurar eventos
        setupEvents();

        // Renderizar vereadores
        renderCouncilors();
    }

    /**
     * Configura todos os eventos da aplicação
     */
    function setupEvents() {
        // Iniciar sessão
        els.btnStartSession.addEventListener('click', handleStartSession);

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
        els.btnSummary.addEventListener('click', () => Summary.open(documents, sessionDate));
        els.closeSummary.addEventListener('click', Summary.close);
        document.querySelector('.modal-backdrop').addEventListener('click', Summary.close);

        // Export
        els.btnExportExcel.addEventListener('click', () => Export.exportExcel(documents, sessionDate));
        els.btnExportPDF.addEventListener('click', () => {
            const includeRequests = document.getElementById('includeRequestsInPDF').checked;
            Export.exportPDF(documents, sessionDate, includeRequests);
        });
        els.btnExportExcelFromSummary.addEventListener('click', () => {
            Export.exportExcel(documents, sessionDate);
        });
        els.btnExportPDFFromSummary.addEventListener('click', () => {
            const includeRequests = document.getElementById('includeRequestsInPDF').checked;
            Export.exportPDF(documents, sessionDate, includeRequests);
        });

        // Description - auto-save
        let descriptionSaveTimeout;
        els.docDescription.addEventListener('input', () => {
            updateDescriptionCount();
            clearTimeout(descriptionSaveTimeout);
            descriptionSaveTimeout = setTimeout(() => {
                saveCurrentDescription();
            }, 1000);
        });
        els.docDescription.addEventListener('blur', () => {
            clearTimeout(descriptionSaveTimeout);
            saveCurrentDescription();
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
     * Manipula o clique em "Iniciar Sessão"
     */
    function handleStartSession() {
        const dateValue = els.sessionDate.value;
        if (!dateValue) {
            showNotification('Informe a data da reunião.', 'error');
            return;
        }

        // Formatar data para exibição (dd/mm/aaaa)
        const parts = dateValue.split('-');
        sessionDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

        // Avançar para seleção de pasta
        els.sessionSection.style.display = 'none';
        els.folderSection.style.display = 'flex';
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
            pageCount: 0
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

        // Save current description before navigating
        saveCurrentDescription();

        currentIndex = newIndex;
        loadDocument(currentIndex);
    }

    /**
     * Carrega um documento pelo índice
     * @param {number} index 
     */
    async function loadDocument(index) {
        if (index < 0 || index >= documents.length) return;

        const doc = documents[index];
        currentDocId = doc.name;

        // Marcar como aberto imediatamente ao clicar
        openedDocs.add(doc.name);
        renderSidebarList();

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

        // Obter número de páginas
        doc.pageCount = PdfViewer.getPageCount();

        // Carregar descrição do documento
        loadDescription();

        // Atualizar estado dos vereadores e solicitações
        updateCouncilorsState();
        renderRequests();
        updateSidebarActiveItem();
    }

    /**
     * Carrega a descrição salva do documento atual
     */
    function loadDescription() {
        if (!currentDocId) {
            els.docDescription.value = '';
            updateDescriptionCount();
            updateDescriptionStatus('');
            return;
        }
        const desc = Storage.getDescription(currentDocId);
        els.docDescription.value = desc;
        updateDescriptionCount();
        updateDescriptionStatus(desc ? 'Descrição carregada' : '');
    }

    /**
     * Salva a descrição do documento atual
     */
    function saveCurrentDescription() {
        if (!currentDocId) return;
        const description = els.docDescription.value;
        Storage.setDescription(currentDocId, description);
        updateDescriptionStatus('Salvo automaticamente');
    }

    /**
     * Atualiza o indicador de status da descrição
     */
    function updateDescriptionStatus(message) {
        if (!els.descriptionStatus) return;
        if (!message) {
            els.descriptionStatus.textContent = '';
            return;
        }
        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        els.descriptionStatus.textContent = `${message} às ${time}`;
        els.descriptionStatus.classList.add('saved');
        
        // Remove o destaque após 2 segundos
        setTimeout(() => {
            els.descriptionStatus.classList.remove('saved');
        }, 2000);
    }

    /**
     * Atualiza o contador de caracteres da descrição
     */
    function updateDescriptionCount() {
        const len = els.docDescription.value.length;
        els.descriptionCount.textContent = `${len}/500`;
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
     * Renderiza a lista de documentos no sidebar
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
            const isOpened = openedDocs.has(doc.name);
            const hasRequests = requestCount > 0;
            return `
                <div class="sidebar-item ${isActive ? 'active' : ''}" data-index="${actualIndex}">
                    <span class="doc-indicator ${isOpened ? 'opened' : ''}"></span>
                    <div class="doc-info">
                        <div class="doc-name-text">${escapeHtml(doc.name)}</div>
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