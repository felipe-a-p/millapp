// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.ui.form.on("Rotas", {
    before_save(frm) {
        if (frm.doc.rota_state === 'Em Rota') {
            if (frm.doc.lista_de_atendimentos.every(item => item.status_ponto === 'Completo' || item.status_ponto === 'Cancelado')) {
                frm.set_value('rota_state', 'Finalizada');
            }
        }
    },
    async onload(frm) {
        const centralDeDados = new CentralDeDados(frm);
        frm.centralDeDados = centralDeDados;
        const buscador = new Buscador(frm, frm.fields_dict['html_filtro_de_atendimentos'].wrapper, centralDeDados);
        frm.buscador = buscador;
    },

    async refresh(frm) {
        const listaInterativa = new ListaInterativa(frm, frm.fields_dict['html_lista_interativa'].wrapper, frm.centralDeDados);
        frm.listaInterativa = listaInterativa;

        if (!frm.mapInitialized) {
            const mapaInterativo = new MapaInterativo(frm, frm.fields_dict['html_mapa_interativo'].wrapper, frm.centralDeDados);
            await mapaInterativo.inicializar();

            frm.mapaInterativo = mapaInterativo;
            frm.mapInitialized = true;
        }
        switch (frm.doc.rota_state) {
            case 'Planejando':
            case 'Planejado':
                // se hoje for a data da rota, mudar o estado para Em Rota
                if (frm.doc.data === frappe.datetime.get_today()) {
                    frm.set_value('rota_state', 'Em Rota');
                }
                frm.save();
            case 'Em Rota':
                if (frm.doc.rota_state === "Em Rota") {
                    frm.set_df_property('rota_state', 'read_only', 1);
                }
            case 'Finalizado':
        }
        new ControleDeFormulario(frm);
        //frm.centralDeDados.carregarListaSalva()
        frm.buscador.buscar()

    },
});

class ControleDeFormulario {
    constructor(frm) {
        this.frm = frm;
        this.setupEvents();
    }

    setupEvents() {
        switch (this.frm.doc.rota_state) {
            case '-':
                this.frm.add_custom_button('Criar Rota', this.criarRota.bind(this));
                break
            case 'Planejando':
                this.frm.add_custom_button('Encerrar Planejamento', this.encerrarPlanejamento.bind(this));
                break
            case 'Planejada':
                this.frm.add_custom_button('Voltar para Planejamento', this.voltarPlanejamento.bind(this));
                break
            default:
                break
        }

    }

    addButton(container, label, action) {
        const button = document.createElement('button');
        button.innerText = label;
        button.onclick = action;
        container.appendChild(button);
    }

    criarRota() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Rotas',
                filters: {
                    data: this.frm.doc.data,
                    responsavel_de_atendimento: this.frm.doc.responsavel_de_atendimento
                },
                limit_page_length: 1
            },
            callback: (data) => {
                if (data.message.length > 0) {
                    frappe.msgprint('Já existe uma rota para este responsável nesta data');
                } else {
                    this.frm.set_value('rota_state', 'Planejando');
                    this.frm.save();
                }
            },
            error: function (error) {
                console.log(error);
            }
        });
    }

    encerrarPlanejamento() {
        const atualizar_proxima_visita = (atendimento, data) => {
            frappe.call({
                method: 'millapp.api.atualizar_campos',
                args: {
                    doctype: 'Atendimentos',
                    name: atendimento,
                    campos_json: JSON.stringify({
                        'data_visita': data
                    })
                }
            }).catch((error) => {
                console.error(error);
            }
            );
        }
        const atualizar_proxima_entrega = (atendimento, data) => {

            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Pedidos',
                    filters: {
                        atendimento: atendimento,
                        pedido_state: ['in', ['Separado', 'Criado']]
                    },
                    fields: ['name']
                }
            }).then((response) => {
                const pedidos = response.message;
                pedidos.forEach(pedido => {
                    frappe.call({
                        method: 'millapp.api.atualizar_campos',
                        args: {
                            doctype: 'Pedidos',
                            name: pedido.name,
                            campos_json: JSON.stringify({
                                'data_entrega': data,
                                'data_acerto': frappe.datetime.add_days(data, this.frm.doc.dias_para_proximo_acerto)
                            })
                        }
                    }).catch((error) => {
                        console.error(error);
                    });
                });
            }).catch((error) => {
                console.error(error);
            });
        }
        const atualizar_proximo_acerto = (atendimento, data) => {

            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Pedidos',
                    filters: {
                        atendimento: atendimento,
                        pedido_state: ['in', ['Entregue']]
                    },
                    fields: ['name']
                }
            }).then((response) => {
                const pedidos = response.message;
                pedidos.forEach(pedido => {
                    frappe.call({
                        method: 'millapp.api.atualizar_campos',
                        args: {
                            doctype: 'Pedidos',
                            name: pedido.name,
                            campos_json: JSON.stringify({
                                'data_acerto': data
                            })
                        }
                    }).catch((error) => {
                        console.error(error);
                    });
                });
            }).catch((error) => {
                console.error(error);
            });
        }

        const pode_fechar = this.frm.doc.lista_de_atendimentos.every(atendimento => {
            return atendimento.status_ponto === 'Marcado' && atendimento.hora_marcada !== '00:00';
        });

        if (pode_fechar) {
            this.frm.reload_doc().then(() => {
                this.frm.set_value('rota_state', 'Planejada');
                this.frm.save();
            }).catch(err => {
                frappe.msgprint('Erro ao atualizar o documento: ' + err.message);
            });
            const atendimentos = this.frm.doc.lista_de_atendimentos.map(atendimento => atendimento.atendimento);
            atendimentos.forEach(atendimento => {
                atualizar_proxima_visita(atendimento, this.frm.doc.data);
                atualizar_proxima_entrega(atendimento, this.frm.doc.data);
                atualizar_proximo_acerto(atendimento, this.frm.doc.data);
            });
        } else {
            frappe.msgprint('Existem atendimentos que não foram marcados, favor verificar')
        }
    }

    voltarPlanejamento() {
        this.frm.set_value('rota_state', 'Planejando');
        this.frm.save();
    }

    finalizarRota() {
        this.frm.set_value('rota_state', 'Finalizado');
        this.frm.save();
    }
}

class Buscador {
    constructor(frm, wrapper, centralDeDados) {
        this.frm = frm;
        this.wrapper = wrapper;
        this.centralDeDados = centralDeDados;
        this.render();
        this.setupEvents();
    }

    render() {
        // Todo - Adicionar Botão Buscar Lista de Rotas
        const buscadorHTML = `
            <div id="filtros" class="frappe-card">
                <form id="form-filtros" class="form-horizontal">
                    <div class="form-group row" id="date-selectors">
                        <div class="col-sm-6">
                            <label for="data-inicial" class="control-label">Data Inicial:</label>
                            <input type="date" id="data-inicial" name="data-inicial" class="form-control">
                        </div>
                        <div class="col-sm-6">
                            <label for="data-final" class="control-label">Data Final:</label>
                            <input type="date" id="data-final" name="data-final" class="form-control">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="cidades" class="control-label col-sm-2">Cidade:</label>
                        <div class="col-sm-10">
                            <select id="cidades" name="cidades" multiple class="form-control">
                            </select>
                            <button type="button" id="select-all-cidades" class="btn btn-secondary mt-2">Selecionar Todas</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="col-sm-12">
                            <button type="button" id="aplicar-filtros" class="btn btn-primary">Aplicar Filtros</button>
                        </div>
                    </div>
                </form>
            </div>
        `;
        this.wrapper.innerHTML = buscadorHTML;
    }

    setupEvents() {
        document.getElementById('data-inicial').addEventListener('change', () => {
            this.dataFiltroAlterada();
        });

        document.getElementById('data-final').addEventListener('change', () => {
            this.dataFiltroAlterada();
        });

        document.getElementById('select-all-cidades').addEventListener('click', () => {
            this.selecionarTodasCidades();
        });

        document.getElementById('aplicar-filtros').addEventListener('click', () => {
            this.buscar();
        });

        document.getElementById('cidades').addEventListener('change', () => {
            this.atualizarCidadesSelecionadas();
        });
    }

    corrigirAno(data) {
        const partes = data.split("-");
        if (partes.length === 3 && partes[0].startsWith("0")) {
            partes[0] = "2" + partes[0].substring(1);
        }
        return partes.join("-");
    }

    atualizarDatas() {
        this.dataInicial = document.getElementById('data-inicial').value;
        this.dataFinal = document.getElementById('data-final').value;
        this.dataInicial = this.corrigirAno(this.dataInicial);
        this.dataFinal = this.corrigirAno(this.dataFinal);
        if (this.dataInicial && this.dataFinal) {
            this.dataInicialISO = moment(this.dataInicial, 'YYYY-MM-DD').format('YYYY-MM-DD');
            this.dataFinalISO = moment(this.dataFinal, 'YYYY-MM-DD').format('YYYY-MM-DD');

        } else {
            this.dataInicialISO = null;
            this.dataFinalISO = null;
        }
    }

    dataFiltroAlterada() {
        const cidadesSelect = document.getElementById('cidades');
        this.atualizarDatas();
        if (this.dataInicial && this.dataFinal) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Atendimentos",
                    filters: [
                        ["data_visita", ">=", this.dataInicial],
                        ["data_visita", "<=", this.dataFinal]
                    ],
                    fields: ["distinct cidade"],
                    order_by: "cidade asc"
                },
                callback: (response) => {
                    if (response.message) {
                        let cidades = response.message.map(atendimento => atendimento.cidade);
                        cidadesSelect.innerHTML = cidades.map(cidade => `<option value="${cidade}">${cidade}</option>`).join('');
                        this.selecionarTodasCidades();
                    }
                }
            });
        } else {
            cidadesSelect.innerHTML = "<option>Por favor, selecione as datas inicial e final.</option>";
        }
    }

    atualizarCidadesSelecionadas() {
        const cidadesSelect = document.getElementById('cidades');
        this.cidadesSelecionadas = Array.from(cidadesSelect.selectedOptions).map(option => option.value);
    }

    selecionarTodasCidades() {
        const cidadesSelect = document.getElementById('cidades');
        const allSelected = Array.from(cidadesSelect.options).every(option => option.selected);
        for (let option of cidadesSelect.options) {
            option.selected = !allSelected;
        }
    }

    async buscar() {
        const data = this.frm.doc.data;
        this.atualizarCidadesSelecionadas();

        if (data) {
            let dados = await this.buscarNaRota();
            if (this.dataFinal && this.dataInicial) {
                let dadosFiltrados = await this.buscarFiltradas();
                dados = dados.concat(dadosFiltrados);
            }
            let complementos = await this.buscarComplementos(dados);
            dados = dados.concat(complementos);
            let promises = dados.map(dado => {
                return Promise.all([
                    this.verificarAcao(dado),
                    this.verificarStatusNaRota(dado)
                ]);
            });
            await Promise.all(promises).then(resultados => {
            }).catch(error => {
                console.error("Erro ao processar ações:", error);
            });
            this.centralDeDados.atualizarDados(dados);
        }
    }

    async buscarNaRota() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Atendimentos",
                    filters: [
                        ["name", 'in', this.centralDeDados.listaDeAtendimentos]
                    ],
                    fields: ["*"]
                },
                callback: function (response) {
                    resolve(response.message);
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    }

    async buscarFiltradas() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "frappe.client.get_list",
                // TODO - ultima_data_rota não esta entre 7 dias +/- de data 
                args: {
                    doctype: "Atendimentos",
                    filters: [
                        ["data_visita", ">=", this.dataInicial],
                        ["data_visita", "<=", this.dataFinal],
                        ["cidade", "in", this.cidadesSelecionadas],
                        ["name", 'not in', this.centralDeDados.listaDeAtendimentos]
                    ],
                    fields: ["*"]
                },
                callback: function (response) {
                    console.log('filtradas', response.message)
                    resolve(response.message);
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    }

    async buscarComplementos(dados) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Pedidos",
                    filters: [
                        ["tipo_pedido", "=", "Complemento"]
                    ],
                    fields: ["atendimento"]
                },
                callback: (response) => {
                    let listaAtendimentosComplemento = response.message.map(pedido => pedido.atendimento);
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Atendimentos",
                            filters: [
                                ["name", 'in', listaAtendimentosComplemento],
                                ["name", 'not in', this.centralDeDados.listaDeAtendimentos]
                            ],
                            fields: ["*"]
                        },
                        callback: function (response) {
                            console.log('complementos', response.message)
                            resolve(response.message);
                        },
                        error: function (error) {
                            reject(error);
                        }
                    });
                },
                error: function (error) {
                    reject(error);
                }
            });
        });
    }

    verificarAcao(dados) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Pedidos",
                    filters: [
                        ["atendimento", "in", [dados.name]], // Corrigido para ser uma lista
                        ["pedido_state", "in", ["Separado", "Entregue"]]
                    ],
                    fields: ["pedido_state", "tipo_pedido"]
                },
                callback: (response) => {
                    let acao = "";
                    let status = response.message.map(pedido => pedido.pedido_state);
                    let tipo_pedido = response.message.map(pedido => pedido.tipo_pedido);
                    if (tipo_pedido.includes("Complemento")) {
                        acao = "Complemento";
                    } else {
                        if (status.includes("Separado") && status.includes("Entregue")) {
                            acao = "Acerto e Entrega";
                        } else if (status.includes("Separado")) {
                            acao = "Entrega";
                        } else if (status.includes("Entregue")) {
                            acao = "Acerto";
                        }
                    }
                    dados.acao = acao;

                    Object.defineProperty(dados, 'acao', {
                        enumerable: true,
                        configurable: true,
                        writable: true,
                        value: acao
                    });
                    resolve(dados);
                },
                error: (error) => {
                    console.error("Erro ao buscar pedidos:", error);
                    reject(error);
                }
            });
        });
    }

    verificarStatusNaRota(dados) {
        return new Promise((resolve, reject) => {
            // verificar se está na rota, se não estiver o status é "Não na Rota", se estiver, o estádo está contido no campo status_ponto
            if (this.centralDeDados.listaDeAtendimentos.includes(dados.name)) {
                // verifica o status do ponto na grid lista_de_atendimentos
                const ponto = this.centralDeDados.frm.doc.lista_de_atendimentos.find(item => item.atendimento === dados.name);
                dados.status_rota = ponto.status_ponto;

            } else {
                dados.status_rota = "Não na Rota";
            }
            Object.defineProperty(dados, 'status_rota', {
                enumerable: true,
                configurable: true,
                writable: true,
                value: dados.status_rota
            });

            resolve(dados);
        });

    }
}

class CentralDeDados {
    constructor(frm) {
        this.observadores = [];
        this.dados = [];
        this.dadosExibicao = [];
        this.frm = frm
        this.listaDeAtendimentos = [];
        this.carregarListaSalva();
        this.reorganizarListaDeAtendimentos();
    }

    carregarListaSalva() {
        this.listaDeAtendimentos = this.frm.doc.lista_de_atendimentos.map(item => item.atendimento);
        this.reorganizarListaDeAtendimentos();
    }

    adicionarObservador(observador) {
        this.observadores.push(observador);
    }

    atualizarDados(dados) {
        this.dados = dados;
        this.dadosExibicao = dados;
        this.notificarObservadores();
    }

    notificarObservadores() {
        setTimeout(() => {
            this.observadores.forEach(observador => {
                if (typeof observador.atualizar === 'function') {
                    observador.atualizar(this.dadosExibicao);
                }
            });
        });
    }

    async adicionarARota(dado) {
        if (!this.listaDeAtendimentos.includes(dado.name)) {
            const novaLinha = this.frm.add_child('lista_de_atendimentos', {
                atendimento: dado.name,
                status: 'Planejado',
            });
            this.frm.refresh_field('lista_de_atendimentos');
            this.carregarListaSalva();
            await this.reorganizarListaDeAtendimentos();
            this.frm.save();
            frappe.call({
                method: 'millapp.api.atualizar_campos',
                args: {
                    doctype: 'Atendimentos',
                    name: dado.name,
                    campos_json: JSON.stringify({
                        'ultima_data_rota': this.frm.doc.data,
                    })
                }
            }).then((response) => {
            }).catch((error) => {
                console.error(error);
            });
        }
    }

    removerDaRota(dado) {
        // prompt do frappe para confirmar a remoção
        frappe.confirm('Deseja realmente remover este atendimento da rota?', () => {
            const linha = this.frm.doc.lista_de_atendimentos.find(item => item.atendimento === dado.name);
            if (linha) {
                const idx = this.frm.doc.lista_de_atendimentos.indexOf(linha);
                this.frm.doc.lista_de_atendimentos.splice(idx, 1);
                this.frm.refresh_field('lista_de_atendimentos');
                this.carregarListaSalva();
                this.reorganizarListaDeAtendimentos();
                this.frm.set_value('check_swapper_edicao', !this.frm.doc.check_swapper_edicao);
                this.frm.save();
                frappe.call({
                    method: 'millapp.api.atualizar_campos',
                    args: {
                        doctype: 'Atendimentos',
                        name: dado.name,
                        campos_json: JSON.stringify({
                            'ultima_data_rota': null,
                        })
                    }
                }).then((response) => {
                }).catch((error) => {
                    console.error(error);
                });
            }
        });
    }

    abirWhattsApp = function (telefone) {
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

    gerarLinkPinoMaps(latitude, longitude) {
        let maps_url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        window.open(maps_url, '_blank')
    }

    marcarHorario(dado) {
        frappe.prompt([
            {
                label: 'Horário',
                fieldname: 'horario',
                fieldtype: 'Time',
                reqd: 1
            }
        ], (values) => {
            let item = this.frm.doc.lista_de_atendimentos.find(atendimento => atendimento.atendimento === dado.name);
            if (item) {
                item.hora_marcada = values.horario;
                item.status_ponto = 'Marcado';
                this.frm.refresh_field('lista_de_atendimentos');
                this.frm.set_value('check_swapper_edicao', !this.frm.doc.check_swapper_edicao);
                this.reorganizarListaDeAtendimentos();
                this.frm.save();

            } else {
                frappe.msgprint('Erro ao marcar horário, favor comunicar o suporte');
            }
        }, 'Marcar Horário', 'Marcar');
        this.carregarListaSalva();
        this.notificarObservadores()
    }

    async reorganizarListaDeAtendimentos() {
        let listaDeAtendimentos = this.frm.doc.lista_de_atendimentos;
        listaDeAtendimentos.sort((a, b) => {
            return a.hora_marcada.localeCompare(b.hora_marcada);
        });
        listaDeAtendimentos.forEach((atendimento, index) => {
            atendimento.idx = index + 1;
        });
        // Atualizar a ordem dos atendimentos
        this.frm.doc.lista_de_atendimentos = listaDeAtendimentos;
        this.frm.refresh_field('lista_de_atendimentos');
    }

    chegadaNoDestinho(dado) {
        const linha = this.frm.doc.lista_de_atendimentos.find(item => item.atendimento === dado.name);
        if (linha) {
            frappe.confirm('Deseja realmente marcar a chegada no destino?', () => {
                this.frm.set_value('check_swapper_edicao', !this.frm.doc.check_swapper_edicao);
                linha.hora_conclusao = frappe.datetime.now_time();
                linha.status_ponto = 'Completo';
                // verificar se está completo ou cancelado

                this.frm.save();

                frappe.set_route('Form', 'Atendimentos', linha.atendimento);
            });
        }
    }

    cancelarAtendimento(dado) {
        const linha = this.frm.doc.lista_de_atendimentos.find(item => item.atendimento === dado.name);
        if (linha) {
            frappe.confirm('Deseja realmente cancelar este atendimento?', () => {
                this.frm.set_value('check_swapper_edicao', !this.frm.doc.check_swapper_edicao);
                linha.hora_conclusao = frappe.datetime.now_datetime();
                linha.status_ponto = 'Cancelado';
                this.frm.save();
                frappe.call({
                    method: 'millapp.api.atualizar_campos',
                    args: {
                        doctype: 'Atendimentos',
                        name: dado.name,
                        campos_json: JSON.stringify({
                            'ultima_data_rota': null,
                        })
                    }
                }).then((response) => {
                }).catch((error) => {
                    console.error(error);
                });
            })
        } else {
            frappe.msgprint('Erro ao marcar horário, favor comunicar o suporte');
        }
    }


}

class MapaInterativo {
    constructor(frm, wrapper, centralDeDados) {
        this.frm = frm;
        this.wrapper = wrapper;
        this.centralDeDados = centralDeDados;
        this.centralDeDados.adicionarObservador(this);
        this.mapa = null;
        this.pontoCentral = [-22.35136, -49.09525]; // todo - adicionar ponto central na configuração
        this.markerClusterGroup = null;
    }

    async inicializar() {
        try {
            await this.carregarLeaflet();
            this.initMap()
        } catch (error) {
            console.error('Erro ao inicializar o mapa:', error);
        }
    }

    // carregarScript(url) {
    //     return new Promise((resolve, reject) => {
    //         $.getScript(url)
    //             .done(() => resolve())
    //             .fail((jqxhr, settings, exception) => reject(new Error(`Erro ao carregar ${url}: ${exception} - ${jqxhr.status} ${jqxhr.statusText}`)));
    //     });
    // }

    carregarScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Erro ao carregar o script: ${url}`));
            document.head.appendChild(script);
        });
    }

    carregarLeaflet() {
        return new Promise((resolve, reject) => {
            if (!window.leafletLoaded) {
                window.leafletLoaded = true;
                $('head').append('<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />');
                $('head').append('<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css" />');
                $('head').append('<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css" />');

                Promise.all([
                    this.carregarScript('https://unpkg.com/leaflet/dist/leaflet.js'),
                    this.carregarScript('https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster-src.js'),

                ])
                    .then(() => resolve())
                    .catch(error => reject(error));
            } else {
                resolve();
            }
        });
    }

    async initMap() {
        // Verifica se o wrapper está disponível
        if (!this.wrapper) {
            console.error("Elemento wrapper não encontrado.");
            return;
        }

        if (!this.mapa) {
            // Define o tamanho do wrapper
            this.wrapper.style.height = "500px"; // Defina a altura conforme necessário
            this.wrapper.style.width = "100%"; // Defina a largura conforme necessário

            // Inicializa o mapa
            this.mapa = L.map(this.wrapper).setView(this.pontoCentral, 6); // Coordenadas iniciais e zoom

            // Adiciona a camada do mapa
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.mapa);

            // Inicializa o grupo de clusters de marcadores
            if (L.markerClusterGroup) {
                this.markerClusterGroup = L.markerClusterGroup();
                this.mapa.addLayer(this.markerClusterGroup);
            } else {
                await this.carregarScript('https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster-src.js');
                this.initMap();
            }
        }
    }

    getLayerPontos(dados) {
        const layer = L.layerGroup(); // Define a variável layer como um grupo de layers
        const layerPontos = [];

        dados.forEach(dado => {
            if (dado.latitude && dado.longitude) {
                let popupContent = `
                    <b>${dado.name}</b><br>
                    Ação: ${dado.acao}<br>
                    Data da Visita: ${dado.data_visita}<br>
                    Casa: ${dado.casa_complemento}<br>
                    <button class="chamar-wpp-btn" data-dado='${JSON.stringify(dado)}'>Enviar Mensagem</button>
                    <button class="rota-map-btn" data-dado='${JSON.stringify(dado)}'>Rota</button>

                `

                // verificar se o campo rota_state do frm está como Planejando
                if (this.frm.doc.rota_state === "Planejando" && !this.centralDeDados.listaDeAtendimentos.includes(dado.name)) {
                    popupContent += `<button class="adicionar-rota-btn" data-dado='${JSON.stringify(dado)}'>Adicionar a Rota</button>`
                }

                const marker = L.marker([dado.latitude, dado.longitude])
                    .bindPopup(popupContent);

                // Adiciona interatividade ao marcador
                marker.on('click', () => {
                    console.log(`Marcador clicado: ${dado.name}`);
                });
                marker.on('popupopen', () => {
                    document.querySelector('.chamar-wpp-btn').addEventListener('click', (event) => {
                        const dado = JSON.parse(event.target.getAttribute('data-dado'));
                        this.centralDeDados.abirWhattsApp(dado.telefone_principal);
                    });
                    document.querySelector('.rota-map-btn').addEventListener('click', (event) => {
                        const dado = JSON.parse(event.target.getAttribute('data-dado'));
                        this.centralDeDados.gerarLinkPinoMaps(dado.latitude, dado.longitude);
                    });
                    const adicionarRotaBtn = document.querySelector('.adicionar-rota-btn');
                    if (adicionarRotaBtn) {
                        adicionarRotaBtn.addEventListener('click', (event) => {
                            const dado = JSON.parse(event.target.getAttribute('data-dado'));
                            this.centralDeDados.adicionarARota(dado);
                        });
                    }
                });

                layerPontos.push(marker);
            }
        });

        layerPontos.forEach(marker => layer.addLayer(marker)); // Adiciona os marcadores ao grupo de layers
        return layer; // Retorna o grupo de layers
    }

    renderizarMapa(dados) {
        // Verifica se markerClusterGroup está inicializado
        if (!this.markerClusterGroup) {
            this.markerClusterGroup = L.markerClusterGroup();
            this.mapa.addLayer(this.markerClusterGroup);
        }

        // Limpa os marcadores existentes
        this.markerClusterGroup.clearLayers();

        const layerPontos = this.getLayerPontos(dados);
        this.markerClusterGroup.addLayer(layerPontos);

    }

    atualizar(dados) {
        this.renderizarMapa(dados);
    }
}

class ListaInterativa {
    constructor(frm, wrapper, centralDeDados) {
        this.wrapper = wrapper;
        this.centralDeDados = centralDeDados;
        this.frm = frm;
        this.centralDeDados.adicionarObservador(this);
    }

    renderizarLista(dados) {
        // Separar os dados em duas listas
        const atendimentos = this.centralDeDados.listaDeAtendimentos;
        const dadosNaLista = [];
        const dadosForaDaLista = [];
        this.wrapper.innerHTML = '';

        dados.forEach(dado => {
            if (atendimentos.includes(dado.name)) {
                dadosNaLista.push(dado);
            } else {
                dadosForaDaLista.push(dado);
            }
        });
        dadosNaLista.sort((a, b) => atendimentos.indexOf(a.name) - atendimentos.indexOf(b.name));
        const dadosOrdenados = [...dadosForaDaLista, ...dadosNaLista];

        const style = document.createElement('style');
        style.innerHTML = `
            table .status-planejado {
                background-color: yellow !important;
            }
            table .status-marcado {
                background-color: blue !important;
                color: white; /* Para garantir que o texto seja legível */
            }
            table .status-completo {
                background-color: green !important;
                color: white; /* Para garantir que o texto seja legível */
            }
            table .status-atrasado {
                background-color: red !important;
                color: white; /* Para garantir que o texto seja legível */
            }
            table .status-cancelado {
                background-color: gray !important;
                color: white !important; /* Para garantir que o texto seja legível */
            }

            .lista-interativa {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                padding: 0;
                list-style: none;
            }
            .lista-interativa ul {
                padding: 0;
                margin: 0;
            }
            .lista-interativa li {
                padding: 10px;
                border: 1px solid #ddd;
                margin-bottom: 5px;
                cursor: pointer;
                transition: background-color 0.3s;
            }
            .lista-interativa li:hover {
                background-color: #f0f0f0;
            }
            .lista-interativa li.selected {
                background-color: #d0eaff;
            }

            
        `;
        document.head.appendChild(style);


        // Criar um elemento de tabela
        const table = document.createElement('table');
        table.classList.add('table', 'table-striped');

        // Criar o cabeçalho da tabela
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        // Adicionar os cabeçalhos
        const headers = ['Atendimento', 'Horario', 'Cidade', 'Endereço', 'Ações'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Criar o corpo da tabela
        const tbody = document.createElement('tbody');
        // Adicionar as linhas da tabela
        dadosOrdenados.forEach(dado => {
            const row = document.createElement('tr');

            const atendimentoCell = document.createElement('td');
            atendimentoCell.textContent = dado.name;
            row.appendChild(atendimentoCell);

            const horarioCell = document.createElement('td');
            const atendimento = this.frm.doc.lista_de_atendimentos.find(at => at.atendimento === dado.name);

            // Verificar e exibir o valor de acao

            if (atendimento) {
                const acaoDescriptor = Object.getOwnPropertyDescriptor(dado, 'acao');
                horarioCell.textContent = `${atendimento.hora_marcada} - ${dado.acao}`;
            } else {
                horarioCell.textContent = `Não na Rota - ${dado.acao}`;
            }
            row.appendChild(horarioCell);

            const cidadeCell = document.createElement('td');
            cidadeCell.textContent = dado.cidade;
            row.appendChild(cidadeCell);

            const enderecoCell = document.createElement('td');
            enderecoCell.textContent = `${dado.rua}, ${dado.casa_complemento} - ${dado.bairro}`;
            enderecoCell.addEventListener('click', () => {
                this.centralDeDados.gerarLinkPinoMaps(dado.latitude, dado.longitude);
            })
            row.appendChild(enderecoCell);

            // Botões de ação
            const acoesCell = document.createElement('td');

            const btnChamarWpp = document.createElement('button');
            btnChamarWpp.textContent = 'Mensagem';
            btnChamarWpp.classList.add('btn', 'btn-primary');
            btnChamarWpp.addEventListener('click', () => {
                this.centralDeDados.abirWhattsApp(dado.telefone_principal);
            });

            const btnAdicionarARota = document.createElement('button');
            btnAdicionarARota.textContent = 'Adicionar a Rota';
            btnAdicionarARota.classList.add('btn', 'btn-primary');
            btnAdicionarARota.addEventListener('click', () => {
                this.centralDeDados.adicionarARota(dado);
            });

            const btnRemoverDaRota = document.createElement('button');
            btnRemoverDaRota.textContent = 'Remover da Rota';
            btnRemoverDaRota.classList.add('btn', 'btn-primary');
            btnRemoverDaRota.addEventListener('click', () => {
                this.centralDeDados.removerDaRota(dado);
            });

            const btnDefinirHorario = document.createElement('button');
            btnDefinirHorario.textContent = 'DefinirHorario';
            btnDefinirHorario.classList.add('btn', 'btn-primary');
            btnDefinirHorario.addEventListener('click', () => {
                this.centralDeDados.marcarHorario(dado);
            });

            const btnIniciarAtendimento = document.createElement('button');
            btnIniciarAtendimento.textContent = 'IniciarAtendimento';
            btnIniciarAtendimento.classList.add('btn', 'btn-primary');
            btnIniciarAtendimento.addEventListener('click', () => {
                this.centralDeDados.chegadaNoDestinho(dado);
            });

            const btnCancelarAtendimento = document.createElement('button');
            btnCancelarAtendimento.textContent = 'Cancelar Atendimento';
            btnCancelarAtendimento.classList.add('btn', 'btn-primary');
            btnCancelarAtendimento.addEventListener('click', () => {
                this.centralDeDados.cancelarAtendimento(dado);
            });

            acoesCell.appendChild(btnChamarWpp);

            switch (this.frm.doc.rota_state) {
                case 'Planejando':
                    acoesCell.appendChild(btnDefinirHorario);
                    if (!this.centralDeDados.listaDeAtendimentos.includes(dado.name)) {
                        acoesCell.appendChild(btnAdicionarARota);
                    }
                    else {
                        acoesCell.appendChild(btnRemoverDaRota);
                    }
                    break;
                case 'Em Rota':
                    acoesCell.appendChild(btnIniciarAtendimento);
                    acoesCell.appendChild(btnCancelarAtendimento);
                    break
            }

            switch (dado.status_rota) {
                case 'Planejado':
                    row.classList.add('status-planejado');
                    break;
                case 'Marcado':
                    row.classList.add('status-marcado');
                    break;
                case 'Completo':
                    row.classList.add('status-completo');
                    break;
                case 'Atrasado':
                    row.classList.add('status-atrasado');
                    break;
                case 'Cancelado':
                    row.classList.add('status-cancelado');
                    break;
                default:
                    break;
            }

            row.appendChild(acoesCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-responsive');
        tableContainer.appendChild(table);
        this.wrapper.appendChild(tableContainer);
    }

    atualizar(dados) {
        this.renderizarLista(dados);
    }
}


// TODO - Lista de implantações
// Marcadores personalizado
// Criar um unico style e fazer a lista de cores nele
// Layer de Rota 
// Permissões de usuarios para excluir/editar


// Cores por Status
// Planejado - Amarelo
// Marcado - azul
// Completo - Verde
// Atrasado - vermelho
// Cancelado - cinza
