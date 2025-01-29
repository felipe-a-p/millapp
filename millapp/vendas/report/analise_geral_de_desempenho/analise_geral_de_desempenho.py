# Copyright (c) 2025, Felipe and contributors
# For license information, please see license.txt

import frappe
import pandas as pd
import numpy as np
from frappe import _
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def execute(filters: dict | None = None):
    relatorio_obj = relatorio(filters)
    columns, data, html_graficos = relatorio_obj.get_execute_data()
    return columns, data, html_graficos, None, None


class relatorio:
    def __init__(self, filtros):
        self.filtros = filtros
        self.criar_dataframe()
        
    def criar_dataframe(self):
        relatorios = self.filtros.get("relatorios")
        data = self.get_data_dict()
        self.dataframe_base = pd.DataFrame(data)
        self.dataframe_base['percentual_vendido'] = (
            self.dataframe_base['total_vendido_vlr'] / 
            self.dataframe_base['total_entregue_vlr'].replace(0, np.nan) 
        ) * 100        
        base_gb = self.dataframe_base.groupby(["cliente"]) 
        self.dataframe_relatorio = pd.DataFrame()
        
        for relatorio in relatorios:
            match relatorio:
                case "Somas":
                    self.dataframe_relatorio['Soma Entregue'] = base_gb['total_entregue_vlr'].sum()
                    self.dataframe_relatorio['Soma Vendido'] = base_gb['total_vendido_vlr'].sum()
                    self.dataframe_relatorio['Percentual Vendido (soma)'] = (self.dataframe_relatorio['Soma Vendido'] / self.dataframe_relatorio['Soma Entregue']) * 100
                case "Medianas":
                    self.dataframe_relatorio['Mediana Entregue'] = base_gb['total_entregue_vlr'].median()
                    self.dataframe_relatorio['Mediana Vendido'] = base_gb['total_vendido_vlr'].median()
                    self.dataframe_relatorio['Mediana Percentual Vendido (calculo)'] = (self.dataframe_relatorio['Mediana Vendido'] / self.dataframe_relatorio['Mediana Entregue']) * 100
                    self.dataframe_relatorio['Mediana Percentual Vendido (mediana)'] = base_gb['percentual_vendido'].median()
                case "Representatividade":
                    self.dataframe_relatorio['Representatividade Entregue'] = (base_gb['total_entregue_vlr'].sum() / self.dataframe_relatorio['Soma Entregue'].sum()) * 100
                    self.dataframe_relatorio['Representatividade Vendido'] = (base_gb['total_vendido_vlr'].sum() / self.dataframe_relatorio['Soma Vendido'].sum()) * 100
                    self.dataframe_relatorio['Representatividade Percentual Vendido'] = ((self.dataframe_relatorio['Representatividade Vendido'] / self.dataframe_relatorio['Representatividade Entregue']) -1)  * 100
                    
        self.dataframe_relatorio.reset_index(inplace=True)

    def get_data_dict(self):
        data_inicial = self.filtros.get("data_inicial")
        data_final = self.filtros.get("data_final")
        cidade = self.filtros.get("cidade")
        responsavel = self.filtros.get("responsavel")
        
        query = """
            SELECT
                pe.cliente,
                cl.cidade,
                pe.responsavel,
                pe.total_entregue_vlr,
                pe.total_vendido_vlr,
                pe.pedido_numero,
                pe.data_acerto,
                DATE_FORMAT(pe.data_acerto, '%%Y-%%m') AS mes
            FROM
                `tabPedidos` pe
            INNER JOIN
                `tabContatos` cl ON pe.cliente = cl.name
            WHERE
                1=1
        """
        
        # Adicionando filtros na consulta
        params = {}
        if data_inicial:
            query += " AND pe.data_acerto >= %(data_inicial)s"
            params['data_inicial'] = data_inicial
        if data_final:
            query += " AND pe.data_acerto <= %(data_final)s"
            params['data_final'] = data_final
        if cidade:
            query += " AND cl.cidade IN %(cidade)s"
            params['cidade'] = tuple(cidade)  # Certifica que seja uma tupla
        if responsavel:
            query += " AND pe.responsavel IN %(responsavel)s"
            params['responsavel'] = tuple(responsavel) 

        pedidos = frappe.db.sql(query, params, as_dict=True)
        pedidos = [dict(pedido) for pedido in pedidos]

        return pedidos
    
    def criar_graficos(self):
        tipos_de_grafico = self.filtros.get("tipos_de_grafico")
        html_graficos = ""
        for grafico in tipos_de_grafico:
            match grafico:
                case "Heatmap Entregue X Vendido":
                    dataframe_base_local = self.dataframe_base.copy()
                    max_entregue = dataframe_base_local['total_entregue_vlr'].max()
                    bins_entregue = list(range(0, int(max_entregue) + 500, 500))

                    # Criar bins personalizados para o eixo Y (vendido_bins) com espaço para 0 e depois de 300 em 300
                    max_vendido = dataframe_base_local['total_vendido_vlr'].max()
                    bins_vendido = [0] + list(range(300, int(max_vendido) + 300, 300))

                    # 2. Categorizar os dados nos bins
                    dataframe_base_local['entregue_bins'] = pd.cut(dataframe_base_local['total_entregue_vlr'], bins_entregue, right=False)
                    dataframe_base_local['vendido_bins'] = pd.cut(dataframe_base_local['total_vendido_vlr'], bins_vendido, right=False)

                    # 3. Criar a matriz para o heatmap
                    matriz = dataframe_base_local.groupby(['vendido_bins', 'entregue_bins']).size().unstack(fill_value=0)

                    # 4. Corrigir os eixos: o eixo X será para os "entregue_bins" e o eixo Y será para os "vendido_bins"
                    heatmap_entregue_x_vendido = go.Figure(data=go.Heatmap(
                        z=matriz.values,
                        x=[f"{interval.left:.2f} - {interval.right:.2f}" for interval in matriz.columns],  # Eixo X: Entregue (bins)
                        y=[f"{interval.left:.2f} - {interval.right:.2f}" for interval in matriz.index],  # Eixo Y: Vendido (bins)
                        colorscale=[
                            [0, 'white'],  # Valor 0 será branco
                            [0.1, 'blue'],
                            [0.2, 'green'],
                            [0.3, 'yellow'],
                            [0.4, 'orange'],
                            [0.5, 'red'],
                            [1, 'black']
                        ],
                        colorbar=dict(title="Contagem"),
                    ))

                    # 5. Configurar layout
                    heatmap_entregue_x_vendido.update_layout(
                        title="Heatmap: Total Entregue vs. Total Vendido",
                        xaxis_title="Total Entregue (Intervalos de Valor)",  # Eixo X
                        yaxis_title="Total Vendido (Intervalos de Valor)",  # Eixo Y
                        template="plotly_white",
                        xaxis=dict(showgrid=False),
                        yaxis=dict(showgrid=False),
                    )

                    # Adiciona o gráfico como HTML ao resultado
                    html_graficos += heatmap_entregue_x_vendido.to_html(full_html=False, include_plotlyjs='cdn') + "<br>"

                case "Histograma":
                    dataframe_base_local = self.dataframe_base.copy()
                    print(dataframe_base_local['mes'].unique) 
                    dataframe_grafico = dataframe_base_local.groupby('mes').agg({
                        'total_entregue_vlr': 'sum',
                        'total_vendido_vlr': 'sum'
                    }).reset_index()
                    dataframe_grafico['percentual_vendido'] = (dataframe_grafico['total_vendido_vlr'] / dataframe_grafico['total_entregue_vlr'].replace(0, np.nan)) * 100
                    histograma = make_subplots(specs=[[{"secondary_y": True}]])
                    histograma.add_trace(go.Bar(
                        x=dataframe_grafico['mes'],
                        y=dataframe_grafico['total_entregue_vlr'],
                        name='Total Entregue',
                        marker_color='blue'
                    ),secondary_y = False)
                    histograma.add_trace(go.Bar(
                        x=dataframe_grafico['mes'],
                        y=dataframe_grafico['total_vendido_vlr'],
                        name='Total Vendido',
                        marker_color='yellow',
                    ),secondary_y = False)
                    histograma.add_trace(go.Scatter(
                        x=dataframe_grafico['mes'],
                        y=dataframe_grafico['percentual_vendido'],
                        name='% Vendido',
                        mode='lines+markers',
                        marker=dict(color='red'),
                    ),secondary_y = True)
                    histograma.update_layout(barmode='overlay')

                    html_graficos += histograma.to_html(full_html=False, include_plotlyjs='cdn') + "<br>"

            return html_graficos

    def get_execute_data(self):
        fieldtype_map = {
            "object": "Data",
            "int64": "Int",
            "float64": "Float",
            "datetime64": "Datetime"
        }
        
        frappe_columns = []
        
        for column in self.dataframe_relatorio.columns:
            fieldtype = fieldtype_map.get(str(self.dataframe_relatorio[column].dtype), "Data")
            frappe_columns.append({
                "label": column.replace("_", " ").title(),
                "fieldname": column,
                "fieldtype": fieldtype,
                "width": 150
            })
        
        # Gera os gráficos
        html_graficos = self.criar_graficos()
        
        return frappe_columns, self.dataframe_relatorio.to_dict(orient="records"), html_graficos
