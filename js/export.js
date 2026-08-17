/**
 * Módulo de exportação - Excel e PDF
 */
const Export = (() => {
    /**
     * Exporta o resumo para Excel
     * @param {Array} documents - Lista de documentos
     * @param {string} sessionDate - Data da sessão (dd/mm/aaaa)
     */
    function exportExcel(documents, sessionDate) {
        const docData = Summary.generateDocSummary(documents);
        const councilorData = Summary.generateCouncilorSummary(documents);
        
        if (docData.length === 0) {
            showNotification('Nenhum dado para exportar.', 'error');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            // Sheet 1: TODOS OS DOCUMENTOS
            const titleRow = [`Expediente da Sessão - ${sessionDate}`, '', ''];
            const allDocRows = [titleRow, ['Nº', 'Documento', 'Descrição', 'Páginas']];
            docData.forEach((item, index) => {
                allDocRows.push([
                    String(index + 1),
                    item.docName,
                    item.description || '',
                    item.pageCount > 0 ? String(item.pageCount) : '-'
                ]);
            });
            const totalPages = docData.reduce((sum, d) => sum + (d.pageCount || 0), 0);
            allDocRows.push([`Total: ${docData.length} documentos`, '', '', String(totalPages)]);

            const ws1 = XLSX.utils.aoa_to_sheet(allDocRows);
            ws1['!cols'] = [
                { wch: 6 },
                { wch: 50 },
                { wch: 60 },
                { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(wb, ws1, 'Documentos Lidos');

            // Sheet 2: SOLICITAÇÕES DE CÓPIA
            const docsWithRequests = docData.filter(d => d.hasRequests);

            if (docsWithRequests.length > 0) {
                // Tabela por documento
                const reqTitleRow = [`Solicitações de Cópia - ${sessionDate}`, '', '', ''];
                const reqRows = [reqTitleRow, ['Documento', 'Descrição', 'Solicitações', 'Vereadores']];
                docsWithRequests.forEach(item => {
                    reqRows.push([
                        item.docName,
                        item.description || '',
                        item.count,
                        item.councilors.join(', ')
                    ]);
                });
                const totalRequests = docsWithRequests.reduce((sum, item) => sum + item.count, 0);
                reqRows.push([`Total: ${docsWithRequests.length} documentos`, '', totalRequests, '']);

                const ws2 = XLSX.utils.aoa_to_sheet(reqRows);
                ws2['!cols'] = [
                    { wch: 50 },
                    { wch: 60 },
                    { wch: 15 },
                    { wch: 60 }
                ];
                XLSX.utils.book_append_sheet(wb, ws2, 'Solicitações');

                // Sheet 3: Por Vereador
                if (councilorData.length > 0) {
                    const councilorRows = [['Vereador', 'Documentos Solicitados']];
                    councilorData.forEach(c => {
                        c.documents.forEach((doc, idx) => {
                            if (idx === 0) {
                                councilorRows.push([c.name, doc.display]);
                            } else {
                                councilorRows.push(['', doc.display]);
                            }
                        });
                    });

                    const ws3 = XLSX.utils.aoa_to_sheet(councilorRows);
                    ws3['!cols'] = [
                        { wch: 30 },
                        { wch: 60 }
                    ];
                    XLSX.utils.book_append_sheet(wb, ws3, 'Por Vereador');
                }
            }

            const fileName = `expediente_${formatDate(sessionDate)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showNotification('Arquivo Excel exportado com sucesso!', 'success');
        } catch (e) {
            console.error('Erro ao exportar Excel:', e);
            showNotification('Erro ao exportar Excel.', 'error');
        }
    }

    /**
     * Exporta o resumo para PDF
     * @param {Array} documents - Lista de documentos
     * @param {string} sessionDate - Data da sessão (dd/mm/aaaa)
     */
    async function exportPDF(documents, sessionDate, includeRequests = false) {
        const docData = Summary.generateDocSummary(documents);
        const councilorData = Summary.generateCouncilorSummary(documents);
        
        if (docData.length === 0) {
            showNotification('Nenhum dado para exportar.', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const report = new jsPDF('portrait', 'mm', 'a4');
            
            const pageWidth = report.internal.pageSize.getWidth();
            const pageHeight = report.internal.pageSize.getHeight();
            const margin = 8;

            const fontName = 'times';

            // Título
            report.setFontSize(16);
            report.setFont(fontName, 'bold');
            report.text(`Expediente da Sessão - ${sessionDate}`, pageWidth / 2, 16, { align: 'center' });
            
            report.setFontSize(12);
            report.setFont(fontName, 'normal');
            report.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 24, { align: 'center' });

            // PÁGINA 1: TODOS OS DOCUMENTOS
            report.setFontSize(14);
            report.setFont(fontName, 'bold');
            report.text('Documentos Lidos', margin, 34);

           const docBody = docData.map((item, index) => [
    String(index + 1),                              // Nº
    item.docName,                                  // Documento
    item.pageCount > 0 ? String(item.pageCount) : '-', // Páginas
    item.description || ''                         // Descrição
]);

            const totalPagesAll = docData.reduce((sum, d) => sum + (d.pageCount || 0), 0);
            docBody.push([
    '',
    `Total de documentos: ${docData.length}`,
    String(totalPagesAll),
    ''
]);

            const docHeaders = [['Nº', 'Documento', 'Páginas', 'Descrição']];

            report.autoTable({
                head: docHeaders,
                body: docBody,
                startY: 38,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 10,
                    font: fontName,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    halign: 'left',
                    valign: 'top'
                },
                headStyles: {
                    fillColor: [26, 115, 232],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 23 },
                    2: { cellWidth: 18, halign: 'center' },
                    3: { cellWidth: 136 }
                },
                tableWidth: 194
            });

            // PÁGINA 2: SOLICITAÇÕES DE CÓPIA (apenas se o toggle estiver ativo)
            const docsWithRequests = docData.filter(d => d.hasRequests);

            if (includeRequests && docsWithRequests.length > 0) {
                report.addPage();
                
                report.setFontSize(16);
                report.setFont(fontName, 'bold');
                report.text('Solicitações de Cópia', pageWidth / 2, 16, { align: 'center' });

                // Tabela por documento
                report.setFontSize(14);
                report.setFont(fontName, 'bold');
                report.text('Por Documento', margin, 28);

                const reqHeaders = [['Documento', 'Descrição', 'Solicitações', 'Vereadores']];
                const reqBody = docsWithRequests.map(item => [
                    item.docName,
                    item.description || '',
                    String(item.count),
                    item.councilors.join(', ')
                ]);
                const totalRequests = docsWithRequests.reduce((sum, item) => sum + item.count, 0);
                reqBody.push([`Total: ${docsWithRequests.length}`, '', String(totalRequests), '']);

                report.autoTable({
                    head: reqHeaders,
                    body: reqBody,
                    startY: 32,
                    margin: { left: margin, right: margin },
                    styles: {
                        fontSize: 9,
                        font: fontName,
                        cellPadding: 2,
                        overflow: 'linebreak',
                        halign: 'left',
                        valign: 'top'
                    },
                    headStyles: {
                        fillColor: [26, 115, 232],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 10
                    },
                    columnStyles: {
                        0: { cellWidth: 45 },
                        1: { cellWidth: 45 },
                        2: { cellWidth: 18, halign: 'center' },
                        3: { cellWidth: 86 }
                    },
                    tableWidth: 194,
                    rowPageBreak: 'auto'
                });
            }

            // Rodapé nas páginas do relatório
            const reportTotalPages = report.internal.getNumberOfPages();
            for (let i = 1; i <= reportTotalPages; i++) {
                report.setPage(i);
                report.setFontSize(8);
                report.setFont(fontName, 'normal');
                report.setTextColor(128);
                report.text(
                    `Página ${i}`,
                    pageWidth / 2,
                    pageHeight - 6,
                    { align: 'center' }
                );
            }

            // Converter o relatório para bytes
            const reportBytes = report.output('arraybuffer');

            // Usar pdf-lib para mesclar relatório + todos os PDFs
            const PDFLib = window.PDFLib;
            const mergedPdf = await PDFLib.PDFDocument.create();

            // Carregar e copiar páginas do relatório
            const reportPdf = await PDFLib.PDFDocument.load(reportBytes);
            const reportPages = await mergedPdf.copyPages(reportPdf, reportPdf.getPageIndices());
            reportPages.forEach(page => mergedPdf.addPage(page));

            // Adicionar separador com índice de documentos
            const { rgb } = PDFLib;

            // Carregar e anexar cada PDF da lista de documentos
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                if (!doc.file) continue;

                try {
                    // Adicionar página separadora com nome do documento
                    const separatorPage = mergedPdf.addPage([595.28, 841.89]); // A4 em pontos
                    separatorPage.setFontSize(16);
                    const helvBold = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                    const helv = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);

                    separatorPage.drawText(`Documento ${i + 1} de ${documents.length}`, {
                        x: 50,
                        y: 500,
                        size: 20,
                        font: helvBold,
                        color: rgb(0, 0.2, 0.6)
                    });
                    separatorPage.drawText(doc.name, {
                        x: 50,
                        y: 470,
                        size: 14,
                        font: helv,
                        color: rgb(0.2, 0.2, 0.2)
                    });

                    // Carregar o PDF do arquivo
                    const fileBytes = await readFileAsArrayBuffer(doc.file);
                    const docPdf = await PDFLib.PDFDocument.load(fileBytes, {
                        ignoreEncryption: true
                    });
                    const docPages = await mergedPdf.copyPages(docPdf, docPdf.getPageIndices());
                    docPages.forEach(page => mergedPdf.addPage(page));
                } catch (e) {
                    console.warn(`Erro ao anexar ${doc.name}:`, e);
                    // Continua com os próximos documentos
                }
            }

            // Salvar PDF mesclado
            const mergedBytes = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `expediente_${formatDate(sessionDate)}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            showNotification('Arquivo PDF exportado com sucesso!', 'success');
        } catch (e) {
            console.error('Erro ao exportar PDF:', e);
            showNotification('Erro ao exportar PDF.', 'error');
        }
    }

    /**
     * Lê arquivo como ArrayBuffer
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
     * Converte um File para Data URI (base64)
     * @param {File} file
     * @returns {Promise<string>}
     */
    function fileToDataUri(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Formata a data da sessão para nome de arquivo
     * @param {string} sessionDate - Data da sessão (dd/mm/aaaa)
     * @returns {string}
     */
    function formatDate(sessionDate) {
        if (sessionDate) {
            // Recebe dd/mm/aaaa, retorna ddmmaaaa
            return sessionDate.replace(/\//g, '');
        }
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        return `${d}${m}${y}`;
    }

    /**
     * Mostra notificação
     * @param {string} message 
     * @param {string} type 
     */
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

    return {
        exportExcel,
        exportPDF
    };
})();