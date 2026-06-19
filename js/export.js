/**
 * Módulo de exportação - Excel e PDF
 */
const Export = (() => {
    /**
     * Exporta o resumo para Excel
     * @param {Array} documents - Lista de documentos
     */
    function exportExcel(documents) {
        const docData = Summary.generateDocSummary(documents);
        const councilorData = Summary.generateCouncilorSummary(documents);
        
        if (docData.length === 0) {
            showNotification('Nenhum dado para exportar.', 'error');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            // Sheet 1: Por Documento
            const docRows = [['Documento', 'Solicitações', 'Vereadores Interessados']];
            docData.forEach(item => {
                docRows.push([
                    item.docName,
                    item.count,
                    item.councilors.join(', ')
                ]);
            });
            const totalRequests = docData.reduce((sum, item) => sum + item.count, 0);
            docRows.push([`Total de documentos: ${docData.length}`, totalRequests, '']);

            const ws1 = XLSX.utils.aoa_to_sheet(docRows);
            ws1['!cols'] = [
                { wch: 50 },
                { wch: 15 },
                { wch: 60 }
            ];
            XLSX.utils.book_append_sheet(wb, ws1, 'Por Documento');

            // Sheet 2: Por Vereador
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

                const ws2 = XLSX.utils.aoa_to_sheet(councilorRows);
                ws2['!cols'] = [
                    { wch: 30 },
                    { wch: 60 }
                ];
                XLSX.utils.book_append_sheet(wb, ws2, 'Por Vereador');
            }

            const fileName = `resumo_sessao_${formatDate()}.xlsx`;
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
     */
    async function exportPDF(documents) {
        const docData = Summary.generateDocSummary(documents);
        const councilorData = Summary.generateCouncilorSummary(documents);
        
        if (docData.length === 0) {
            showNotification('Nenhum dado para exportar.', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;

            // Título
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Resumo da Sessão - Solicitações de Cópia', pageWidth / 2, 20, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });

            // Tabela por documento
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Por Documento', margin, 38);

            const docHeaders = [['Documento', 'Solicitações', 'Vereadores']];
            const docBody = docData.map(item => [
                item.docName,
                String(item.count),
                item.councilors.join(', ')
            ]);

            const totalRequests = docData.reduce((sum, item) => sum + item.count, 0);
            docBody.push([`Total: ${docData.length}`, String(totalRequests), '']);

            doc.autoTable({
                head: docHeaders,
                body: docBody,
                startY: 42,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 12,
                    cellPadding: 4,
                    overflow: 'linebreak',
                    halign: 'left',
                    valign: 'top'
                },
                headStyles: {
                    fillColor: [26, 115, 232],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 12
                },
                columnStyles: {
                    0: { cellWidth: 80 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 'auto' }
                }
            });

            // Tabela por vereador (nova página)
            if (councilorData.length > 0) {
                doc.addPage();
                
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('Resumo por Vereador', pageWidth / 2, 20, { align: 'center' });

                let yPos = 35;
                councilorData.forEach(c => {
                    // Verificar se precisa de nova página
                    if (yPos > pageHeight - 40) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${c.name} (${c.documents.length} documento(s))`, margin, yPos);
                    yPos += 6;

                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    c.documents.forEach(d => {
                        doc.text(`• ${d.display}`, margin + 5, yPos);
                        yPos += 5;
                    });

                    yPos += 4;
                });
            }

            // Rodapé em todas as páginas
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(128);
                doc.text(
                    `Página ${i} de ${totalPages}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                );
            }

            const fileName = `resumo_sessao_${formatDate()}.pdf`;
            doc.save(fileName);
            showNotification('Arquivo PDF exportado com sucesso!', 'success');
        } catch (e) {
            console.error('Erro ao exportar PDF:', e);
            showNotification('Erro ao exportar PDF.', 'error');
        }
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
     * Formata a data atual para nome de arquivo
     * @returns {string}
     */
    function formatDate() {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${d}${m}${y}_${h}${min}`;
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