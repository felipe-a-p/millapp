frappe.query_reports["Desempenho Consignado"] = {
	filters: [
		{
			"fieldname": "contato",
			"label": __("Contato"),
			"fieldtype": "Link",
			"options": "Contatos",
			"reqd": 1,
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
