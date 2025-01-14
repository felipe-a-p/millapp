// Copyright (c) 2025, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Localizador de Modelo"] = {
	filters: [
		{
			"fieldname": "artigo",
			"label": __("Artigo"),
			"fieldtype": "Link",
			"options": "Artigos",
			"reqd": 1,
			"on_change": function () {
				// Obter o valor selecionado no campo "artigo"
				const artigo = frappe.query_report.get_filter_value("artigo");
				console.log(artigo);
				// Verificar se o campo "artigo" foi preenchido
				if (!artigo) {
					frappe.msgprint(__("Por favor, selecione um Artigo primeiro."));
					return;
				}

				// Chamar a função get_data do campo "modelos"
				const modelos_filter = frappe.query_report.get_filter("modelos");
				if (modelos_filter) {
					modelos_filter.get_data().then(data => {
						// Definir os modelos como selecionados por padrão
						frappe.query_report.set_filter_value("modelos", data.map(modelo => modelo.value));
					});
				}
			}
		},
		{
			"fieldname": "modelos",
			"label": __("Modelos"),
			"fieldtype": "MultiSelectList",
			get_data: function (txt) {
				// Obter o valor selecionado no campo "artigo"
				const artigo = frappe.query_report.get_filter_value("artigo");
				console.log(artigo);
				// Verificar se o campo "artigo" foi preenchido
				if (!artigo) {
					frappe.msgprint(__("Por favor, selecione um Artigo primeiro."));
					return [];
				}

				// Chamada ao servidor para obter os modelos relacionados ao artigo
				return frappe.call({
					method: "millapp.apis.utils.get_filhos",  // Caminho para sua função
					args: {
						doctype: "Modelos de Artigos",  // O doctype que você está consultando
						parent_name: artigo  // Nome do Artigo selecionado
					}
				}).then(r => {
					const modelos = (r.message || []).map(modelo => ({
						value: modelo.name,
						description: modelo.name
					}));

					// Definir os modelos como selecionados por padrão
					frappe.query_report.set_filter_value("modelos", modelos.map(modelo => modelo.value));

					return modelos;
				});
			},
			"reqd": 1
		},
		{
			"fieldname": "estado_pedido",
			"label": __("Estado do Pedido"),
			"fieldtype": "MultiSelectList",
			"options": ["Separado", "Entregue"],
			"default": ["Separado", "Entregue"],
			"reqd": 1
		},
		{
			"fieldname": "data_maxima_acerto",
			"label": __("Acerto Até"),
			"fieldtype": "Date",
			"default": frappe.datetime.nowdate(),
		},
	],
};
