// Copyright (c) 2024, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Forma de Recebimento"] = {
	filters: [
		{
			"fieldname": "start_date",
			"label": __("Data Inicial"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_days(frappe.datetime.get_today(), -7),
			"reqd": 1
		},
		{
			"fieldname": "end_date",
			"label": __("Data Final"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		}
	],
};
