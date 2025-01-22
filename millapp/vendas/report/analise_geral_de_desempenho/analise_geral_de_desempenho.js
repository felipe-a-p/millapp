// Copyright (c) 2025, Felipe and contributors
// For license information, please see license.txt

frappe.query_reports["Analise Geral de Desempenho"] = {
	onload: function (report) {
		frappe.after_ajax(function () {
			if (report.message) {
				// Adiciona o contêiner do gráfico
				report.page.main.prepend(`
					<div id="plotly-graph" style="margin-bottom: 20px; width: 100%; height: 400px;">
						${report.message}
					</div>
				`);

				// Força o redimensionamento após um pequeno atraso
				setTimeout(() => {
					Plotly.Plots.resize('plotly-graph');
				}, 200);

				// Garante que o gráfico será redimensionado ao redimensionar a janela
				window.addEventListener('resize', () => {
					Plotly.Plots.resize('plotly-graph');
				});
			}
		});
	},
	filters: [
		{
			"fieldname": "relatorios",
			"label": "Relatórios",
			"fieldtype": "MultiSelectList",
			"options": ["Somas", "Medianas", "Representatividade", "Pareto"],
			"default": ["Somas", "Medianas"],
			"reqd": 1,
		},
		{
			"fieldname": "tipos_de_grafico",
			"label": "Gráficos",
			"fieldtype": "MultiSelectList",
			"options": ["Heatmap Entregue X Vendido", "Histograma"],
		},
		{
			"fieldname": "data_inicial",
			"label": "Data Inicial",
			"fieldtype": "Date",
			"default": frappe.datetime.add_days(frappe.datetime.get_today(), -60),
		},
		{
			"fieldname": "data_final",
			"label": "Data Final",
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
		},
		{
			"fieldname": "cidade",
			"label": "Cidade",
			"fieldtype": "MultiSelectList",
			get_data() {
				return frappe.db.get_list('Contatos', {
					fields: ['cidade'],
					distinct: true,
					order_by: 'cidade',
				}).then(res => {
					const uniqueCidades = [...new Set(res.map(d => d.cidade))];
					frappe.query_report.set_filter_value("cidade", uniqueCidades);
					return uniqueCidades.map(cidade => ({ value: cidade, label: cidade }));
				});
			},
		},
		{
			"fieldname": "responsavel",
			"label": "Responsável",
			"fieldtype": "Link",
			"options": "User",
		}
	],
};
