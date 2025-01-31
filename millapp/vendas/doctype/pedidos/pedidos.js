// Copyright (c) 2024, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.require(['/assets/millapp/js/utils.js'])

frappe.ui.form.on("Pedidos", {
    async onload(frm) {
        frm.dict_artigos = {};
        frm.dict_precos = {};
        frm.dict_modelos = {};

        frm.artigos_iniciais = frm.doc.artigos_do_pedido.map(artigo => ({
            artigo: artigo.artigo,
            quantidade_entregue: artigo.quantidade_entregue,
            quantidade_devolvida: artigo.quantidade_devolvida
        }));
    },
    before_save(frm) {
        calcular_valores_entregue_vendido(frm);
        frm.set_value('artigo_a_editar', '');
        let mudancas = comparar_mudancas_de_artigos(frm)
        // TODO IF status == entregue e houver mudanças alterar estoque da praça/semana
    },
    async refresh(frm) {
        document.querySelectorAll('button').forEach(button => {
            button.removeEventListener('click', () => { });
        });
        calcular_valores_entregue_vendido(frm);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = '/assets/millapp/css/custom.css';
        document.head.appendChild(link);

        adicionar_botoes(frm);

        frm.pedido = new Pedido(frm);

        if (frm.is_new() && !frm.doc.config_tabela_precos) {
            await frm.pedido.set_tabela_de_preco_padrao();
        }

        lancador.setup(frm, 'artigos_do_pedido', 'tabela_de_modelos');
        // Scripts
        let elementos = [
            { selector: 'button[data-fieldname="botao_criar_pedido"]', event: 'click', handler: () => frm.pedido.criar_pedido() },
            { selector: 'button[data-fieldname="botao_editar_itens"]', event: 'click', handler: () => frm.pedido.iniciar_lancamento() },
            { selector: 'button[data-fieldname="botao_salvar_itens"]', event: 'click', handler: () => frm.pedido.encerrar_lancamento() },
            { selector: 'button[data-fieldname="botao_encerrar_separacao"]', event: 'click', handler: () => frm.pedido.encerrar_lancamento(prox_etapa = true) },
            { selector: 'button[data-fieldname="botao_entregar_pedido"]', event: 'click', handler: () => frm.pedido.entregar_pedido() },
            { selector: 'button[data-fieldname="botao_iniciar_fechamento"]', event: 'click', handler: () => frm.pedido.iniciar_fechamento() },
            { selector: 'button[data-fieldname="botao_encerrar_fechamento"]', event: 'click', handler: () => frm.pedido.encerrar_fechamento() },
            { selector: 'button[data-fieldname="botao_leitor_retroativo"]', event: 'click', handler: () => lancador.botao_leitor_retorativo() },
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

        applyHandlers();

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
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
        frm.toggle_display('botao_criar_pedido', (frm.doc.pedido_state === 'Pre-Criado'));

        // State : Criado
        frm.toggle_display('botao_encerrar_separacao', (frm.doc.pedido_state == 'Criado'));

        // State : Separado
        frm.toggle_display('botao_entregar_pedido', (frm.doc.pedido_state == 'Separado' || frm.doc.pedido_state == 'Criado'));

        // State : Entregue
        frm.set_df_property('data_entrega', 'read_only', frm.doc.pedido_state == 'Entregue' || frm.doc.pedido_state == 'Fechado');

        // State : Faturado
        frm.toggle_display(
            'botao_iniciar_fechamento',
            frm.doc.pedido_state === 'Entregue' &&
            (frm.doc.estado_acerto === 'Aberto' || frm.doc.estado_acerto === 'Reaberto')
        );

        frm.toggle_display(
            'botao_encerrar_fechamento',
            frm.doc.pedido_state === 'Entregue' &&
            frm.doc.estado_acerto === 'Fechando'
        )

        frm.toggle_display(

        )
    },
    artigo_a_editar: function (frm) {
        if (frm.doc.artigo_a_editar) {
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
    acoes.setup(frm);
    frm.add_custom_button(__('God Mode'), function () {
        utils.god_mode(frm);
    }, "Administração");
    frm.add_custom_button(__('GerarFatura'), function () {
        if (frappe.user.has_role('Administração')) {
            frm.pedido.gerar_fatura();
        }
        else {
            frappe.msgprint(__('Você não tem permissão para gerar fatura'));
        }
    }, "Administração");
    frm.add_custom_button(__('Alterar Atendimento'), function () {
        alterar_atendimento(frm);
    }, "Administração");


    frm.add_custom_button(__('Criar Complemento'), function () {
        acoes.criar_complemento();
    }, "Ações");

    frm.add_custom_button(__('Reabrir Pedido'), function () {
        frm.pedido.reabrir_pedido();
    }, "Ações");


    frm.add_custom_button(__('Desempenho Consignação'), function () {
        frappe.set_route('query-report', 'Desempenho Consignado Cliente', {
            'contato': frm.doc.cliente
        });
    }, __("Relatórios"));
    frm.add_custom_button(__('Desempenho Artigos Consignados'), function () {
        frappe.set_route('query-report', 'Desempenho Artigos Consignados Cliente', {
            'contato': frm.doc.cliente
        });
    }, __("Relatórios"));
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
                    frm.set_value('pedido_state', 'Pre-Criado');
                    frm.set_value('data_entrega', values.data_entrega);
                    frm.set_value('data_acerto', null);
                    frm.save();
                    d.hide();
                } catch (error) {
                    console.error('Erro ao alterar o pedido:', error);
                }
            }
        });
        d.show()
    }
}

function comparar_mudancas_de_artigos(frm) {
    // TODO Fazer isso como uma tabela acessoria
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

        if (row.quantidade_vendida != null && row.quantidade_vendida !== 0) { // Verifique se o valor é diferente de null ou 0
            total_vendido_qtd_var += row.quantidade_vendida;
            total_vendido_vlr_var += row.total_vendido;
        }
    });

    // Atualizando os valores se necessário
    if (Math.abs((frm.doc.total_entregue_qtd ?? 0) - total_entregue_qtd_var) > 0.1) {
        frm.set_value('total_entregue_qtd', total_entregue_qtd_var);
        console.log('Updated total_entregue_qtd', Math.abs(frm.doc.total_entregue_qtd - total_entregue_qtd_var) > 0.1); // Log para atualização
    }

    if (Math.abs((frm.doc.total_entregue_vlr ?? 0) - total_entregue_vlr_var) > 0.1) {
        frm.set_value('total_entregue_vlr', total_entregue_vlr_var);
        console.log('Updated total_entregue_vlr', total_entregue_vlr_var); // Log para atualização
    }

    if (Math.abs((frm.doc.total_vendido_qtd ?? 0) - total_vendido_qtd_var) > 0.1) {
        frm.set_value('total_vendido_qtd', total_vendido_qtd_var);
        console.log('Updated total_vendido_qtd', total_vendido_qtd_var);
    }

    if (Math.abs((frm.doc.total_vendido_vlr ?? 0) - total_vendido_vlr_var) > 0.1) {
        frm.set_value('total_vendido_vlr', total_vendido_vlr_var);
        console.log('Updated total_vendido_vlr', Math.abs(frm.doc.total_vendido_vlr - total_vendido_vlr_var)) // Log para atualização
    }
}


class Pedido {
    constructor(frm) {
        this.frm = frm;
    }

    async nomear_pedido(novo_nome) {
        let velho_nome = this.frm.docname;
        frappe.call({
            method: "frappe.rename_doc",
            args: {
                doctype: "Pedidos",
                old: velho_nome,
                new: novo_nome,
            },
            callback: function (response) {
                if (response.message) {
                    this.frm.docname = response.message;
                    frappe.set_route('Form', 'Pedidos', response.message);
                } else {
                    frappe.msgprint(__('Erro ao renomear o registro.'));
                }
            }.bind(this)
        });
    }

    async set_tabela_de_preco_padrao() {
        try {
            let response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Configuracoes Gerais',
                }
            });
            let tabelaPrecoPadrao = response.message.tabela_preco_padrao;
            this.frm.set_value('config_tabela_precos', tabelaPrecoPadrao);
        } catch (error) {
            console.error('Erro ao buscar configurações gerais:', error);
        }
    }

    async criar_pedido() {
        if (this.frm.doc.cliente) {
            let temPedidoNovo = await utils.tem_pedido_novo(this.frm.doc.cliente);
            if (!temPedidoNovo) {
                const dataEntrega = this.frm.doc.data_entrega;
                if (dataEntrega && dataEntrega >= frappe.datetime.get_today()) {
                    this.frm.set_value('pedido_state', 'Criado');
                    if (!this.frm.doc.data_criacao) {
                        this.frm.set_value('data_criacao', frappe.datetime.now_datetime());
                    }
                    this.frm.set_value('data_acerto', frappe.datetime.add_days(dataEntrega, 48));
                    await this.definir_numero_pedido();
                    await this.frm.save();
                    frappe.call({
                        method: 'millapp.apis.utils.atualizar_campos',
                        args: {
                            doctype: 'Atendimentos',
                            name: this.frm.doc.atendimento,
                            campos_json: JSON.stringify({
                                'atendimento_state': 'Marcado',
                                'data_visita': dataEntrega
                            })
                        },
                        callback: function (response) {
                            if (response.message) {
                                frappe.msgprint(__('Pedido criado com sucesso!'));
                            }
                        }
                    });
                    const cliente = this.frm.doc.cliente;
                    let dados = await frappe.db.get_value('Contatos', cliente, 'cod_identificador')
                    let id = dados.message.cod_identificador
                    let novo_nome = `${this.frm.doc.tipo_pedido[0]}-C${id}/P${this.frm.doc.pedido_numero}`;
                    this.nomear_pedido(novo_nome);
                    return true;
                } else {
                    frappe.msgprint(__('A data de entrega tem de ser maior ou igual a hoje.'));
                    return false;
                }
            } else {
                frappe.msgprint(__('Já existe um pedido em aberto para este cliente.'));
                return false;
            }
        } else {
            // TODO Adicionar uma tabela de opções para funções que podem criar pedido sem cliente
            const roles_permitidas = ['Estoque', 'Administração'];
            if (roles_permitidas.some(role => frappe.user_roles.includes(role))) {
                frappe.confirm('O pedido a ser criado não possui cliente, deseja prosseguir para kit prototipo ?', async () => {
                    this.frm.set_value('pedido_state', 'Prototipo');
                    this.frm.set_value('data_criacao', frappe.datetime.now_datetime());
                    await this.frm.save();
                    const numeroAleatorio = Math.floor(10000 + Math.random() * 90000);
                    let novo_nome = "Prot " + numeroAleatorio;
                    this.nomear_pedido(novo_nome);
                })
            }
        }
    }

    async iniciar_lancamento() {
        if (this.frm.doc.pedido_state === 'Pre-Criado') {
            frappe.throw(__('Favor confirmar data e criar o pedido antes de editar os itens.'));
        } else if (this.frm.doc.pedido_state === 'Faturado') {
            frappe.throw(__('Você não tem permissão para editar itens de um pedido fechado, contate um administrador.'));
        } else {
            let estado_check_swap = this.frm.doc.check_swapper_edicao;
            this.frm.set_value('check_swapper_edicao', !estado_check_swap);
            this.frm.refresh_field('check_swapper_edicao');
            this.frm.set_df_property('modo_lancamento', 'read_only', 1);
            this.frm.toggle_display('ref_ou_cb', true);
            this.frm.toggle_display('artigo_a_editar', true);
            this.frm.toggle_display('html_lancador_quantidade', true);
            this.frm.toggle_display('botao_salvar_itens', true);
            this.frm.toggle_display('botao_editar_itens', false);
            await lancador.setup(this.frm, 'artigos_do_pedido', 'tabela_de_modelos');
            await lancador.montar_html_lancamento_manual();
        };
    }

    async encerrar_lancamento(prox_etapa = false) {
        this.frm.save()
            .then(() => {
                this.frm.toggle_display('ref_ou_cb', false);
                this.frm.toggle_display('artigo_a_editar', false);
                this.frm.toggle_display('html_lancador_quantidade', false);
                this.frm.toggle_display('botao_somar', false);
                this.frm.toggle_display('botao_substituir', false);
                this.frm.toggle_display('botao_salvar_itens', false);
                this.frm.toggle_display('botao_editar_itens', true);
                this.frm.set_df_property('modo_lancamento', 'read_only', 0)
                frappe.msgprint(__('Itens salvos com sucesso!'));
            })
            .catch((error) => {
                frappe.msgprint(__('Ocorreu um erro ao salvar os itens.'));
                console.error(error);
            });
        if (prox_etapa) {
            if (confirm('Deseja encerrar a separação e marcar o pedido como separado?')) {
                this.frm.set_value('pedido_state', 'Separado');
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
    }

    async entregar_pedido() {
        if (confirm('Tem certeza que deseja entregar o pedido?')) {
            let tipo_pedido = this.frm.doc.tipo_pedido;
            // TODO VERIFICAR SE NÃO HÁ FATURAMENTO EM ABERTO
            let fatura_aberta = false;
            if (fatura_aberta) {
                if (!confirm('Há uma fatura em aberto, deseja entregar mesmo assim?')) {
                    console.log('Entrega do pedido cancelada.');
                    return;
                }
            }
            if (tipo_pedido == "Complemento") {
                this.entregar_complemento();
            } else {
                this.frm.set_value('pedido_state', 'Entregue');
                this.frm.set_value('data_entregue', frappe.datetime.now_datetime());
                this.frm.save();
                frappe.call({
                    method: 'millapp.apis.utils.atualizar_campos',
                    args: {
                        doctype: 'Atendimentos',
                        name: this.frm.doc.atendimento,
                        campos_json: JSON.stringify({
                            'atendimento_state': 'Entregue',
                            'data_visita': this.frm.doc.data_acerto
                        })
                    },
                    callback: function (response) {
                        if (response.message) {
                            console.log('Campos atualizados:', response.message);
                        }
                    }
                });
            }
            // TODO Logica de logistica
        } else {
            console.log('Entrega do pedido cancelada.');
        }
    };

    async entregar_complemento() {
        frappe.call({
            method: 'millapp.apis.pedidos.entregar_complemento',
            args: {
                doc: JSON.stringify(this.frm.doc)
            }, callback: function (response) {
                if (response.message) {
                    window.location.href = `/app/pedidos/${response.message}`;
                } else {
                    frappe.msgprint(__('Erro ao tentar entregar o complemento.'));
                }
            }
        })
    };

    iniciar_fechamento() {
        this.frm.set_value('estado_acerto', 'Fechando');
        this.frm.save();
        this.frm.toggle_display('botao_iniciar_fechamento', false);
        this.frm.toggle_display('botao_encerrar_fechamento', true);
        this.iniciar_lancamento();

        if (this.frm.doc.artigos_do_pedido.some(artigo => artigo.quantidade_devolvida !== 0 || artigo.quantidade_vendida !== 0)) {
            frappe.prompt(
                {
                    label: "O que deseja fazer com o histórico existente?",
                    fieldname: "action",
                    fieldtype: "Select",
                    options: "Apagar\nManter",
                    reqd: 1
                },
                (values) => {
                    if (values.action === "Apagar") {
                        lancador.vender_tudo(); // Executa a ação de apagar histórico
                    } else {
                        frappe.msgprint("Histórico mantido."); // Opcional: Exibe mensagem de confirmação
                    }
                },
                "Atenção",
                "Confirmar"
            );
        } else {
            lancador.vender_tudo(); // Caso não haja itens com quantidade diferente de zero
        }
    };

    encerrar_fechamento() {
        if (confirm('Tem certeza que deseja fechar o pedido?')) {
            frappe.call({
                method: 'millapp.api.atualizar_campos',
                args: {
                    doctype: 'Atendimentos',
                    name: this.frm.doc.atendimento,
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
            this.frm.set_value('pedido_state', 'Faturado');
            this.frm.set_value('estado_acerto', 'Fechado');
            this.frm.save();
            this.gerar_fatura();
        }
    };

    async gerar_fatura() {
        const config_faturar_negativo = this.frm.doc.config_faturar_negativo;
        let itens_do_pedido;
        let artigos_faturados;

        if (this.frm.doc.config_faturar_por == "Artigo") {
            itens_do_pedido = this.frm.doc.artigos_do_pedido.filter(artigo => {
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
        } else if (this.frm.doc.config_faturar_por == "Modelo") {
            itens_do_pedido = this.frm.doc.tabela_de_modelos.filter(artigo => {
                return config_faturar_negativo ? artigo.quantidade_vendida !== 0 : artigo.quantidade_vendida > 0;
            });
            if (itens_do_pedido.length > 0) {
                artigos_faturados = itens_do_pedido.map(artigo => {
                    let preco_etiqueta = null;
                    if (this.frm.dict_precos) {
                        let preco_obj = Object.values(this.frm.dict_precos).find(preco => preco.parent === artigo.artigo);
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

        const existe = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: "Faturamentos",
                fields: ["name"],
                filters: { pedido: this.frm.doc.name },
                limit_page_length: 1,
            }
        }).then(response => {
            return response.message && response.message.length > 0 ? response.message[0].name : null;
        }).catch(error => {
            console.error('Erro ao verificar a existência:', error);
            return null;
        });


        const campos_faturamento = {
            'artigos_faturados': artigos_faturados,
            'faturamento_state': 'Aberto',
            'valor_liquido_fatura': 0,
            'desconto_pc': 0,
            'desconto_moeda': 0,
        };

        const metodo = existe ? 'millapp.apis.utils.atualizar_campos' : 'millapp.apis.utils.criar_registro';
        const args = existe
            ? { doctype: 'Faturamentos', name: existe, campos_json: JSON.stringify(campos_faturamento) }
            : {
                doctype: 'Faturamentos',
                campos_valores: JSON.stringify({
                    ...campos_faturamento,
                    'pedido': this.frm.doc.name,
                    'cliente': this.frm.doc.cliente,
                    'atendimento': this.frm.doc.name,
                    'origem': this.frm.doc.tipo_pedido,
                    'data_criacao': frappe.datetime.now_datetime(),
                    'data_vencimento': frappe.datetime.add_days(frappe.datetime.now_datetime(), 0),
                    'responsavel': this.frm.doc.responsavel,
                })
            };

        frappe.call({
            method: metodo,
            args: args,
            callback: function (response) {
                if (response.message) {
                    window.location.href = `/app/faturamentos/${response.message.name}`;
                }
            },
            error: function (error) {
                console.error('Erro na chamada do método:', error);
                frappe.msgprint(__('Erro ao tentar processar o faturamento.'));
            }
        });
    }


    async definir_numero_pedido() {
        await frappe.call({
            method: 'millapp.apis.pedidos.get_pedidos_cliente',
            args: {
                cliente: this.frm.doc.cliente
            },
            callback: (response) => {
                if (response.message) {
                    let pedidos_numero = response.message.map(pedido => pedido.pedido_numero);
                    let novo_numero = 1;
                    while (pedidos_numero.includes(novo_numero)) {
                        novo_numero++;
                    }
                    this.frm.set_value('pedido_numero', novo_numero);
                }
            }
        })
    }

    reabrir_pedido() {
        if (this.frm.doc.estado_acerto === 'Fechado') {
            // TODO criar configuração para definir o tempo de reabertura
            let prazo_reabertura = 7;
            let data_fechamento = this.frm.doc.data_fechamento;
            let data_atual = frappe.datetime.now_datetime();
            let diferenca = frappe.datetime.get_diff(data_atual, data_fechamento);
            if (diferenca <= prazo_reabertura) {
                this.frm.set_value('estado_acerto', 'Fechando');
                this.frm.set_value('pedido_state', 'Entregue');
            }
        }
    }
}

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

    botao_leitor_retorativo() {
        // confirm "deseja mudar para modo leitor retroativo?"
        // salvar doc
        // inverter o bool do cod_barras_retroativo
        if (confirm('Deseja mudar para o modo leitor retroativo?')) {
            console.log(this.frm)
            this.frm.set_value('cod_barras_retroativo', !this.frm.doc.cod_barras_retroativo);
            this.frm.save()
        }

    },

    async processar_dados_inseridos(cod_ou_ref) {
        this.frm.set_value('ref_ou_cb', '');
        cod_ou_ref = cod_ou_ref.replace(/^0+/, '');
        let artigo = Object.values(this.frm.dict_artigos).find(artigo => artigo.referencia === cod_ou_ref);
        if (artigo != undefined) {
            //REFERENCIA
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
                console.error("error:", error);
            }
        } else {
            // CODIGO DE BARRAS
            let modelo = Object.values(this.frm.dict_modelos).find(modelo => modelo.codigo_de_barras_numeros === cod_ou_ref);
            if (modelo != undefined) {
                this.frm.set_value('artigo_a_editar', modelo.parent);
                this.desmontar_html_lancamento_manual();
                let acao = 'Somar';
                if (this.frm.doc.cod_barras_retroativo) {
                    acao = 'Subtrair';
                }
                await this.editar_item(modelo.parent, 1, acao, 'artigos');
                await this.editar_item(modelo.name, 1, acao, 'modelos');
                this.frm.set_value('ref_ou_cb', '');
            } else {
                this.frm.set_value('artigo_a_editar', '');
            }
        };
        try {
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

            frappe.utils.play_sound('erro_longo');
        }

    },

    async atualizar_html_mostrador(nome_artigo) {
        return new Promise((resolve) => {
            // atualizar artigos_do_pedido
            let dados = this.frm.doc.artigos_do_pedido.find(art => art.artigo === nome_artigo);
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
        const artigo = this.frm.doc.artigo_a_editar;
        const quantidade = parseInt($('#increment_value').val()) || 0;
        const modelo = Object.values(this.frm.dict_modelos).find(modelo => modelo.parent === artigo && modelo.modelo_padrao === 1);
        await this.editar_item(artigo, quantidade, funcao, 'artigos');
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
        const pedido = this.frm.docname
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
            registro.name = `${item}-${pedido}-${quantidade}`;
        } else if (grid === 'modelos') {
            registro = {
                modelo: item,
                artigo: Object.values(this.frm.dict_modelos).find(modelo => modelo.name === item).parent,
                [campo_alvo]: quantidade,
            };
            registro.name = `${item}-${pedido}-${quantidade}`;
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

const acoes = {
    setup: function (frm) {
        this.frm = frm
    },

    alterar_atendimento: function () {
        estado = this.frm.doc.pedido_state;
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
                        let response = await frappe.db.get_value('Atendimentos', values.atendimento, 'cliente');
                        let cliente = response.message.cliente;

                        this.frm.set_value('atendimento', values.atendimento);
                        this.frm.set_value('cliente', cliente);
                        this.frm.set_value('pedido_state', 'Pre-Criado');
                        this.frm.set_value('data_entrega', values.data_entrega);
                        this.frm.set_value('data_acerto', null);
                        this.frm.save();
                        d.hide();
                    } catch (error) {
                        console.error('Erro ao alterar o pedido:', error);
                    }
                }
            });
            d.show()
        }
    },

    criar_complemento: function () {
        estado = this.frm.doc.pedido_state;
        tipo = this.frm.doc.tipo_pedido;
        if (tipo === "Consignação") {
            if (estado === 'Entregue') {
                frappe.call({
                    method: 'millapp.apis.pedidos.criar_complemento',
                    args: {
                        doc: JSON.stringify(this.frm.doc)
                    },
                    callback: function (response) {
                        if (response.message) {
                            frappe.set_route('Form', 'Pedidos', response.message);
                        }
                    }
                })
            }
            else {
                frappe.msgprint(__(`Você não pode criar um complemento de um pedido com status ${estado}`));
            }
        }
    },
}

// TODO IMPLANTAÇÕES:
// - Adicionar botão de cancelar pedido
// - Mudar o calculo do total da fatura e outras execuções para serverSideScript

// TODO Ideiais:
// - Alterar para tabela HTML caso grid do frappe não se comporte bem nos celulares