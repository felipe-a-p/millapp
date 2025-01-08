import frappe
from frappe import _
from datetime import datetime


# Outras importações ou funções, caso necessário

def execute(filters=None):
    # Certifique-se de que os filtros estão corretamente definidos
    if not filters:
        filters = {}

    # Defina as colunas que você quer no seu relatório
    columns = [
        {"fieldname": "data_entrega", "label": _("Data de Entrega"), "fieldtype": "Date", "width": 150},
        {"fieldname": "pedido_numero", "label": _("Pedido Número"), "fieldtype": "Data", "width": 150},
        {"fieldname": "total_entregue", "label": _("Total Entregue (Vlr)"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "total_vendido", "label": _("Total Vendido (Vlr)"), "fieldtype": "Currency", "width": 150},
        {"fieldname": "percent_vendida", "label": _("% Vendida"), "fieldtype": "Float", "width": 150}
    ]
    
    # Consulta SQL para filtrar os pedidos
    data = frappe.db.sql("""
        SELECT 
        	p.data_entrega AS data_entrega,
            p.pedido_numero AS pedido_numero,
            p.total_entregue_vlr AS total_entregue,
            p.total_vendido_vlr AS total_vendido
        FROM 
            `tabPedidos` p
        WHERE 
            p.cliente = %(contato)s
        ORDER BY 
            p.pedido_numero DESC
    """, filters, as_dict=True)

    # Calcular % Vendida
    total_entregue = 0
    total_vendido = 0
    for row in data:
        if row.total_vendido and row.total_vendido > 0:
            row.percent_vendida = (row.total_vendido / row.total_entregue) * 100
        else:
            row.percent_vendida = 0
        total_entregue += row.total_entregue
        total_vendido += row.total_vendido

    chart = get_chart_data(filters, columns, data)

    # Adicionando a linha de summary
    summary = {
        "pedido_numero": _("Totais"),
        "total_entregue": total_entregue,
        "total_vendido": total_vendido,
        "percent_vendida": (total_vendido / total_entregue) * 100 if total_entregue > 0 else 0
    }
    data.append(summary)

    # Obter o resumo do relatório
    report_summary = get_report_summary(filters, total_entregue, total_vendido)
    
    # Obter o gráfico para exibir visualmente
    
    return columns, data, report_summary, chart


def get_report_summary(filters, total_entregue, total_vendido):
    """Função para calcular o resumo do relatório"""
    currency = filters.get("currency", "BRL")  # Exemplo de moeda, pode ser dinamico
    
    summary_data = [
        {"value": total_entregue, "label": _("Total Entregue"), "datatype": "Currency", "currency": currency},
        {"value": total_vendido, "label": _("Total Vendido"), "datatype": "Currency", "currency": currency},
    ]
    
    return summary_data

def get_chart_data(filters, columns, data):
    # Ordenando os dados pelo ano e mês da data_entrega
    data = sorted(data, key=lambda row: row.get("data_entrega").strftime("%Y-%m") if isinstance(row.get("data_entrega"), datetime) else row.get("data_entreg"))

    # Extraindo os labels (datas de entrega)
    labels = [row.get('data_entrega').strftime("%Y-%m") if isinstance(row.get('data_entrega'), datetime) else row.get('data_entreg') for row in data]

    # Extraindo os valores para os datasets
    total_entregue = [row.get('total_entregue', 0) for row in data]
    total_vendido = [row.get('total_vendido', 0) for row in data]

    # Calculando a porcentagem vendida
    percentual_vendido = [
        (vendido / entregue * 100 if entregue > 0 else 0)
        for vendido, entregue in zip(total_vendido, total_entregue)
    ]

    # Gerando os dados para o gráfico
    chart_data = {
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "name": _("Total Entregue"), 
                    "values": total_entregue, 
                    "chartType": "bar", 
                    "y_axis": "y1"
                },
                {
                    "name": _("Total Vendido"), 
                    "values": total_vendido, 
                    "chartType": "bar", 
                    "y_axis": "y1"
                },
                {
                    "name": _("% Vendida"),
                    "values": percentual_vendido,
                    "chartType": "bar",
                    "y_axis": "y2",  
                },
            ]
        },
        "type": "axis-mixed",  # Tipo de gráfico com eixos mistos
        
        "fieldtype": "Currency",
        "options": "currency",
        "currency": filters.get("currency", "BRL"),
    }

    return chart_data