// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.ui.form.on("Faturamentos", {
    onload: function (frm) {
    },
    refresh(frm) {
        document.querySelectorAll('button').forEach(button => {
            button.removeEventListener('click', () => { });
        });
        Faturamento.setup(frm);

        frm.fields_dict.botao_novo_pagamento.$input.on('click', () => {
            Pagamento.setup(frm);
        });
        frm.fields_dict.botao_calcular_desconto.$input.on('click', () => {
            calcular_desconto(frm);
        });


        frm.fields_dict['pagamentos'].grid.wrapper.find('.grid-add-row').hide();
        frm.fields_dict['pagamentos'].grid.wrapper.find('.grid-row').each(function () {
            $(this).find('input').attr('readonly', true);
        });
        if (frm.doc.faturamento_state == 'Aberto') {
            frm.add_custom_button(__('Limpar Pagamentos'), function () {
                Faturamento.limpar_pagamentos();
            });
        }
    },
});

async function calcular_desconto(frm) {
    const tipo_faturamento = frm.doc.origem;
    // TODO logica para editar desconto
    const edita_desconto = false
    const valor_bruto_fatura = frm.doc.valor_bruto_fatura;
    let desconto_aplicado = 0;

    if (edita_desconto) {
        // criar prompt para inserir desconto
    } else {
        const descontos = await frappe.call({
            method: 'millapp.api.get_descontos',
            args: {
                tipo: tipo_faturamento
            }
        });
        descontos.message.forEach(desconto => {
            if (valor_bruto_fatura >= desconto.de && (valor_bruto_fatura <= desconto.ate || desconto.ate == 0)) {
                desconto_aplicado = desconto.pc_desconto;
            }
        });
    }

    const valor_desconto = (valor_bruto_fatura * desconto_aplicado) / 100;
    const valor_liquido = Math.round((valor_bruto_fatura - valor_desconto) * 10) / 10;

    frm.set_value('desconto_pc', desconto_aplicado);
    frm.set_value('desconto_moeda', valor_desconto);
    frm.set_value('valor_liquido_fatura', valor_liquido);
    calcular_valor_restante(frm);
}

function calcular_valor_pago(frm) {
    let total = 0;
    frm.doc.pagamentos.forEach(pagamento => {
        total += pagamento.valor;
    });
    frm.set_value('total_pago', total);
    frm.refresh_field('total_pago');
    calcular_valor_restante(frm);
};

function calcular_valor_restante(frm) {
    const valor_restante = frm.doc.valor_liquido_fatura - frm.doc.total_pago;
    frm.set_value('valor_restante', valor_restante);
    frm.refresh_field('valor_restante');
    if (valor_restante == 0 && frm.doc.total_pago > 0) {
        frm.set_value('faturamento_state', 'Pago');
    }
};

const Faturamento = {
    setup(frm) {
        this.frm = frm;
        this.calcular_fatura_bruta();
    },

    calcular_fatura_bruta() {
        let total = 0;
        this.frm.doc.artigos_faturados.forEach(item => {
            total += item.valor_bruto;
        });
        this.frm.set_value('valor_bruto_fatura', total);
        calcular_valor_restante(this.frm);
    },
    async limpar_pagamentos() {
        frappe.confirm('Deseja realmente limpar os pagamentos?', () => {
            this.frm.clear_table('pagamentos');
            this.frm.clear_table('cheques');
            this.frm.set_value('total_pago', 0);
            this.frm.set_value('valor_restante', this.frm.doc.valor_liquido_fatura);
            this.frm.set_value('faturamento_state', 'Aberto');
            this.frm.save();
        }, () => {
            frappe.msgprint(__('Ação cancelada.'));
        });
    }
}

const Pagamento = {
    dialog: null,
    chequeDialog: null,
    chequeValues: {},

    async setup(frm) {
        this.frm = frm;
        this.initializeMainDialog();
        this.resetDialogFields();
        this.updateDialogTitle(frm.doc.valor_restante);
        this.dialog.show();
    },

    initializeMainDialog() {
        if (this.dialog) return;

        this.dialog = new frappe.ui.Dialog({
            title: '',
            fields: this.getMainDialogFields(),
            primary_action: async () => this.handlePrimaryAction(),
        });

        $(this.dialog.$wrapper)
            .find('.modal-title')
            .addClass('dialog-title-blue');
    },

    getMainDialogFields() {
        return [
            {
                fieldname: "tipo",
                fieldtype: "Select",
                label: "Tipo",
                reqd: 1,
                options: "A Vista\nA Prazo",
                change: () => this.updateMetodoOptions(),
            },
            {
                fieldname: "metodo",
                fieldtype: "Select",
                label: "Forma de Pagamento",
                options: '',
                visible: 0,
                reqd: 1,
                change: () => this.handleMetodoChange(),
            },
            {
                fieldname: "valor",
                fieldtype: "Currency",
                label: "Valor",
                reqd: 1,
            },
            {
                fieldname: "data",
                fieldtype: "Date",
                label: "Data",
                reqd: 1,
                default: frappe.datetime.now_date(),
            }
        ];
    },

    async handlePrimaryAction() {
        const valores = this.dialog.get_values();
        if (!this.validatePaymentAmount(valores.valor)) return;

        const dadosPagamento = {
            ...valores,
            ...this.chequeValues,
        };

        try {
            await this.registrarPagamento(dadosPagamento);
            this.updateFaturamentoState();
            await this.frm.save();
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            frappe.msgprint('Erro ao registrar pagamento.');
        }

        this.dialog.hide();
    },

    validatePaymentAmount(valor) {
        if (valor <= 0 || valor > this.frm.doc.valor_restante) {
            frappe.msgprint(
                'O valor do pagamento deve ser positivo e não pode ser maior que o valor restante.'
            );
            console.log(valor, this.frm.doc.valor_restante);
            return false;
        }
        return true;
    },

    async registrarPagamento(dados) {
        const camposPagamento = {
            tipo: dados.tipo,
            metodo: dados.metodo,
            valor: dados.valor,
            data: dados.data,
        };

        if (dados.metodo === "Cheque") {
            await this.registrarCheque(dados);
        }

        this.frm.add_child('pagamentos', camposPagamento);
        this.frm.refresh_field('pagamentos');
    },

    async registrarCheque(dados) {
        const camposCheque = this.getChequeFields(dados);
        this.frm.add_child('cheques', camposCheque);
        this.frm.refresh_field('cheques');
    },

    getChequeFields(dados) {
        return {
            tipo_de_transacao: "Recebido",
            status_cheque: "Entregue",
            nome_emissor: dados.emissor || "Não informado",
            banco_numeros: parseInt(dados.banco_digitos) || null,
            banco_nome: dados.banco_nome || null,
            agencia: parseInt(dados.agencia) || null,
            conta: dados.conta || null,
            cheque_num: dados.cheque || null,
            valor: parseFloat(dados.valor) || 0,
            data_depositar: dados.data_deposito || frappe.datetime.now_date(),
            contato: this.frm.doc.cliente || "Não informado",
        };
    },

    updateMetodoOptions() {
        const METODO_OPTIONS = {
            "A Vista": "Dinheiro\nDébito\nPix",
            "A Prazo": "Crédito\nCheque\nBoleto\nDepósito",
        };

        const tipo = this.dialog.get_value('tipo');
        const metodoField = this.dialog.fields_dict['metodo'];
        metodoField.df.visible = 1;
        metodoField.df.options = METODO_OPTIONS[tipo] || '';
        metodoField.df.read_only = 0;
        metodoField.refresh();
    },

    handleMetodoChange() {
        if (this.dialog.get_value('metodo') === "Cheque") {
            this.showChequeDialog();
        }
    },

    showChequeDialog() {
        if (!this.chequeDialog) {
            this.chequeDialog = new frappe.ui.Dialog({
                title: 'Detalhes do Cheque',
                fields: this.getChequeDialogFields(),
                primary_action: () => {
                    this.chequeValues = this.chequeDialog.get_values();
                    this.chequeDialog.hide();
                },
            });
        }
        this.chequeDialog.show();
    },

    getChequeDialogFields() {
        return [
            { fieldname: "emissor", fieldtype: "Data", label: "Nome Emissor" },
            {
                fieldname: "banco_digitos",
                fieldtype: "Int",
                label: "Banco (digitos)",
                change: async () => {
                    const bancoDigitos = this.chequeDialog.get_value("banco_digitos");
                    if (!bancoDigitos) return;

                    try {
                        const response = await fetch(`https://brasilapi.com.br/api/banks/v1/${bancoDigitos}`);
                        if (response.ok) {
                            const data = await response.json();
                            this.chequeDialog.set_value("banco_nome", data.name || "Banco não encontrado");
                        } else {
                            this.chequeDialog.set_value("banco_nome", "Banco não encontrado");
                        }
                    } catch (error) {
                        console.error("Erro ao buscar banco:", error);
                        this.chequeDialog.set_value("banco_nome", "Erro ao buscar banco");
                    }
                },
            },
            { fieldname: "banco_nome", fieldtype: "Data", label: "Banco (Nome)", read_only: 1 },
            { fieldname: "agencia", fieldtype: "Int", label: "Agência" },
            { fieldname: "conta", fieldtype: "Data", label: "Conta" },
            { fieldname: "cheque", fieldtype: "Data", label: "Cheque" },
            { fieldname: "data_deposito", fieldtype: "Date", label: "Data para Depósito" },
        ];
    },

    resetDialogFields() {
        this.dialog.set_value('tipo', '');
        this.dialog.set_value('metodo', '');
        this.dialog.set_value('valor', '');
        this.dialog.set_value('data', frappe.datetime.now_date());
        this.dialog.fields_dict['metodo'].df.visible = 0;
        this.chequeValues = {};
    },

    updateDialogTitle(valorRestante) {
        this.dialog.set_title('Valor restante: R$' + valorRestante.toFixed(2));
    },

    updateFaturamentoState() {
        calcular_valor_pago(this.frm);
        calcular_valor_restante(this.frm);

        if (this.frm.doc.valor_restante <= 0) {
            this.frm.set_value('faturamento_state', 'Pago');
            frappe.msgprint('Faturamento Quitado!');
        } else {
            frappe.msgprint('Pagamento registrado com sucesso.');
        }
    },
};


// TODO CHEQUES
// TODO Adicionar taxas (nas config e nos calculos)
// TODO adicionar configuracao de tipos de pagamento disponiveis para cada usuario
// TODO ao finalizar pagamento, voltar para pagina de atendimento e atualizar o status do faturamento no pedido
// TODO criar doctype e logica de boletos
