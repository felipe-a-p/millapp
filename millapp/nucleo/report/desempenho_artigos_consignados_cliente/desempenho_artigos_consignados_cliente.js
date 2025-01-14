// Copyright (c) 2025, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Desempenho Artigos Consignados Cliente"] = {
	filters: [
		{
			"fieldname": "contato",
			"label": __("Contato"),
			"fieldtype": "Link",
			"options": "Contatos",
			"reqd": 1,
		},
		{
			"fieldname": "ultimos_x_pedidos",
			"label": __("Últimos X Pedidos"),
			"fieldtype": "Int",
			"default": 3,
			"reqd": 1,
		},
		{
			"fieldname": "agrupar_por",
			"label": __("Agrupar por"),
			"fieldtype": "Select",
			"options": ["Artigos", "SubGrupos", "Grupos"],
			"default": "Artigos",
			"reqd": 1,
		}
	],
};
