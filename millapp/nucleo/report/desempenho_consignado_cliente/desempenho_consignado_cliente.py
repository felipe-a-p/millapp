import frappe
import pandas as pd
from frappe import _
from datetime import datetime

def execute(filters=None):
    dataframe = criar_dataframe(filters)
    data = dataframe.fillna("").to_dict("records")
    columns = dataframe_to_report_columns(dataframe)
    chart = get_chart_data(filters, dataframe)
    summary = get_report_summary(filters, dataframe)
    message = ""
    
    return columns, data, message, chart, summary

def criar_dataframe(filters):
    cliente = filters.get("contato")
    relatorios_avancados = filters.get("relatorios_avancados")
    query = """
        SELECT 
        	p.data_entrega AS data_entrega,
            p.pedido_state AS status,
            p.pedido_numero AS pedido_numero,
            p.total_entregue_vlr AS total_entregue,
            p.total_vendido_vlr AS total_vendido
        FROM 
            `tabPedidos` p
        WHERE 
            p.cliente = %(cliente)s
        ORDER BY 
            p.pedido_numero DESC
    """
    
    pedidos = frappe.db.sql(query, {"cliente": cliente}, as_dict=True)
    pedidos = [dict(pedido) for pedido in pedidos]
    pedidos_df = pd.DataFrame(pedidos)
    pedidos_df['data_entrega'] = pd.to_datetime(pedidos_df['data_entrega']).dt.strftime('%d-%m-%Y')
    pedidos_df['percentual_vendido'] = (pedidos_df['total_vendido'] / pedidos_df['total_entregue']) * 100
    
    for relatorio_avancado in relatorios_avancados:
        match relatorio_avancado:
            case "Evolução":
                pedidos_df.sort_values(by="pedido_numero", ascending=True, inplace=True)
                pedidos_df['evolucao_entregue'] = ((pedidos_df['total_entregue'] / pedidos_df['total_entregue'].shift(1)) - 1) * 100
                pedidos_df['evolucao_vendas'] = ((pedidos_df['total_vendido'] / pedidos_df['total_vendido'].shift(1)) - 1) * 100
                pedidos_df['evolucao_percentual'] = ((pedidos_df['percentual_vendido'] / pedidos_df['percentual_vendido'].shift(1)) - 1) * 100
                pedidos_df.sort_values(by="pedido_numero", ascending=False, inplace=True)
            case "Valores Relativos":
                pedidos_df['entregue_relativo'] = (pedidos_df['total_entregue'] / pedidos_df['total_entregue'].sum()) *100
                pedidos_df['vendido_relativo'] = (pedidos_df['total_vendido'] / pedidos_df['total_vendido'].sum()) *100
            
    return pedidos_df
    
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


def get_report_summary(filters, df):
    df = df.query("status == 'Faturado'")
    total_pedidos = df.shape[0]
    total_entregue = round(float(df['total_entregue'].sum()), 2)
    total_vendido = round(float(df['total_vendido'].sum()), 2)
    venda_mediana = round(float(df['total_vendido'].median()), 2)
    percent_venda_mediana = round(df['percentual_vendido'].median(), 2)
    maior_venda = round(float(df['total_vendido'].max()), 2)
    data_maior_venda = df.loc[df['total_vendido'] == maior_venda, 'data_entrega'].values[0]
    summary = [
        {"label": _("Total Pedidos Fechados"), "value": total_pedidos, "datatype": "Int"},
        {"label": _("Total Entregue"), "value": total_entregue, "datatype": "Currency"},
        {"label": _("Total Vendido"), "value": total_vendido, "datatype": "Currency"},
        {"label": _("% Vendida"), "value": round(total_vendido / total_entregue * 100, 2), "datatype": "Percent"},
        {"label": _("Venda Mediana"), "value": venda_mediana, "datatype": "Currency"},
        {"label": _("% Venda Mediana"), "value": percent_venda_mediana, "datatype": "Percent"},
        {"label": _("Maior Venda"), "value": maior_venda, "datatype": "Currency"},
        {"label": _("Data Maior Venda"), "value": data_maior_venda, "datatype":"Data"}
    ]
    
    return summary

def get_chart_data(filters, df):
    df = df.query("status == 'Faturado' or status == 'Entregue'")

    if df.empty:
        return {}
    
    match filters.get("grafico_exibido"):
        case "Histórico":
            df = df.sort_values(by="pedido_numero", ascending=True)
            labels = df['pedido_numero']
            total_entregue = df['total_entregue'].tolist()
            total_vendido = df['total_vendido'].tolist()
            charts = []
            main_chart_data = {
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
                        }
                    ]
                },
                "type": "axis-mixed", 
                "fieldtype": "Currency",
                "options": "currency",
                "currency": filters.get("currency", "BRL")
            }
            charts.append(main_chart_data)
            
            return main_chart_data
        case "Evolução":
            # Ordenar para o cálculo de evolução
            df = df.sort_values(by="pedido_numero", ascending=True).reset_index(drop=True)
            
            # Inicializar valores acumulados
            df['acumulado_entregue'] = 100
            df['acumulado_vendas'] = 100
            df['acumulado_porcentagem'] = 100
            
            # Calcular evolução acumulada
            for i in range(1, len(df)):
                df.loc[i, 'acumulado_entregue'] = df.loc[i - 1, 'acumulado_entregue'] * (1 + df.loc[i, 'evolucao_entregue'] / 100)
                df.loc[i, 'acumulado_vendas'] = df.loc[i - 1, 'acumulado_vendas'] * (1 + df.loc[i, 'evolucao_vendas'] / 100)
                df.loc[i, 'acumulado_porcentagem'] = df.loc[i - 1, 'acumulado_porcentagem'] * (1 + df.loc[i, 'evolucao_percentual'] / 100)
            
            labels = df['pedido_numero']
            acumulado_entregue = df['acumulado_entregue'].tolist()
            acumulado_vendas = df['acumulado_vendas'].tolist()
            acumulado_porcentagem = df['acumulado_porcentagem'].tolist()

            # Gerar gráfico de evolução
            evolution_chart_data = {
                "data": {
                    "labels": labels,
                    "datasets": [
                        {
                            "name": _("Evolução Total Entregue"),
                            "values": acumulado_entregue,
                            "chartType": "line",
                        },
                        {
                            "name": _("Evolução Total Vendas"),
                            "values": acumulado_vendas,
                            "chartType": "line",
                        },
                        {
                            "name": _("Evolução Percentual Vendido"),
                            "values": acumulado_porcentagem,
                            "chartType": "line",
                        }
                    ]
                },
                "type": "line",
                "fieldtype": "Percent",
            }

            return evolution_chart_data

            
