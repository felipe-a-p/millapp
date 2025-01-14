// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

//TODO Criar logica para cod_identificador unico

frappe.ui.form.on("Contatos", {
    onload: function (frm) {
        atualizar_campos_visiveis_obrigatorios(frm);
    },
    refresh: function (frm) {
        add_system_buttons(frm);
    },
    validate: async function (frm) {
        await cpf_inserido(frm);
        if (frm.doc.pessoa == 'Fisica' || frm.doc.pessoa == 'MEI') {
            console.log(frm.cpf_instance)
            if (!frm.cpf_instance.valido) {
                frappe.msgprint(__('Impossivel de Salvar, CPF inválido.'));
                frappe.validated = false;
            }
        }

        if (frm.doc.pessoa == 'Juridica' || frm.doc.pessoa == 'MEI') {
            let cnpj = new Cnpj(frm.doc.cnpj);
            let cnpj_valido = await cnpj.validar();
            if (!cnpj_valido) {
                frappe.msgprint(__('CNPJ inválido.'));
                frappe.validated = false;
            }
        }
    },
    pessoa: function (frm) {
        atualizar_campos_visiveis_obrigatorios(frm);
    },
    cpf: async function (frm) {
        let cpf_var = frm.doc.cpf;
        if (cpf_var.length == 11) {
            await cpf_inserido(frm);
        }
    },
    cep: function (frm) {
        if (frm.doc.cep) {
            fetch(`https://cep.awesomeapi.com.br/json/${frm.doc.cep}`)
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        frappe.msgprint(__('CEP inválido.'));
                    } else {
                        frm.set_value('rua', data.address);
                        frm.set_value('bairro', data.district);
                        frm.set_value('cidade', data.city);
                        frm.set_value('estado', data.state);
                        frm.set_value('latitude', data.lat);
                        frm.set_value('longitude', data.lng);
                        frm.set_value('lat_long_por_api', true);
                    }
                })
                .catch(error => {
                    console.error('Erro:', error);
                    frappe.msgprint(__('Ocorreu um erro ao buscar os dados.'));
                });
        }
    }
});

function add_system_buttons(frm) {
    frm.add_custom_button(__('Desempenho Consignação'), function () {
        frappe.set_route('query-report', 'Desempenho Consignado Cliente', {
            'contato': frm.doc.name
        });
    }, __("Relatórios"));
    frm.add_custom_button(__('Desempenho Artigos Consignados'), function () {
        frappe.set_route('query-report', 'Desempenho Artigos Consignados Cliente', {
            'contato': frm.doc.name
        });
    }, __("Relatórios"));
}
async function cpf_inserido(frm) {
    let cpf = new Cpf(frm.doc.cpf, frm);
    frm.cpf_instance = cpf;
    if (cpf.real) {
        await cpf.validar();
        if (!cpf.valido) {
            frappe.validated = false
            let protocolo = new ProtocoloContatoDuplicado(frm, cpf);
            await protocolo.iniciar();
        } else {
            frappe.validated = true
        }
    } else {
        frappe.msgprint(__('CPF inválido.'));
        frappe.validated = false
    }
}

function atualizar_campos_visiveis_obrigatorios(frm) {
    var is_fisica_ou_mei = frm.doc.pessoa == 'Fisica' || frm.doc.pessoa == 'MEI';
    var is_juridica_ou_mei = frm.doc.pessoa == 'Juridica' || frm.doc.pessoa == 'MEI';

    frm.toggle_display('sobrenome', is_fisica_ou_mei);
    frm.toggle_display('cpf', is_fisica_ou_mei);
    frm.toggle_display('rg', is_fisica_ou_mei);
    frm.toggle_display('nascimento', is_fisica_ou_mei);
    frm.toggle_display('cnpj', is_juridica_ou_mei);

    frm.toggle_reqd('sobrenome', is_fisica_ou_mei);
    frm.toggle_reqd('cpf', is_fisica_ou_mei);
    //frm.toggle_reqd('nascimento', is_fisica_ou_mei);
    frm.toggle_reqd('cnpj', is_juridica_ou_mei);
}

class ProtocoloContatoDuplicado {
    constructor(frm, documento) {
        this.frm = frm;
        this.documento = documento;
    }

    async iniciar() {
        if (this.documento.duplicados.length > 1) {
            frappe.msgprint(__('Mais de um contato duplicado, favor comunicar o administrador.'));
            frappe.validated = false;
        } else {
            await this.obter_dono()
            await this.verificar_dono()
        }
    }

    async obter_dono() {
        try {
            const response = await frappe.call({
                method: 'millapp.apis.contatos.descobrir_dono',
                args: {
                    name: this.documento.duplicados[0]
                }
            });
            if (response.message) {
                this.dono = response.message[0].owner;
            }
        } catch (error) {
            console.error('Erro ao obter contato:', error);
            frappe.msgprint(__('Ocorreu um erro ao obter o contato.'));
        }
    }

    async verificar_dono() {
        if (this.dono != frappe.session.user) {
            frappe.msgprint({
                title: __('Notification'),
                message: __(`Este contato já possui registro no sistema, deseja verificar se está disponivel para compartilhamento?`),
                primary_action: {
                    label: __('Sim!'),  // Aqui é onde o botão "Aceitar" é definido
                    action: () => {
                        frappe.call({
                            method: 'millapp.apis.contatos.compartilhar_contatos',
                            args: {
                                user: frappe.session.user,
                                owner: this.dono,
                                contato: this.documento.duplicados[0]
                            },
                        }).then((data) => {
                            console.log(data)
                            if (data == "Compartilhado com sucesso") {
                                frappe.msgprint(__('Contato compartilhado com sucesso!'));
                                frappe.set_route('Form', 'Contatos', this.documento.duplicados[0]);
                                // TODO Notificar o velho dono
                            } else {
                                frappe.msgprint(__(`Erro ao compartilhar contato! ${data}`));
                            }
                        });
                    }
                }
            });
        } else {
            frappe.set_route('Form', 'Contatos', this.documento.duplicados[0]);
        }
    }

    async get_politcas() {
        await frappe.db.get_doc('Configuracoes de Users', this.contato.owner).then((doc) => {
            this.politicas_owner = doc
        })
        await frappe.db.get_doc('Configuracoes de Users', frappe.session.user).then((doc) => {
            this.politicas_user = doc
        })
    }
}

class DocumentoVerificavel {
    constructor(documento, frm, tipo) {
        this.documento = documento;
        this.tipo = tipo;
        this.real = this.validarDocumento();
        this.valido = false;
        this.duplicados = [];
        this.frm = frm
    }

    async validar() {
        const docName = this.frm.doc.name
        console.log(docName, '-')
        const isDuplicado = await this.verificarDuplicidade(docName);
        this.valido = this.real && !isDuplicado;
        return this.valido;
    }

    validarDocumento() {
        return false; // Implementado nas subclasses
    }

    async verificarDuplicidadebkp() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'millapp.apis.contatos.verificar_documento',
                args: {
                    documento: this.documento,
                    tipo: this.tipo
                },
                callback: (data) => {
                    if (data.message) {
                        this.duplicados = data.message.map(d => d.name);
                        if (data.message.length > 0) {
                            if (data.message.length <= 1) {
                                if (data.message[0].name == frm.doc.name) {
                                    resolve(false);
                                }
                            }
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } else {
                        reject('Erro ao verificar duplicidade');
                    }
                }
            });
        });
    }

    async verificarDuplicidade(docName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'millapp.apis.contatos.verificar_documento',
                args: {
                    documento: this.documento,
                    tipo: this.tipo
                },
                callback: (data) => {
                    if (data.message) {
                        this.duplicados = data.message.map(d => d.name);
                        if (data.message.length > 0) {
                            if (data.message.length <= 1) {
                                if (data.message[0].name == docName) {
                                    resolve(false);
                                }
                            }
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } else {
                        reject('Erro ao verificar duplicidade');
                    }
                }
            });
        });
    }

    ehSequenciaRepetida(doc, tamanho) {
        const sequenciasInvalidas = [
            '00000000000', '11111111111', '22222222222',
            '33333333333', '44444444444', '55555555555',
            '66666666666', '77777777777', '88888888888',
            '99999999999'
        ];
        return sequenciasInvalidas.includes(doc.substring(0, tamanho));
    }
}

class Cpf extends DocumentoVerificavel {
    constructor(cpf, frm) {
        super(cpf, frm, 'cpf');
        this.real = this.validarDocumento();
    }

    validarDocumento() {
        let cpf = this.documento.replace(/[^\d]+/g, '');

        if (cpf.length !== 11 || this.ehSequenciaRepetida(cpf, 11)) {
            return false;
        }

        return this.validarDigitosVerificadores(cpf);
    }

    validarDigitosVerificadores(cpf) {
        let add = 0, rev;

        for (let i = 0; i < 9; i++) {
            add += parseInt(cpf.charAt(i)) * (10 - i);
        }
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;

        add = 0;
        for (let i = 0; i < 10; i++) {
            add += parseInt(cpf.charAt(i)) * (11 - i);
        }
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(10))) return false;

        return true;
    }
}

class Cnpj extends DocumentoVerificavel {
    constructor(cnpj) {
        super(cnpj, 'cnpj');
        this.real = this.validarDocumento();
    }

    validarDocumento() {
        let cnpj = this.documento.replace(/[^\d]+/g, '');

        if (cnpj.length !== 14 || this.ehSequenciaRepetida(cnpj, 14)) {
            return false;
        }

        return this.validarDigitosVerificadores(cnpj);
    }

    validarDigitosVerificadores(cnpj) {
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0, pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(0))) return false;

        tamanho++;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        return resultado === parseInt(digitos.charAt(1));
    }
}

// TODO Logica para Cnpj