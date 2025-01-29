// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Desempenho do Artigo"] = {
	filters: [
		{
			fieldname: "artigos",
			label: __("Artigos"),
			fieldtype: "MultiSelectList",
			reqd: 0,
			get_data: function (txt) {
				return frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Artigos",
						fields: ["name"],
						filters: txt ? [["name", "like", `%${txt}%`]] : [],
						limit_page_length: 2000
					}
				}).then(r => {
					return (r.message || []).map(artigo => ({
						value: artigo.name,
						description: artigo.name
					}));
				});
			}
		},
		{
			fieldname: "relatorios",
			label: __("Relatórios"),
			fieldtype: "MultiSelectList",
			reqd: 1,
			get_data: function (txt) {
				relatorios = [
					{ name: "TimeSeries", description: "Desempenho mensal" },
					{ name: "BCG", description: "Análise de Ciclo de Vida do Produto" },
				]
				return (relatorios || []).map(relatorio => ({
					value: relatorio.name,
					description: relatorio.description
				}));

			}
		},
		{
			"fieldname": "data_inicial",
			"label": __("Data Inicial"),
			"fieldtype": "Date",
		},
		{
			"fieldname": "data_final",
			"label": __("Data Final"),
			"fieldtype": "Date",
		}
	],
};
