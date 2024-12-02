// Copyright (c) 2024, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.require(['/assets/millapp/js/utils.js'])

frappe.ui.form.on("Pedidos", {
    onload(frm) {
        frm.dict_artigos = {};
        frm.dict_precos = {};
        frm.dict_modelos = {};

        frm.artigos_iniciais = frm.doc.artigos_do_pedido.map(artigo => ({
            artigo: artigo.artigo,
            quantidade_entregue: artigo.quantidade_entregue,
            quantidade_devolvida: artigo.quantidade_devolvida
        }));

        // TODO Se for novo, procurar a tabela de preço padrão e preencher
    },
    before_save(frm) {
        calcular_valores_entregue_vendido(frm);
        let mudancas = comparar_mudancas_de_artigos(frm)
        // TODO IF status == entregue e houver mudanças alterar estoque da praça/semana
    },
    refresh(frm) {
        document.querySelectorAll('button').forEach(button => {
            button.removeEventListener('click', () => { });
        });

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = '/assets/millapp/css/custom.css';
        document.head.appendChild(link);

        adicionar_botoes(frm);

        lancador.setup(frm, 'artigos_do_pedido', 'tabela_de_modelos');
        // Scripts
        // TODO : Cancelar Pedido

        let elementos = [
            { selector: 'button[data-fieldname="botao_criar_pedido"]', event: 'click', handler: () => criar_pedido(frm) },
            { selector: 'button[data-fieldname="botao_editar_itens"]', event: 'click', handler: () => iniciar_lancamento(frm) },
            { selector: 'button[data-fieldname="botao_salvar_itens"]', event: 'click', handler: () => encerrar_lancamento(frm) },
            { selector: 'button[data-fieldname="botao_encerrar_separacao"]', event: 'click', handler: () => encerrar_lancamento(frm, prox_etapa = true) },
            { selector: 'button[data-fieldname="botao_entregar_pedido"]', event: 'click', handler: () => entregar_pedido(frm) },
            { selector: 'button[data-fieldname="botao_iniciar_fechamento"]', event: 'click', handler: () => iniciar_fechamento(frm) },
            { selector: 'button[data-fieldname="botao_encerrar_fechamento"]', event: 'click', handler: () => encerrar_fechamento(frm) },
        ];

        function applyHandlers() {
            elementos.forEach(({ selector, event, handler }) => {
                document.querySelectorAll(selector).forEach((element) => {
                    if (!element.hasAttribute('data-handler-added')) {
                        element.addEventListener(event, handler);
                        element.setAttribute('data-handler-added', 'true'); // Marca o elemento como processado
                    }
                });
            });
        };

        // Execuções

        applyHandlers();

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // console.log(element)
                        elementos.forEach(({ selector, event, handler }) => {
                            if (element.matches(selector) && !element.hasAttribute('data-handler-added')) {
                                element.addEventListener(event, handler);
                                element.setAttribute('data-handler-added', 'true'); // Marca o elemento como processado
                            }
                        });
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // TODO FUTURO : Input artigos manual com tamanhos e modelos
        // Layout Por State
        // State : Pre Criado
        frm.toggle_display('botao_criar_pedido', (frm.doc.pedido_state === 'Pre Criado'));

        // State : Criado
        frm.toggle_display('botao_encerrar_separacao', (frm.doc.pedido_state == 'Criado'));

        // State : Separado
        frm.toggle_display('botao_entregar_pedido', (frm.doc.pedido_state == 'Separado' || frm.doc.pedido_state == 'Criado'));

        // State : Entregue
        frm.set_df_property('data_entrega', 'read_only', frm.doc.pedido_state == 'Entregue' || frm.doc.pedido_state == 'Fechado');

        // State : Faturado
        frm.toggle_display('botao_iniciar_fechamento', frm.doc.pedido_state === 'Entregue');

    },
    artigo_a_editar: function (frm) {
        if (frm.doc.artigo_a_editar) {
            lancador.montar_html_lancamento_manual();
            lancador.atualizar_html_mostrador(frm.doc.artigo_a_editar);
        } else {
            lancador.desmontar_html_lancamento_manual();
            lancador.atualizar_html_mostrador(frm.doc.artigo_a_editar);

        }
    }
});

frappe.ui.form.on('Artigos no Pedido', {

});

function adicionar_botoes(frm) {
    frm.add_custom_button(__('testfun'), function () {
        testfunc(frm);
    });
    frm.add_custom_button(__('Gerar Fatura'), function () {
        gerar_fatura(frm);
    }, "Teste");
    frm.add_custom_button(__('Alterar Atendimento'), function () {
        alterar_atendimento(frm);
    }, "Ações");
    frm.add_custom_button(__('Cancelar Pedido'), function () {
        cancelar_pedido(frm);
    }, "Ações");
}

function testfunc(frm) {
    let usuarioLogado = frappe.session.user;
    console.log(frappe.user_roles)
    console.log(frappe.get_roles(frappe.session.user))
}

function cancelar_pedido(frm) {
    // TODO: Cancelar Pedido
    console.log('cp')
}

function alterar_atendimento(frm) {
    estado = frm.doc.pedido_state;
    if (estado === 'Entregue' || estado === 'Faturado') {
        frappe.msgprint(__(`Você não pode alterar o atendimento de um com status ${estado}`));
    } else {
        let d = new frappe.ui.Dialog({
            title: 'Aterar Atendimento',
            fields: [
                {
                    label: 'Atendimento',
                    fieldname: 'atendimento',
                    fieldtype: 'Link',
                    options: 'Atendimentos',
                    reqd: 1
                },
                {
                    label: 'Data de entrega',
                    fieldname: 'data_entrega',
                    fieldtype: 'Date',
                    reqd: 1
                }
            ],
            primary_action_label: 'Alterar!',
            primary_action: async function (values) {
                try {
                    // Obter o cliente do atendimento
                    let response = await frappe.db.get_value('Atendimentos', values.atendimento, 'cliente');
                    let cliente = response.message.cliente;

                    // Definir os valores no formulário
                    frm.set_value('atendimento', values.atendimento);
                    frm.set_value('cliente', cliente);
                    frm.set_value('pedido_state', 'Pre Criado');
                    frm.set_value('data_entrega', values.data_entrega);
                    frm.set_value('data_acerto', null);
                    d.hide();

                    // Criar o pedido
                    let criado = await criar_pedido(frm);
                    console.log(criado);

                    // Salvar ou atualizar o formulário com base no resultado
                    if (criado) {
                        await frm.save();
                    } else {
                        frm.reload_doc();
                    }
                } catch (error) {
                    console.error('Erro ao alterar o pedido:', error);
                }
            }
        });
        d.show()
    }
}

function comparar_mudancas_de_artigos(frm) {
    // requer frm.artigos_iniciais inicializado
    let mudancas = [];
    frm.doc.artigos_do_pedido.forEach(item => {
        let artigo_inicial = frm.artigos_iniciais.find(i => i.artigo === item.artigo);

        if (artigo_inicial) {
            if (artigo_inicial.quantidade_entregue !== item.quantidade_entregue) {
                mudancas.push({
                    artigo: item.artigo,
                    fieldname: 'quantidade_entregue',
                    old_value: artigo_inicial.quantidade_entregue,
                    new_value: item.quantidade_entregue,
                    mudanca: item.quantidade_entregue - artigo_inicial.quantidade_entregue
                });
            };
            if (artigo_inicial.quantidade_devolvida !== item.quantidade_devolvida) {
                mudancas.push({
                    artigo: item.artigo,
                    fieldname: 'quantidade_devolvida',
                    old_value: artigo_inicial.quantidade_devolvida,
                    new_value: item.quantidade_devolvida,
                    mudanca: item.quantidade_devolvida - artigo_inicial.quantidade_devolvida
                });
            };
        };
    });
    return mudancas
};

function calcular_valores_entregue_vendido(frm) {
    let total_entregue_qtd_var = 0;
    let total_entregue_vlr_var = 0;
    let total_vendido_qtd_var = 0;
    let total_vendido_vlr_var = 0;

    frm.doc.artigos_do_pedido.forEach(function (row) {
        if (row.quantidade_entregue && row.preco_etiqueta) {
            total_entregue_qtd_var += row.quantidade_entregue;
            total_entregue_vlr_var += row.valor_total_entregue;
        }
    });

    frm.doc.artigos_do_pedido.forEach(function (row) {
        if (row.quantidade_entregue && row.preco_etiqueta) {
            total_vendido_qtd_var += row.quantidade_vendida;
            total_vendido_vlr_var += row.total_vendido;
        }
    });

    frm.set_value('total_entregue_qtd', total_entregue_qtd_var);
    frm.set_value('total_entregue_vlr', total_entregue_vlr_var);
    frm.set_value('total_vendido_qtd', total_vendido_qtd_var);
    frm.set_value('total_vendido_vlr', total_vendido_vlr_var);
};

async function criar_pedido(frm) {
    let temPedidoNovo = await utils.tem_pedido_novo(frm.doc.cliente);
    if (!temPedidoNovo) {
        if (frm.doc.data_entrega && frm.doc.data_entrega >= frappe.datetime.get_today()) {
            frm.set_value('pedido_state', 'Criado');
            frm.set_value('data_criacao', frappe.datetime.now_datetime());
            // TODO DOCTYPE CONFIGURAÇÃO DATA ENTREGA&ACERTO / não atender fds/feriado  
            frm.set_value('data_acerto', frappe.datetime.add_days(frm.doc.data_entrega, 48));
            frm.save();
            frappe.call({
                method: 'millapp.api.atualizar_campos',
                args: {
                    doctype: 'Atendimentos',
                    name: frm.doc.atendimento,
                    campos_json: JSON.stringify({
                        'atendimento_state': 'Marcado',
                        'data_visita': frm.doc.data_entrega
                    })
                },
                callback: function (response) {
                    if (response.message) {
                        frappe.msgprint(__('Pedido criado com sucesso!'));
                    }
                }
            });
            return true;
        } else {
            frappe.msgprint(__('A data de entrega tem de ser maior ou igual a hoje.'));
            return false;
        }
    } else {
        frappe.msgprint(__('Já existe um pedido em aberto para este cliente.'));
        return false;
    }
};

async function iniciar_lancamento(frm) {
    if (frm.doc.pedido_state === 'Pre Criado') {
        frappe.throw(__('Favor confirmar data e criar o pedido antes de editar os itens.'));
    } else if (frm.doc.pedido_state === 'Faturado') {
        frappe.throw(__('Você não tem permissão para editar itens de um pedido fechado, contate um administrador.'));
    } else {
        let estado_check_swap = frm.doc.check_swapper_edicao;
        frm.set_value('check_swapper_edicao', !estado_check_swap);
        frm.refresh_field('check_swapper_edicao');
        frm.set_df_property('modo_lancamento', 'read_only', 1);
        frm.toggle_display('ref_ou_cb', true);
        frm.toggle_display('artigo_a_editar', true);
        frm.toggle_display('html_lancador_quantidade', true);
        frm.toggle_display('botao_salvar_itens', true);
        frm.toggle_display('botao_editar_itens', false);
        lancador.setup(frm, 'artigos_do_pedido', 'tabela_de_modelos');
        await lancador.setup(frm, 'artigos_do_pedido', 'tabela_de_modelos');
        await lancador.montar_html_lancamento_manual();
    };
};

function encerrar_lancamento(frm, prox_etapa = false) {
    frm.save()
        .then(() => {
            frm.toggle_display('ref_ou_cb', false);
            frm.toggle_display('artigo_a_editar', false);
            frm.toggle_display('html_lancador_quantidade', false);
            frm.toggle_display('botao_somar', false);
            frm.toggle_display('botao_substituir', false);
            frm.toggle_display('botao_salvar_itens', false);
            frm.toggle_display('botao_editar_itens', true);
            frm.set_df_property('modo_lancamento', 'read_only', 0)
            frappe.msgprint(__('Itens salvos com sucesso!'));
        })
        .catch((error) => {
            frappe.msgprint(__('Ocorreu um erro ao salvar os itens.'));
            console.error(error);
        });
    if (prox_etapa) {
        if (confirm('Deseja encerrar a separação e marcar o pedido como separado?')) {
            frm.set_value('pedido_state', 'Separado');
            frappe.call({
                method: 'millapp.api.atualizar_campos',
                args: {
                    doctype: 'Atendimentos',
                    name: frm.doc.atendimento,
                    campos_json: JSON.stringify({
                        'atendimento_state': 'Separado',
                    })
                },
                callback: function (response) {
                    if (response.message) {
                        frappe.msgprint(__('Pedido separado com sucesso!'));
                    }
                }
            })
        }

    }
};

function entregar_pedido(frm) {
    if (confirm('Tem certeza que deseja entregar o pedido?')) {
        // TODO VERIFICAR SE NÃO HÁ FATURAMENTO EM ABERTO
        frm.set_value('pedido_state', 'Entregue');
        frm.set_value('data_entregue', frappe.datetime.now_datetime());
        frm.save();
        frappe.call({
            method: 'millapp.api.atualizar_campos',
            args: {
                doctype: 'Atendimentos',
                name: frm.doc.atendimento,
                campos_json: JSON.stringify({
                    'atendimento_state': 'Entregue',
                    'data_visita': frm.doc.data_acerto
                })
            },
            callback: function (response) {
                if (response.message) {
                    console.log('Campos atualizados:', response.message);
                }
            }
        });
        // TODO Logica de logistica
    } else {
        // Code to execute if user cancels
        console.log('Entrega do pedido cancelada.');
    }
};

function iniciar_fechamento(frm) {
    frm.set_value('estado_acerto', 'Fechando');
    frm.save();
    frm.toggle_display('botao_iniciar_fechamento', false);
    frm.toggle_display('botao_encerrar_fechamento', true);
    iniciar_lancamento(frm);
    lancador.vender_tudo(frm);
};

function encerrar_fechamento(frm) {
    if (confirm('Tem certeza que deseja fechar o pedido?')) {
        console.log('fechar pedido')
        frappe.call({
            method: 'millapp.api.atualizar_campos',
            args: {
                doctype: 'Atendimentos',
                name: frm.doc.atendimento,
                campos_json: JSON.stringify({
                    'atendimento_state': 'Iniciado',
                    'data_visita': null
                })
            },
            callback: function (response) {
                if (response.message) {
                    console.log('Campos atualizados:', response.message);
                }
            }
        });
        frm.set_value('pedido_state', 'Faturado');
        frm.set_value('estado_acerto', 'Fechado');
        frm.save();
        gerar_fatura(frm); // O valor total da fatura é calculado por um serverSideScript configurado na interface
    }
};

function get_itens_vendidos(frm) {
    // verificar na tabela artigos_do_pedido os itens que possuem o campo quantidade vendida maior que 0
    let itens_vendidos = frm.doc.artigos_do_pedido.filter(artigo => artigo.quantidade_vendida > 0);
    console.log(itens_vendidos);
};

function gerar_fatura(frm) {
    const config_faturar_negativo = frm.doc.config_faturar_negativo;
    let itens_do_pedido;
    let artigos_faturados;

    if (frm.doc.config_faturar_por == "Artigo") {
        itens_do_pedido = frm.doc.artigos_do_pedido.filter(artigo => {
            return config_faturar_negativo ? artigo.quantidade_vendida !== 0 : artigo.quantidade_vendida > 0;
        });
        if (itens_do_pedido.length > 0) {
            artigos_faturados = itens_do_pedido.map(artigo => ({
                'artigo': artigo.artigo,
                'quantidade': artigo.quantidade_vendida,
                'preço_etiqueta': artigo.preco_etiqueta,
                'valor_bruto': artigo.total_vendido
            }));
        }
    } else if (frm.doc.config_faturar_por == "Modelo") {
        itens_do_pedido = frm.doc.tabela_de_modelos.filter(artigo => {
            return config_faturar_negativo ? artigo.quantidade_vendida !== 0 : artigo.quantidade_vendida > 0;
        })
        if (itens_do_pedido.length > 0) {
            artigos_faturados = itens_do_pedido.map(artigo => {
                let preco_etiqueta = null;
                if (frm.dict_precos) {
                    let preco_obj = Object.values(frm.dict_precos).find(preco => preco.parent === artigo.artigo);
                    if (preco_obj) {
                        preco_etiqueta = preco_obj.preco;
                    }
                }
                let valor_bruto = artigo.quantidade_vendida * preco_etiqueta;
                return {
                    'artigo': artigo.artigo,
                    'modelo': artigo.modelo,
                    'quantidade': artigo.quantidade_vendida,
                    'preço_etiqueta': preco_etiqueta,
                    'valor_bruto': valor_bruto
                };
            });
        }
    }
    frappe.call({
        method: 'millapp.api.criar_registro',
        args: {
            doctype: 'Faturamentos',
            campos_valores: JSON.stringify({
                'pedido': frm.doc.name,
                'cliente': frm.doc.cliente,
                'atendimento': frm.doc.name,
                'origem': frm.doc.tipo_pedido,
                'estado': 'Aberto',
                'data_criacao': frappe.datetime.now_datetime(),
                'data_vencimento': frappe.datetime.add_days(frappe.datetime.now_datetime(), 0),
                'artigos_faturados': artigos_faturados // Adicionar os artigos faturados
            })
        },
        callback: function (response) {
            if (response.message) {
                window.location.href = `/app/faturamentos/${response.message}`;
            } else {
                frappe.msgprint(__('Erro ao tentar criar o faturamento.'));
            }
        },
        error: function (error) {
            console.error('Erro na chamada do método:', error);
            frappe.msgprint(__('Erro ao tentar criar o faturamento.'));
        }
    });
};

// Lançador de itens
const lancador = {
    setup: function (frm, tabela_de_artigos, tabela_de_modelos) {
        this.frm = frm;
        this.tabela_de_artigos = tabela_de_artigos;
        this.tabela_de_modelos = tabela_de_modelos;
        if (!this.frm.dict_artigos || Object.keys(this.frm.dict_artigos).length === 0 ||
            !this.frm.dict_precos || Object.keys(this.frm.dict_precos).length === 0 ||
            !this.frm.dict_modelos || Object.keys(this.frm.dict_modelos).length === 0) {
            this.carregar_dicts_de_dados(frm);
            //this.montar_html_lancamento_manual();
            this.frm.set_value('artigo_a_editar', '');
        }
        this.bind_events(frm);

    },

    carregar_dicts_de_dados: function (frm) {
        frappe.call({
            method: 'millapp.api.get_dados_dos_artigos',
            args: { tabela_de_precos: frm.doc.config_tabela_precos },
            callback: function (response) {
                if (response.message) {
                    // Atualizar os dicionários com os valores da resposta, se disponíveis
                    frm.dict_artigos = response.message.artigos || {};
                    frm.dict_precos = response.message.precos || {};
                    frm.dict_modelos = response.message.modelos || {};
                } else {
                    frappe.msgprint(__('Erro ao carregar dados: ' + response.message.message));
                }
            }
        });
    },

    bind_events: function (frm) {
        const refOuCbField = frm.fields_dict.ref_ou_cb ? frm.fields_dict.ref_ou_cb.$input : null;

        if (refOuCbField) {
            refOuCbField.on('input', this.debounce(function () {
                let cod_ou_ref = $(this).val();
                // TODO verificar o menor codigo de barras e referencia existentes
                if (cod_ou_ref.length >= 5) {
                    lancador.processar_dados_inseridos(cod_ou_ref);
                }
            }, 200));
        }

    },

    // async processar_dados_inseridos(cod_ou_ref) {
    //     this.frm.set_value('ref_ou_cb', '');
    //     let artigo = Object.values(this.frm.dict_artigos).find(artigo => artigo.referencia === cod_ou_ref);
    //     if (artigo != undefined) {
    //         // logica de artigo
    //         this.frm.set_value('artigo_a_editar', artigo.name);

    //         try {
    //             await this.montar_html_lancamento_manual();
    //             const incrementValueElement = document.getElementById('increment_value');
    //             if (incrementValueElement) {
    //                 incrementValueElement.select();
    //             } else {
    //                 console.error('Campo increment_value não encontrado ou não acessível.');
    //             }
    //         } catch (error) {
    //             console.error(error);
    //         }
    //     } else {
    //         // logica de modelo de leitura de CODIGO DE BARRAS
    //         let modelo = Object.values(this.frm.dict_modelos).find(modelo => modelo.codigo_de_barras_numeros === cod_ou_ref);
    //         if (modelo != undefined) {
    //             this.frm.set_value('artigo_a_editar', modelo.parent);
    //             this.desmontar_html_lancamento_manual();
    //             this.editar_item(modelo.parent, 1, 'Somar', 'artigos');
    //             this.editar_item(modelo.name, 1, 'Somar', 'modelos');
    //             this.frm.set_value('ref_ou_cb', '');
    //         } else {
    //             this.frm.set_value('artigo_a_editar', '');
    //         }
    //     }
    //     this.frm.set_value('ref_ou_cb', '');
    //     this.frm.refresh_field('ref_ou_cb');
    // },

    async processar_dados_inseridos(cod_ou_ref) {
        this.frm.set_value('ref_ou_cb', '');
        let artigo = Object.values(this.frm.dict_artigos).find(artigo => artigo.referencia === cod_ou_ref);
        if (artigo != undefined) {
            // logica de artigo
            this.frm.set_value('artigo_a_editar', artigo.name);

            try {
                await this.montar_html_lancamento_manual();
                const incrementValueElement = document.getElementById('increment_value');
                if (incrementValueElement) {
                    incrementValueElement.select();
                } else {
                    console.error('Campo increment_value não encontrado ou não acessível.');
                }
            } catch (error) {
                console.error(error);
            }
        } else {
            // logica de modelo de leitura de CODIGO DE BARRAS
            let modelo = Object.values(this.frm.dict_modelos).find(modelo => modelo.codigo_de_barras_numeros === cod_ou_ref);
            if (modelo != undefined) {
                this.frm.set_value('artigo_a_editar', modelo.parent);
                this.desmontar_html_lancamento_manual();
                await this.editar_item(modelo.parent, 1, 'Somar', 'artigos');
                await this.editar_item(modelo.name, 1, 'Somar', 'modelos');
                this.frm.set_value('ref_ou_cb', '');
            } else {
                this.frm.set_value('artigo_a_editar', '');
            }
        };
        try {
            // atualizar html mostrador com valor no campo frm.doc.artigo_a_editar
            let artigo = Object.values(this.frm.dict_artigos).find(artigo => artigo.name === this.frm.doc.artigo_a_editar);
            await this.atualizar_html_mostrador(artigo.name);
            this.frm.set_value('ref_ou_cb', '');
            this.frm.refresh_field('ref_ou_cb');
        } catch (error) {
            frappe.msgprint({
                title: __('Erro'),
                indicator: 'red',
                message: ('Valor: ' + cod_ou_ref + ' não localizado.')
            });
            frappe.utils.play_sound('error');
        }

    },


    async atualizar_html_mostrador(nome_artigo) {
        return new Promise((resolve) => {
            // atualizar artigos_do_pedido
            let dados = this.frm.doc.artigos_do_pedido.find(art => art.artigo === nome_artigo);
            console.log(dados)
            let tabelaHTML
            if (dados == undefined) {
                tabelaHTML = `
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Artigo</th>
                                <th>Quantidade Entregue</th>
                                <th>Quantidade Devolvida</th>
                                <th>Quantidade Vendida</th>
                            </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="artigo-cell" style="color: red;">${nome_artigo}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                    </table>
                 `;
            } else {
                tabelaHTML = `
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Artigo</th>
                            <th>Quantidade Entregue</th>
                            <th>Quantidade Devolvida</th>
                            <th>Quantidade Vendida</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="artigo-cell">${dados.artigo}</td>
                            <td>${dados.quantidade_entregue}</td>
                            <td>${dados.quantidade_devolvida}</td>
                            <td>${dados.quantidade_vendida}</td>
                        </tr>
                    </tbody>
                </table>
            `;
            }
            this.frm.fields_dict.html_mostrador.$wrapper.html(tabelaHTML);
            resolve();
        });
    },

    async montar_html_lancamento_manual() {
        // Insere o HTML no DOM
        return new Promise((resolve) => {
            this.frm.fields_dict.html_lancador_quantidade.$wrapper.html(`
            <div class="form-group custom-form">
                <label class="control-label">Quantidade</label>
                <div class="input-group">
                    <span class="input-group-btn">
                        <button class="btn btn-red btn-custom-lg btn-minus" type="button">-</button>
                    </span>
                    <input type="text" class="form-control" id="increment_value" value="0">
                    <span class="input-group-btn">
                        <button class="btn btn-green btn-custom-lg btn-plus" type="button">+</button>
                    </span>
                    <button id="botao_somar" class="btn btn-primary" type="button" style="margin-left: 10px;">Somar</button>
                    <button id="botao_subtrair" class="btn btn-primary" type="button" style="margin-left: 10px;">Subtrair</button>
                    </div>
            </div>
        `);

            // Remove event listeners anteriores, se existirem
            const botaoSomar = document.getElementById('botao_somar');
            const botaoSubstituir = document.getElementById('botao_substituir');
            const botaoSubtrair = document.getElementById('botao_subtrair');
            const btnMinus = this.frm.fields_dict.html_lancador_quantidade.$wrapper.find('.btn-minus');
            const btnPlus = this.frm.fields_dict.html_lancador_quantidade.$wrapper.find('.btn-plus');

            const incrementValueElement = document.getElementById('increment_value');
            if (incrementValueElement) {
                incrementValueElement.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        this.botao_manual_pressionado('Somar');
                    }
                });
            }

            if (botaoSomar) {
                botaoSomar.removeEventListener('click', this.botao_manual_pressionado);
                botaoSomar.addEventListener('click', () => this.botao_manual_pressionado('Somar'));
            } else {
                console.error('Elemento com ID "botao_somar" não encontrado.');
            }

            if (botaoSubstituir) {
                botaoSubstituir.removeEventListener('click', this.botao_manual_pressionado);
                botaoSubstituir.addEventListener('click', () => this.botao_manual_pressionado('Substituir'));
            } else {
            }

            if (botaoSubtrair) {
                botaoSubtrair.removeEventListener('click', this.botao_manual_pressionado);
                botaoSubtrair.addEventListener('click', () => this.botao_manual_pressionado('Subtrair'));
            }
            else {
                console.error('Elemento com ID "botao_substituir" não encontrado.');
            }

            if (btnMinus.length > 0) {
                btnMinus.off('click').on('click', function () {
                    // Lógica do evento de clique para o botão "-"
                    let incrementValue = parseInt($('#increment_value').val(), 10);
                    if (!isNaN(incrementValue) && incrementValue > 0) {
                        $('#increment_value').val(incrementValue - 1);
                    }
                });
            }

            if (btnPlus.length > 0) {
                btnPlus.off('click').on('click', function () {
                    // Lógica do evento de clique para o botão "+"
                    let incrementValue = parseInt($('#increment_value').val(), 10);
                    if (!isNaN(incrementValue)) {
                        $('#increment_value').val(incrementValue + 1);
                    }
                });
            }
            incrementValueElement.select();
            setTimeout(() => {
                const refOuCbElement = document.querySelector('[data-fieldname="ref_ou_cb"] input');
                if (refOuCbElement) {
                    refOuCbElement.focus();
                } else {
                    console.error('Campo ref_ou_cb não encontrado ou não acessível.');
                }
                resolve();
            }, 100);
        })

    },

    async botao_manual_pressionado(funcao) {
        // ira executar a logica ref > cod_barras padrao
        const artigo = this.frm.doc.artigo_a_editar;
        const quantidade = parseInt($('#increment_value').val()) || 0;
        const modelo = Object.values(this.frm.dict_modelos).find(modelo => modelo.parent === artigo && modelo.modelo_padrao === 1);
        await this.editar_item(artigo, quantidade, funcao, 'artigos');

        if (funcao == 'Substituir') {
            if (this.frm.doc.estado_acerto == 'Aberto') {
                this.logica_substituir_manual(artigo);
            }
        }
        await this.editar_item(modelo.name, quantidade, funcao, 'modelos');

        const refOuCbElement = document.querySelector('[data-fieldname="ref_ou_cb"] input');
        if (refOuCbElement) {
            refOuCbElement.focus();
        } else {
            console.error('Campo ref_ou_cb não encontrado ou não acessível.');
        };

        try {
            await this.atualizar_html_mostrador(artigo);
        } catch (error) {
            console.error(error);
        }

    },

    logica_substituir_manual: function (artigo) {
        // Verifique se tabela está definida corretamente
        let tabela = 'tabela_de_modelos';
        if (!tabela) {
            console.error('Tabela de modelos não definida.');
            return;
        }

        let registros = this.frm.doc[tabela];
        if (!Array.isArray(registros)) {
            console.error(`Registros para a tabela ${tabela} não são um array.`);
            return;
        }

        // Filtre e remova os registros com o campo "artigo" igual ao artigo fornecido
        let registrosParaRemover = registros.filter(registro => registro.artigo == artigo);
        registrosParaRemover.forEach(registro => {
            frappe.model.remove_from_locals(tabela, registro.name);
        });
        this.frm.doc[tabela] = registros.filter(registro => registro.artigo != artigo);

    },

    desmontar_html_lancamento_manual: function () {
        this.frm.fields_dict.html_lancador_quantidade.$wrapper.html('');
        this.alterar_visibidade_botao('botao_somar', false);
        this.alterar_visibidade_botao('botao_substituir', false);
    },

    alterar_visibidade_botao: function (button, display) {
        this.frm.toggle_display(button, display);
    },

    devolver_tudo: function () {
        this.frm.doc.artigos_do_pedido.forEach(artigo => {
            this.editar_item(artigo.artigo, artigo.quantidade_entregue, 'Substituir', 'artigos');
        });
        this.frm.doc.tabela_de_modelos.forEach(artigo => {
            this.editar_item(artigo.modelo, artigo.quantidade_entregue, 'Substituir', 'modelos');
        });
    },

    vender_tudo: function () {
        this.frm.doc.artigos_do_pedido.forEach(artigo => {
            this.editar_item(artigo.artigo, 0, 'Substituir', 'artigos');
        })
        this.frm.doc.tabela_de_modelos.forEach(artigo => {
            this.editar_item(artigo.modelo, 0, 'Substituir', 'modelos');
        });

    },

    /**
     * Edita um item na tabela de lançamento.
     * @param {string} item - O item a ser editado.
     * @param {number} quantidade - A quantidade a ser adicionada ou removida.
     * @param {string} modo - O modo de edição ('adicionar' ou 'remover').
     * @param {string} grid - O tipo de grid ('artigos' ou 'modelos').
     */
    editar_item: async function (item, quantidade, modo, grid) {
        const campo_alvo = this.get_campo_alvo();
        this.get_tabela_lancamento(grid);

        const registro = await this.encontrar_na_tabela(item, grid);

        if (registro) {
            this.editar_registro_na_tabela(registro, quantidade, modo, grid);
        } else {
            this.criar_registro_na_tabela(item, quantidade, grid);
        };

        calcular_valores_entregue_vendido(this.frm);
    },

    /**
     * Obtém o campo alvo para a operação.
     * @returns {string} - O nome do campo alvo.
     */
    get_campo_alvo: function () {
        // TODO - Criar o campo "Quantidade Conferida" e transformar em um switch case
        const campo_alvo = (this.frm.doc.estado_acerto == 'Fechando') ? 'quantidade_devolvida' : 'quantidade_entregue';
        return campo_alvo;
    },

    /**
     * Define a tabela de lançamento com base no grid fornecido.
     * @param {string} grid - O tipo de grid ('artigos' ou 'modelos').
     */
    get_tabela_lancamento: function (grid) {
        let tabela_lancamento;
        if (grid == 'artigos') {
            tabela_lancamento = this.tabela_de_artigos;
        } else if (grid == 'modelos') {
            tabela_lancamento = this.tabela_de_modelos;
        } else {
            console.log('Tabela de lançamento não encontrada.');
        };
        return tabela_lancamento;
    },

    /**
     * Encontra um item na tabela de lançamento.
     * @param {string} item - O item a ser encontrado.
     * @param {string} grid - O tipo de grid ('artigo' ou 'modelo').
     * @returns {Object|boolean} - O registro encontrado ou false se não encontrado.
     */
    encontrar_na_tabela: async function (item, grid) {
        let registro_found = false;
        const tabela_lancamento = this.get_tabela_lancamento(grid);
        for (let i = 0; i < this.frm.doc[tabela_lancamento].length; i++) {
            let registro = this.frm.doc[tabela_lancamento][i];
            if (grid == 'artigos') {
                if (registro.artigo === item) {
                    registro_found = registro;
                    break; // Interrompe a iteração
                }
            }
            else if (grid == 'modelos') {
                if (registro.modelo === item) {
                    registro_found = registro;
                    break; // Interrompe a iteração
                }
            }
        }
        return registro_found;
    },

    /**
     * Cria um novo registro na tabela de lançamento.
     * @param {string} item - O item a ser adicionado.
     * @param {number} quantidade - A quantidade do item.
     * @param {string} grid - O tipo de grid ('artigos' ou 'modelos').
     */
    criar_registro_na_tabela: async function (item, quantidade, grid) {
        const campo_alvo = this.get_campo_alvo();
        const tabela_lancamento = this.get_tabela_lancamento(grid);
        let registro;
        if (grid === 'artigos') {
            let preco = Object.values(this.frm.dict_precos).find(preco => preco.parent === item);
            preco = preco.preco;
            registro = {
                artigo: item,
                [campo_alvo]: quantidade,
                preco_etiqueta: preco
            };
            if (campo_alvo == 'quantidade_entregue') {
                registro.valor_total_entregue = quantidade * preco;
            }
        } else if (grid === 'modelos') {
            registro = {
                modelo: item,
                artigo: Object.values(this.frm.dict_modelos).find(modelo => modelo.name === item).parent,
                [campo_alvo]: quantidade,
            };
        };
        if (this.frm.estado_acerto == "Fechando") {
            this.frm.set_value('config_faturar_por', 'Artigo');
        }
        this.frm.add_child(tabela_lancamento, registro);
        this.frm.refresh_field(tabela_lancamento);
    },

    /**
     * Cria um novo registro na tabela de lançamento.
     * @param {string} item - O item a ser adicionado.
     * @param {number} quantidade - A quantidade do item.
     * @param {string} modo - O modo de edição ('somar', 'substituir', 'subtrair' ou 'remover').
     * @param {string} grid - O tipo de grid ('artigos' ou 'modelos').
     */
    editar_registro_na_tabela: function (registro, quantidade, modo, grid) {
        const campo_alvo = this.get_campo_alvo();
        const novo_valor = this.calcular_novo_valor(registro, quantidade, modo);
        frappe.model.set_value(registro.doctype, registro.name, campo_alvo, novo_valor);

        if (campo_alvo == 'quantidade_entregue') {
            frappe.model.set_value(registro.doctype, registro.name, 'valor_total_entregue', novo_valor * registro.preco_etiqueta);
        } else if (campo_alvo == 'quantidade_devolvida') {
            frappe.model.set_value(registro.doctype, registro.name, 'quantidade_vendida', registro.quantidade_entregue - registro.quantidade_devolvida);
            if (grid == "artigos") {
                // Apenas a tabela "artigos" calcula valores vendidos
                frappe.model.set_value(registro.doctype, registro.name, 'total_vendido', registro.quantidade_vendida * registro.preco_etiqueta);
            }
        }
    },

    calcular_novo_valor: function (registro, quantidade, modo) {
        const campo_alvo = this.get_campo_alvo();
        let quantidade_atual = registro[campo_alvo];
        switch (modo) {
            case 'Somar':
                return quantidade_atual + quantidade;
            case 'Substituir':
                return quantidade;
            case 'Subtrair':
                return quantidade_atual - quantidade;
            case 'Remover':
                return quantidade_atual - quantidade_atual;
        }
    },

    debounce: function (func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
};

function definir_foco(frm, campo) {
    setTimeout(function () {
        if (frm.fields_dict[campo] && frm.fields_dict[campo].input) {
            frm.fields_dict[campo].input.focus();
        } else {
            console.error(`Campo ${campo} não encontrado ou não acessível.`);
        }
    }, 500);
}

// TODO IMPLANTAÇÕES:
// - Adicionar botão de cancelar pedido
// - Mudar o calculo do total da fatura e outras execuções para serverSideScript

// TODO Ideiais:
// - Alterar para tabela HTML caso grid do frappe não se comporte bem nos celulares