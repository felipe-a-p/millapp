# Script para Relatório Customizado no Frappe
import frappe
from frappe import _

def execute(filters=None):
    columns, data = get_columns(), get_data(filters)
    return columns, data

def get_columns():
    return [
        {"fieldname": "tipo", "label": _("Tipo"), "fieldtype": "Select", "options": "À Vista\nA Prazo", "width": 120},
        {"fieldname": "total_pagamentos", "label": _("Total de Pagamentos"), "fieldtype": "Int", "width": 150},
        {"fieldname": "valor_total", "label": _("Valor Total"), "fieldtype": "Currency", "width": 150},
    ]

def get_data(filters):
    query = """
        SELECT 
            tipo,
            COUNT(*) as total_pagamentos,
            SUM(valor) as valor_total
        FROM 
            `tabPagamentos`
        WHERE 
            {conditions}
        GROUP BY 
            tipo
    """.format(conditions=get_conditions(filters))
    return frappe.db.sql(query, as_dict=True)

def get_conditions(filters):
    conditions = "1=1"
    if filters.get("from_date") and filters.get("to_date"):
        conditions += " AND data BETWEEN '{}' AND '{}'".format(filters.get("from_date"), filters.get("to_date"))
    return conditions
