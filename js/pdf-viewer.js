/**
 * Módulo de visualização de PDF usando PDF.js
 */
const PdfViewer = (() => {
    let pdfDoc = null;
    let viewer = null;
    let canvases = [];
    let renderCancelled = false;

    // Máximo de pixels para renderização (evita travamento em telas 4K)
    const MAX_CANVAS_PIXELS = 4000000;

    /**
     * Inicializa o visualizador
     */
    function init() {
        viewer = document.getElementById('pdfViewer');
        pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER_SRC;
    }

    /**
     * Carrega um arquivo PDF e renderiza todas as páginas
     * @param {File} file - Arquivo PDF
     * @returns {Promise<boolean>} - true se carregou com sucesso
     */
    async function loadFile(file) {
        renderCancelled = true; // Cancela renderização anterior
        await new Promise(r => setTimeout(r, 10)); // Pequeno delay para limpeza
        renderCancelled = false;

        showLoading(true);
        
        try {
            // Usar FileReader em vez de arrayBuffer para melhor performance
            const arrayBuffer = await readFileAsArrayBuffer(file);
            pdfDoc = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                // Desabilitar renderização incremental para acelerar carregamento
                disableAutoFetch: true,
                disableStream: true
            }).promise;
            
            await renderAllPages();
            showLoading(false);
            return true;
        } catch (e) {
            if (!renderCancelled) {
                console.error('Erro ao carregar PDF:', e);
                showLoading(false);
            }
            return false;
        }
    }

    /**
     * Lê arquivo como ArrayBuffer usando FileReader (mais rápido que file.arrayBuffer())
     */
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Renderiza todas as páginas do PDF em paralelo
     */
    async function renderAllPages() {
        if (!pdfDoc || !viewer) return;

        // Limpar canvases anteriores
        clearCanvases();

        const numPages = pdfDoc.numPages;
        const containerWidth = viewer.clientWidth - 32;

        // Atualizar texto de progresso
        updateLoadingProgress(0, numPages);

        // Obter todas as páginas primeiro (em paralelo)
        const pagePromises = [];
        for (let i = 1; i <= numPages; i++) {
            pagePromises.push(pdfDoc.getPage(i));
        }
        
        let pages;
        try {
            pages = await Promise.all(pagePromises);
        } catch (e) {
            console.error('Erro ao obter páginas:', e);
            return;
        }

        // Calcular escala uma vez (a viewport da primeira página serve de referência)
        const firstViewport = pages[0].getViewport({ scale: CONFIG.SCALE });
        let baseScale = CONFIG.SCALE;
        if (firstViewport.width > containerWidth) {
            baseScale = containerWidth / (firstViewport.width / CONFIG.SCALE);
        }

        // Calcular output scale com limite para evitar canvas gigantes
        const dpr = window.devicePixelRatio || 1;
        const outputScale = Math.min(dpr, 1.5);

        // Preparar todos os canvases em paralelo
        const renderPromises = pages.map((page, index) => 
            renderSinglePage(page, index, numPages, baseScale, outputScale, containerWidth)
        );

        // Usar document fragment para uma única operação DOM
        const fragment = document.createDocumentFragment();
        
        // Aguardar todas as renderizações em paralelo
        const results = await Promise.all(renderPromises);
        
        if (renderCancelled) return;

        // Montar DOM em lote
        results.forEach((canvas, index) => {
            if (canvas) {
                fragment.appendChild(canvas);
                canvases.push(canvas);
                
                if (index < numPages - 1) {
                    const separator = document.createElement('div');
                    separator.className = 'pdf-page-separator';
                    fragment.appendChild(separator);
                }
            }
        });

        // Anexar tudo de uma vez ao DOM
        viewer.appendChild(fragment);
    }

    /**
     * Renderiza uma única página e retorna o canvas
     */
    async function renderSinglePage(page, index, totalPages, baseScale, outputScale, containerWidth) {
        try {
            const pageNumber = index + 1;
            
            // Usar viewport já com a escala calculada
            const adjustedViewport = page.getViewport({ scale: baseScale });
            
            // Criar canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            const ctx = canvas.getContext('2d', { alpha: false });
            
            // Limitar o tamanho do canvas para performance
            let canvasWidth = adjustedViewport.width * outputScale;
            let canvasHeight = adjustedViewport.height * outputScale;
            
            // Se o canvas for muito grande, reduz escala para caber no limite
            if (canvasWidth * canvasHeight > MAX_CANVAS_PIXELS) {
                const ratio = Math.sqrt(MAX_CANVAS_PIXELS / (canvasWidth * canvasHeight));
                canvasWidth = Math.round(canvasWidth * ratio);
                canvasHeight = Math.round(canvasHeight * ratio);
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = (canvasWidth / outputScale) + 'px';
            canvas.style.height = (canvasHeight / outputScale) + 'px';
            
            // Calcular escala real para renderização
            const scale = baseScale * (canvasWidth / (adjustedViewport.width * outputScale));
            const renderViewport = page.getViewport({ scale });
            
            ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
            
            await page.render({
                canvasContext: ctx,
                viewport: renderViewport
            }).promise;

            // Atualizar progresso após cada página renderizada
            updateLoadingProgress(pageNumber, totalPages);

            return canvas;
        } catch (e) {
            if (!renderCancelled) {
                console.error('Erro ao renderizar página ' + (index + 1) + ':', e);
            }
            return null;
        }
    }

    /**
     * Atualiza o texto de progresso no loading
     */
    function updateLoadingProgress(current, total) {
        const loader = document.getElementById('pdfLoading');
        if (loader) {
            const textEl = loader.querySelector('p');
            if (textEl) {
                textEl.textContent = `Carregando documento... ${current}/${total} páginas`;
            }
        }
    }

    /**
     * Remove todos os canvases e separadores do visualizador
     */
    function clearCanvases() {
        if (viewer) {
            const loading = document.getElementById('pdfLoading');
            viewer.innerHTML = '';
            if (loading) {
                viewer.appendChild(loading);
            }
        }
        canvases = [];
    }

    /**
     * Mostra ou esconde o indicador de carregamento
     * @param {boolean} show 
     */
    function showLoading(show) {
        const loader = document.getElementById('pdfLoading');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
            if (show) {
                const textEl = loader.querySelector('p');
                if (textEl) {
                    textEl.textContent = 'Carregando documento...';
                }
            }
        }
        canvases.forEach(c => {
            c.style.display = show ? 'none' : 'block';
        });
    }

    /**
     * Redimensiona o visualizador (útil em mudanças de orientação)
     */
    async function resize() {
        if (pdfDoc) {
            await renderAllPages();
        }
    }

    /**
     * Limpa o visualizador
     */
    function clear() {
        renderCancelled = true;
        pdfDoc = null;
        clearCanvases();
        showLoading(false);
    }

    function getPdfDoc() {
        return pdfDoc;
    }

    return {
        init,
        loadFile,
        renderAllPages,
        resize,
        clear,
        showLoading,
        getPdfDoc
    };
})();
