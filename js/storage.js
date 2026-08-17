/**
 * Módulo de armazenamento - gerencia os dados em memória (localStorage)
 */
const Storage = (() => {
    let data = null;

    /**
     * Inicializa o armazenamento carregando dados do localStorage
     */
    function init() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                data = JSON.parse(saved);
            } else {
                data = {};
            }
        } catch (e) {
            console.warn('Erro ao carregar dados, iniciando vazio:', e);
            data = {};
        }
        return data;
    }

    /**
     * Salva os dados atuais no localStorage
     */
    function save() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
        }
    }

    /**
     * Obtém as solicitações para um documento específico
     * @param {string} docId - Identificador do documento (nome do arquivo)
     * @returns {number[]} - Array de IDs dos vereadores
     */
    function getRequests(docId) {
        if (!data) init();
        return data[docId] || [];
    }

    /**
     * Adiciona uma solicitação de vereador para um documento
     * @param {string} docId - Identificador do documento
     * @param {number} councilorId - ID do vereador
     * @returns {boolean} - true se adicionou, false se já existia
     */
    function addRequest(docId, councilorId) {
        if (!data) init();
        if (!data[docId]) {
            data[docId] = [];
        }
        if (!data[docId].includes(councilorId)) {
            data[docId].push(councilorId);
            save();
            return true;
        }
        return false;
    }

    /**
     * Remove a solicitação de um vereador para um documento
     * @param {string} docId - Identificador do documento
     * @param {number} councilorId - ID do vereador
     * @returns {boolean} - true se removeu, false se não existia
     */
    function removeRequest(docId, councilorId) {
        if (!data) init();
        if (data[docId]) {
            const idx = data[docId].indexOf(councilorId);
            if (idx !== -1) {
                data[docId].splice(idx, 1);
                if (data[docId].length === 0) {
                    delete data[docId];
                }
                save();
                return true;
            }
        }
        return false;
    }

    /**
     * Obtém todas as solicitações de todos os documentos
     * @returns {Object} - Objeto com docId como chave e array de IDs como valor
     */
    function getAllRequests() {
        if (!data) init();
        return { ...data };
    }

    /**
     * Verifica se um vereador já solicitou cópia de um documento
     * @param {string} docId - Identificador do documento
     * @param {number} councilorId - ID do vereador
     * @returns {boolean}
     */
    function hasRequest(docId, councilorId) {
        if (!data) init();
        return data[docId] ? data[docId].includes(councilorId) : false;
    }

    /**
     * Obtém a descrição de um documento
     * @param {string} docId - Identificador do documento (nome do arquivo)
     * @returns {string}
     */
    function getDescription(docId) {
        if (!data) init();
        if (data[docId] && data[docId]._description !== undefined) {
            return data[docId]._description;
        }
        return '';
    }

    /**
     * Salva a descrição de um documento
     * @param {string} docId - Identificador do documento
     * @param {string} description - Descrição do documento
     */
    function setDescription(docId, description) {
        if (!data) init();
        if (!data[docId]) {
            data[docId] = [];
        }
        data[docId]._description = description;
        save();
    }

    /**
     * Limpa todos os dados
     */
    function clearAll() {
        data = {};
        save();
    }

    return {
        init,
        save,
        getRequests,
        addRequest,
        removeRequest,
        getAllRequests,
        hasRequest,
        getDescription,
        setDescription,
        clearAll
    };
})();