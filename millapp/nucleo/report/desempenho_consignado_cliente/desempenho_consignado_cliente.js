frappe.query_reports["Desempenho Consignado Cliente"] = {
	filters: [
		{
			"fieldname": "contato",
			"label": __("Cliente"),
			"fieldtype": "Link",
			"options": "Contatos",
			"reqd": 1,
		},
		{
			"fieldname": "relatorios_avancados",
			"label": __("Relatórios Avançados"),
			"fieldtype": "MultiSelectList",
			"options": ["Evolução", "Valores Relativos"],
			on_change: function () {
				let selected_advanced_reports = frappe.query_report.get_filter_value("relatorios_avancados");

				if (typeof selected_advanced_reports === "string") {
					selected_advanced_reports = selected_advanced_reports.split(",");
				}

				let lista_graficos = ["Histórico"];

				if (selected_advanced_reports.includes("Evolução")) {
					lista_graficos.push("Evolução");
				}

				const grafico_filter = frappe.query_report.get_filter("grafico_exibido");
				if (grafico_filter) {
					grafico_filter.df.options = lista_graficos.join("\n");
					grafico_filter.refresh();
				}
			},
		},
		{
			"fieldname": "grafico_exibido",
			"label": __("Gráfico Exibido"),
			"fieldtype": "Select",
			"options": ["Histórico"], // Opção inicial
		},
	],
};
