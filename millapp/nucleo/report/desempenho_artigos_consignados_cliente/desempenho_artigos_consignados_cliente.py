# Copyright (c) 2025, Felipe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import pandas as pd



def execute(filters=None):
    dataframe = criar_dataframe(filters)
    
    if dataframe.empty:
        # Retorna colunas e dados vazios se o DataFrame estiver vazio
        return [], []

    # Converte o DataFrame para uma lista de dicionários e trata valores ausentes
    columns = dataframe_to_report_columns(dataframe)
    data = dataframe.fillna("").to_dict("records")  # Substitui NaN por strings vazias
    return columns, data


def criar_dataframe(filters):
    cliente = filters.get("contato")
    ultimos_x_pedidos = filters.get("ultimos_x_pedidos")
    agrupar_por = filters.get("agrupar_por")
       
    query = """
        SELECT 
            ped.pedido_numero, 
            anp.artigo,
            anp.quantidade_entregue, 
            anp.quantidade_vendida, 
            art.grupo, 
            art.subgrupo
        FROM 
            `tabPedidos` AS ped 
        LEFT JOIN 
            `tabArtigos no Pedido` AS anp ON ped.name = anp.parent
        LEFT JOIN 
            `tabArtigos` AS art ON anp.artigo = art.name
        WHERE 
            ped.cliente = %(cliente)s
        AND 
            ped.pedido_state = "Faturado"
    """
    
    pedidos = frappe.db.sql(query, {"cliente": cliente}, as_dict=True)
    pedidos = [dict(pedido) for pedido in pedidos]
    pedidos_df = pd.DataFrame(pedidos)
    
    groupby_itens = ["grupo", "subgrupo", "artigo"]
    
    match agrupar_por:
        case "Grupos":
            groupby_itens = ["grupo"]
        case "SubGrupos":
            groupby_itens = ["grupo", "subgrupo"]
        case "Artigos":
            groupby_itens = ["grupo", "subgrupo", "artigo"]
    print(agrupar_por)
    
    pedidos_gb = pedidos_df.groupby(groupby_itens)
    lista_ultimos_x = [p for p in range(pedidos_df['pedido_numero'].max(), pedidos_df['pedido_numero'].max() - ultimos_x_pedidos, -1)]
    ultimos_x_df = pedidos_df.query("pedido_numero in @lista_ultimos_x")
    ultimos_x_gb = ultimos_x_df.groupby(groupby_itens)
    ultimo_gb = pedidos_df.query("pedido_numero == @pedidos_df['pedido_numero'].max()").groupby(groupby_itens).sum()
    
    dados = pd.DataFrame()
    dados['total_entregue'] = pedidos_gb['quantidade_entregue'].sum()
    dados['total_vendido'] = pedidos_gb['quantidade_vendida'].sum()
    dados['percent_vendida'] = (dados['total_vendido'] / dados['total_entregue']) * 100
    dados['ultimos_x_entregue'] = ultimos_x_gb['quantidade_entregue'].sum()
    dados['ultimos_x_vendido'] = ultimos_x_gb['quantidade_vendida'].sum()
    dados['ultimos_x_percent_vendida'] = (dados['ultimos_x_vendido'] / dados['ultimos_x_entregue']) * 100
    dados['ultimo_entregue'] = ultimo_gb['quantidade_entregue']
    dados['ultimo_vendido'] = ultimo_gb['quantidade_vendida']
    dados['ultimo_percent_vendida'] = (dados['ultimo_vendido'] / dados['ultimo_entregue']) * 100
    
    dados.reset_index(inplace=True)
    return dados


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