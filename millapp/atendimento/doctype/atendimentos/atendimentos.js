// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.require(['/assets/millapp/js/utils.js'])

frappe.ui.form.on('Atendimentos', {
    async onload(frm) {
        try {
            let response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Configuracoes Gerais',
                }
            });
            let tabelaPrecoPadrao = response.message.tabela_preco_padrao;
            frm.set_value('tabela_precos', tabelaPrecoPadrao);
        } catch (error) {
            console.error('Erro ao buscar configurações gerais:', error);
        }
        if (frm.is_new()) {
            console.log('pedido novo')
            $.each(frm.fields_dict, function (fieldname, field) {
                frm.set_df_property(fieldname, 'hidden', 0);
            });
        }
    },
    refresh: function (frm) {
        // Layout Base
        $('button').off('click');
        frm.trigger('update_lista_pedidos');
        frm.disable_save(); // desativa botão salvar de cima

        frm.toggle_display('botao_criar_atendimento', (frm.doc.atendimento_state === 'Criado'));
        frm.toggle_enable('cliente', frm.doc.atendimento_state === 'Criado');

        frm.fields_dict.botao_criar_atendimento.$input.on('click', function () {
            criar_atendimento(frm);
        });
        frm.fields_dict.botao_atualizar_cadastro.$input.on('click', function () {
            atuliazar_dados_contato(frm);
        });
        frm.fields_dict.botao_abrir_whattsapp.$input.on('click', function () {
            abrir_whattsapp(frm.doc.telefone_principal);
        })

        // STATE: Iniciado
        frm.toggle_display('botao_novo_pedido', frm.doc.atendimento_state !== 'Criado' && frm.doc.atendimento_state !== 'Fechado');
        frm.fields_dict.botao_novo_pedido.$input.on('click', function () { criar_pedido(frm) });

    },
    update_lista_pedidos: function (frm) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Pedidos',
                filters: {
                    'atendimento': frm.doc.name
                },
                fields: ['name', 'data_criacao', 'data_acerto', 'pedido_state'],
                limit_page_length: 1000
            },
            callback: function (data) {
                let pedidos_html = `
                    <table id="pedidos_table" class="table table-bordered">
                        <thead>
                            <tr>
                                <th><a href="#" class="sort" data-sort="pedido" data-order="asc">Pedido</a></th>
                                <th><a href="#" class="sort" data-sort="data_criacao" data-order="asc">Data Criação</a></th>
                                <th><a href="#" class="sort" data-sort="data_acerto" data-order="asc">Data Acerto</a></th>
                                <th><a href="#" class="sort" data-sort="estado" data-order="asc">Estado</a></th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                if (data.message && data.message.length > 0) {
                    data.message.forEach(function (pedido) {
                        pedidos_html += `
                            <tr>
                                <td><a href="/app/pedidos/${pedido.name}" target="_blank">${pedido.name || 's/d'}</a></td>
                                <td>${pedido.data_criacao || 's/d'}</td>
                                <td>${pedido.data_acerto || 's/d'}</td>
                                <td>${pedido.pedido_state || 's/d'}</td>
                            </tr>`;
                    });
                } else {
                    pedidos_html += `
                        <tr>
                            <td colspan="4">Nenhum pedido encontrado.</td>
                        </tr>`;
                }

                pedidos_html += '</tbody></table>';

                // Define o HTML da tabela no campo
                frm.set_df_property('lista_pedidos_html', 'options', pedidos_html);
                frm.refresh_field('lista_pedidos_html');

                // Adiciona funcionalidades de ordenação
                frappe.after_ajax(function () {
                    const headers = document.querySelectorAll('#pedidos_table th a.sort');
                    headers.forEach(function (header) {
                        header.addEventListener('click', function (event) {
                            event.preventDefault();
                            const sortField = header.dataset.sort;
                            const currentOrder = header.dataset.order;
                            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
                            header.dataset.order = newOrder;

                            const table = document.getElementById('pedidos_table');
                            const tbody = table.querySelector('tbody');
                            const rows = Array.from(tbody.querySelectorAll('tr'));

                            const sortedRows = rows.sort((a, b) => {
                                const aText = a.querySelector(`td:nth-child(${header.parentElement.cellIndex + 1})`).innerText;
                                const bText = b.querySelector(`td:nth-child(${header.parentElement.cellIndex + 1})`).innerText;
                                return (newOrder === 'asc' ? 1 : -1) * aText.localeCompare(bText);
                            });

                            tbody.innerHTML = '';
                            sortedRows.forEach(row => tbody.appendChild(row));
                        });
                    });
                });
            },
            error: function (error) {
                console.error("Erro na chamada:", error);
            }
        });
    }

});

abrir_whattsapp = function (telefone) {
    telefone = telefone.replace(/\D/g, '');

    // Verifica se o telefone já tem o código de país +55
    if (!telefone.startsWith('55')) {
        telefone = '55' + telefone; // Adiciona o código do Brasil se necessário
    }

    if (telefone) {
        // Monta o link do WhatsApp com o número de telefone
        let whatsapp_url = `https://wa.me/${telefone}`;
        window.open(whatsapp_url, '_blank'); // Abre o WhatsApp em uma nova aba ou no app
    }
}

criar_atendimento = async function (frm) {
    try {
        if (!cliente_esta_preenchido(frm)) {
            frappe.msgprint(__('Por favor, preencha o campo Cliente antes de verificar.'));
            return;
        }

        const cliente = frm.doc.cliente;
        const [atendimentoAberto, pedidoAberto, faturamentoAberto] = await Promise.all([
            utils.tem_atendimento_aberto(cliente),
            utils.tem_pedido_aberto(cliente),
            utils.tem_faturamento_aberto(cliente)
        ]);

        if (atendimentoAberto) {
            frappe.msgprint(__('Já existe um atendimento aberto para este cliente.'));
        } else if (pedidoAberto) {
            frappe.msgprint(__('Já existe um pedido não faturado ou não entregue para este cliente.'));
        } else if (faturamentoAberto) {
            frappe.msgprint(__('Já existe um faturamento não pago para este cliente.'));
        } else {
            frm.set_value('atendimento_state', 'Iniciado');
            frm.set_value('data_inicio', frappe.datetime.now_datetime());
            atuliazar_dados_contato(frm);
        }

    } catch (error) {
        frappe.msgprint(__('Erro ao verificar dados: ') + error.message);
    }
};

criar_pedido = async function (frm) {
    try {
        const pedidoNovo = await utils.tem_pedido_aberto(frm.doc.cliente);
        if (pedidoNovo) {
            frappe.msgprint(__('Já existe um Pedido aberto para este cliente.'));
            return;
        }

        const faturamentoAberto = await utils.tem_faturamento_aberto(frm.doc.cliente);
        if (faturamentoAberto) {
            frappe.msgprint(__('Existe um faturamento em aberto ou em débito para este Cliente.'));
            return;
        }

        let campos_valores = {
            'cliente': frm.doc.cliente,
            'atendimento': frm.doc.name,
            'pedido_state': 'Pre-Criado',
            'config_tabela_precos': frm.doc.tabela_precos
        };

        if (frm.doc.data_visita) {
            campos_valores['data_entrega'] = frm.doc.data_visita;
        }

        const response = await frappe.call({
            method: 'millapp.api.criar_registro',
            args: {
                doctype: 'Pedidos',
                campos_valores: JSON.stringify(campos_valores)
            }
        });

        if (response.message) {
            window.location.href = `/app/pedidos/${response.message}`;
        } else {
            frappe.msgprint(__('Não foi possível criar o pedido.'));
        }
    } catch (error) {
        frappe.msgprint(__('Erro: ') + error.message);
    }
};

atuliazar_dados_contato = function (frm) {
    get_dados_contato(frm.doc.cliente).then(dados_contato => {
        if (dados_contato) {
            frm.set_value('telefone_principal', dados_contato.telefone);
            frm.set_value('rua', dados_contato.rua);
            frm.set_value('casa_complemento', dados_contato.casa + (dados_contato.complemento == null ? '' : ' ' + dados_contato.complemento));
            frm.set_value('bairro', dados_contato.bairro);
            frm.set_value('cidade', dados_contato.cidade);
            frm.set_value('estado', dados_contato.estado);
            frm.set_value('latitude', dados_contato.latitude);
            frm.set_value('longitude', dados_contato.longitude);
            frm.save();
        }
    }).catch(error => {
        frappe.msgprint(__('Erro ao buscar dados do contato: ') + error.message);
    });
}

get_dados_contato = function (cliente) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Contatos',
                name: cliente
            },
            callback: function (r) {
                if (r.message) {
                    resolve(r.message);
                } else {
                    resolve(null);
                }
            },
            error: function (error) {
                reject(error);
            }
        });
    });
};

cliente_esta_preenchido = function (frm) {
    if (!frm.doc.cliente) {
        frappe.msgprint(__('Por favor, preencha o campo Cliente antes de verificar.'));
        return false;
    }
    return true;
};
