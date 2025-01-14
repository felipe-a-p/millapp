# Copyright (c) 2025, Felipe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import pandas as pd

def execute(filters: dict | None = None):
    # Criar DataFrame e calcular resumo primitivo
    dataframe, primitive_summary = criar_dataframe(filters)

    # Converter DataFrame para colunas do Frappe
    columns = dataframe_to_report_columns(dataframe)

    # Retornar os dados para exibição
    return columns, dataframe.to_dict("records"), None, None, None, primitive_summary

def criar_dataframe(filters: dict) -> pd.DataFrame:
    data_inicial = filters.get("data_inicial")
    data_final = filters.get("data_final")
    responsavel = filters.get("responsavel")

    query = """
        SELECT 
			fat.responsavel,
            fat.cliente,  
            fat.name,
            fat.data_criacao, 
            fat.valor_liquido_fatura, 
            pag.tipo,
            pag.metodo,
            pag.valor
        FROM
			`tabPagamentos` AS pag 
        LEFT JOIN 
			`tabFaturamentos` AS fat ON pag.parent = fat.name

        WHERE
            fat.data_criacao BETWEEN %(data_inicial)s AND %(data_final)s
        AND 
            (COALESCE(%(responsavel)s, '') = '' OR fat.responsavel = %(responsavel)s)
    """

    faturamentos = frappe.db.sql(query, {"data_inicial": data_inicial, "data_final": data_final, "responsavel": responsavel}, as_dict=True)
    faturamentos = [dict(faturamento) for faturamento in faturamentos]
    faturamentos_df = pd.DataFrame(faturamentos)

    print(faturamentos_df.columns)  # Antes de acessar a coluna 'valor'

    # Calcular Primitive Summary
    primitive_summary = get_primitive_summary(faturamentos_df)

    return faturamentos_df, primitive_summary

def get_primitive_summary(df: pd.DataFrame) -> list:
    # Acesse corretamente a coluna 'valor_liquido_fatura'
    try:
        total_valor_faturas = df["valor_liquido_fatura"].sum()
    except KeyError:
        total_valor_faturas = 0  # Caso a coluna não exista, retorna 0

    total_valor_pagamentos = df.get('valor', pd.Series([0])).sum()
    total_clientes = df.get('cliente', pd.Series([])).nunique()

    return [
        {"label": _("Total de Faturas"), "value": frappe.format_value(total_valor_faturas, "Currency")},
        {"label": _("Total de Pagamentos"), "value": frappe.format_value(total_valor_pagamentos, "Currency")},
        {"label": _("Total de Clientes"), "value": total_clientes},
    ]


# def criar_dataframe(filters: dict) -> pd.DataFrame:
# 	data_inicial = filters.get("data_inicial")
# 	data_final = filters.get("data_final")
# 	responsavel = filters.get("responsavel")

# 	query = """
# 		SELECT 
# 			fat.name,
#    			fat.cliente,	
#    			fat.data_criacao, 
#       		fat.valor_liquido_fatura, 
#         	pag.tipo,
# 			pag.metodo,
# 			pag.valor
# 		FROM
#   			`tabFaturamentos` AS fat
# 		LEFT JOIN 
#   			`tabPagamentos` AS pag ON fat.name = pag.parent
# 		WHERE
#   			fat.data_criacao BETWEEN %(data_inicial)s AND %(data_final)s
# 		AND 
#   			(COALESCE(%(responsavel)s, '') = '' OR fat.responsavel = %(responsavel)s)
# 	"""

# 	faturamentos = frappe.db.sql(query, {"data_inicial": data_inicial, "data_final": data_final, "responsavel": responsavel}, as_dict=True)
# 	faturamentos = [dict(faturamento) for faturamento in faturamentos]
# 	faturamentos_df = pd.DataFrame(faturamentos)

	
# 	return


def dataframe_to_report_columns(df):
    fieldtype_map = {
        "object": "Data",
        "int64": "Int",
        "float64": "Float",
        "datetime64": "Datetime"
    }
    
    frappe_columns = []
    
    for column in df.columns:
        fieldtype = fieldtype_map.get(str(df[column].dtype), "Data")
        frappe_columns.append({
            "label": column.replace("_", " ").title(),
            "fieldname": column,
            "fieldtype": fieldtype,
            "width": 150
        })
    
    return frappe_columns

