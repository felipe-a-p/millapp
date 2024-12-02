// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.ui.form.on("Artigos", {
    refresh(frm) {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Configuracoes Gerais',
                name: 'Lista de Tamanhos'
            }, callback: function (r) {
                if (r.message) {
                    atualizarOpcoesDeTamanhos(frm, r.message);
                }
            }
        });
    },
    grupo: function (frm) {
        if (frm.doc.grupo) {
            frm.set_query('subgrupo', function () {
                return {
                    filters: {
                        'parent': frm.doc.grupo
                    }
                };
            });
        }
    },
    modelo_padrao: function (frm, cdt, cdn) {
        // Desmarca qualquer outro registro que tenha o valor modelo padrão
        let child = locals[cdt][cdn];
        if (child.modelo_padrao) {
            frm.doc.modelos_de_artigos.forEach(function (row) {
                if (row.name != child.name) {
                    frappe.model.set_value(row.doctype, row.name, 'modelo_padrao', 0);
                }
            });
        }
    },

});

frappe.ui.form.on('Modelos de Artigos', {
    form_render: function (frm, cdt, cdn) {
        let child = locals[cdt][cdn];
        configurarBotaoGerarCodigoDeBarras(frm, child);
    },
    codigo_de_barras_numeros: function (frm, cdt, cdn) {
        let child = locals[cdt][cdn];
        let codigo_de_barras = child.codigo_de_barras_numeros;
        e_codigo_de_barras_unico(codigo_de_barras).then(isUnique => {
            if (isUnique) {
                frappe.model.set_value(cdt, cdn, 'codigo_de_barras_visual', codigo_de_barras);
            } else {
                frappe.prompt([
                    {
                        fieldtype: 'Section Break',
                        label: 'Atenção',
                        collapsible: 0
                    },
                    {
                        fieldtype: 'HTML',
                        options: '<p>O código de barras informado já está cadastrado. Por favor, informe um novo código de barras.</p>'
                    },
                    {
                        fieldname: 'novo_codigo_de_barras',
                        fieldtype: 'Data',
                        label: 'Novo código de barras',
                        reqd: 1,
                        default: codigo_de_barras
                    },
                    {
                        fieldname: 'gerar_automaticamente',
                        fieldtype: 'Check',
                        label: 'Gerar automaticamente',
                        default: 0
                    }
                ], function (values) {
                    if (values.gerar_automaticamente) {
                        gerar_codigo_de_barras(frm, child);
                        frm.save();
                    } else if (values.novo_codigo_de_barras) {
                        e_codigo_de_barras_unico(values.novo_codigo_de_barras).then(isUnique => {
                            if (isUnique) {
                                frappe.model.set_value(cdt, cdn, 'codigo_de_barras_numeros', values.novo_codigo_de_barras);
                                frappe.model.set_value(cdt, cdn, 'codigo_de_barras_visual', values.novo_codigo_de_barras);
                            } else {
                                frappe.model.set_value(cdt, cdn, 'codigo_de_barras_numeros', '');
                                frappe.msgprint(__('O código de barras já existe.'));
                            }
                        }).catch(error => {
                            console.error('Erro ao verificar o código de barras:', error);
                        });
                    }
                });
            }
        }).catch(error => {
            console.error('Erro ao verificar o código de barras:', error);
        });

    },
    modelo_padrao: function (frm, cdt, cdn) {
        // desmarca qualquer outro registro que tenha o valor modelo padrão
        let child = locals[cdt][cdn];
        if (child.modelo_padrao) {
            frm.doc.modelos_de_artigos.forEach(function (row) {
                if (row.name != child.name) {
                    frappe.model.set_value(row.doctype, row.name, 'modelo_padrao', 0);
                }
            });
        }
    }
});

// Função para atualizar as opções de tamanhos
function atualizarOpcoesDeTamanhos(frm, configuracoesGerais) {
    const cfgTamanhos = configuracoesGerais.lista_de_tamanhos || [];
    const tamanhos = cfgTamanhos.map(tamanho => tamanho.tamanho);
    frm.fields_dict.modelos_de_artigos.grid.update_docfield_property("tamanho", "options", tamanhos);
}

// Função para lidar com o clique do botão de gerar código de barras
function configurarBotaoGerarCodigoDeBarras(frm, child) {
    const botao = $(frm.fields_dict['modelos_de_artigos'].grid.wrapper)
        .find(`[data-idx="${child.idx}"] button[data-fieldname="botao_gerar_codigo_de_barras"]`);

    botao.on('click', function () {
        if (!child.codigo_de_barras_numeros) {
            gerar_codigo_de_barras(frm, child);
            frm.save();
        } else {
            $(this).hide();
            frappe.msgprint({
                title: __('Atenção'),
                message: __('Produto já possui código de barras.'),
                indicator: 'red'
            });
        }
    });
}

function gerar_codigo_de_barras(frm, row) {
    let codigo_de_barras = Math.floor(10000000 + Math.random() * 90000000).toString();
    if (!e_codigo_de_barras_unico(codigo_de_barras)) {
        gerar_codigo_de_barras(frm, row);
    } else {
        frappe.model.set_value(row.doctype, row.name, 'codigo_de_barras_numeros', codigo_de_barras);
        frappe.model.set_value(row.doctype, row.name, 'codigo_de_barras_visual', codigo_de_barras);
    }
}

function e_codigo_de_barras_unico(codigo) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'millapp.api.verificar_codigo_de_barras_unico',
            args: { codigo: codigo },
            callback: function (response) {
                if (response.message) {
                    resolve(response.message.unico);
                } else {
                    reject(new Error('Erro ao verificar o código de barras.'));
                }
            }
        });
    });
}
