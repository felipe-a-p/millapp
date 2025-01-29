// Copyright (c) 2025, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Fechamento Financeiro"] = {
	filters: [
		{
			"fieldname": "data_inicial",
			"label": __("Data Inicial"),
			"fieldtype": "Date",
			"reqd": 1,
		},
		{
			"fieldname": "data_final",
			"label": __("Data Final"),
			"fieldtype": "Date",
			"reqd": 1,
		},
		{
			"fieldname": "responsavel",
			"label": __("Responsável"),
			"fieldtype": "Link",
			"options": "User",
		}
	],
};
