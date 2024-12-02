frappe.provide('utils');

utils.get_perm_level = function (doctype) {
    frappe.call({
        method: "millap.api.get_user_permlevel",
        args: {
            user: usuarioLogado,
            doctype: doctype
        },
        callback: function (response) {
            let permlevels = response.message.map(perm => perm.permlevel);
            console.log('Níveis de permissão do usuário logado para o Doctype "Pedidos":', permlevels);
        },
        error: function (error) {
            console.error('Erro ao obter os níveis de permissão do usuário logado:', error);
        }
    })
};

utils.verificarRegistroAberto = function (doctype, cliente, estadoCampo, estadosExcluidos) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'millapp.apis.utils.verificar_registro_aberto',
            args: {
                doctype: doctype,
                cliente: cliente,
                estado_campo: estadoCampo,
                estados_excluidos: estadosExcluidos
            },
            callback: function (data) {
                resolve(data.message);
                console.log('Registro aberto encontrado:', data.message);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
};

// Funções específicas utilizando a função genérica
utils.tem_atendimento_aberto = function (cliente) {
    return utils.verificarRegistroAberto('Atendimentos', cliente, 'atendimento_state', 'Fechado');
};

utils.tem_pedido_aberto = function (cliente) {
    return utils.verificarRegistroAberto('Pedidos', cliente, 'pedido_state', ['Faturado', 'Entregue']);
};

utils.tem_pedido_novo = function (cliente) {
    return utils.verificarRegistroAberto('Pedidos', cliente, 'pedido_state', ['Pre-Criado', 'Faturado', 'Entregue']);
};

utils.tem_faturamento_aberto = function (cliente) {
    return utils.verificarRegistroAberto('Faturamentos', cliente, 'faturamento_state', 'Pago');
};