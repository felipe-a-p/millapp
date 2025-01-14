import frappe
from frappe import _


def execute(filters: dict | None = None):
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data


def get_columns() -> list[dict]:
    return [
        {
            "label": _("Artigo"),
            "fieldname": "artigo",
            "fieldtype": "Data",
            "width": 150,
        },
        {
			"label": _("Tamanho"),
			"fieldname": "tamanho",
			"fieldtype": "Data",
			"width": 150,
		},
        {
            "label": _("Pedido"),
            "fieldname": "pedido",
            "fieldtype": "link",
            "options": "Pedidos",
			"width": 150,
        },
        {
            "label": _("Data Acerto"),
            "fieldname": "data_acerto",
            "fieldtype": "Date",
			"width": 150,
        },
        {
            "label": _("Quantidade"),
            "fieldname": "quantidade",
            "fieldtype": "Int",
			"width": 150,
        },
        {
            "label": _("Estado Pedido"),
            "fieldname": "estado_pedido",
            "fieldtype": "Data",
			"width": 150,
        },
    ]

def get_data(filters) -> list[list]:
    pedido_state = filters.get("estado_pedido", [])
    modelos = filters.get("modelos", [])
    data_maxima_acerto = filters.get("data_maxima_acerto", None)

    # Verifica se os filtros estão vazios e ajusta
    if not pedido_state:
        pedido_state = ['Separado', 'Entregue']  # Defina um valor padrão se necessário
    if not modelos:
        modelos = ['default_modelo']  # Defina um valor padrão para modelos, caso não seja passado

    # Consulta SQL com parâmetros tratados
    query = """
        SELECT
            map.artigo,
            mda.tamanho,
			ped.name AS pedido,
            ped.data_acerto,
            map.quantidade_entregue as quantidade,
            ped.pedido_state as estado_pedido
        FROM 
            `tabModelos do Artigo no Pedido` AS map
        INNER JOIN 
            `tabPedidos` AS ped ON map.parent = ped.name
        LEFT JOIN
			`tabModelos de Artigos` AS mda ON map.modelo = mda.name
        WHERE 
            map.modelo IN %(modelos)s
            AND ped.pedido_state IN %(pedido_state)s
            AND (
                ped.pedido_state != 'Entregue' -- Para estados diferentes de "Entregue", sem considerar data_acerto
                OR (
                    ped.pedido_state = 'Entregue'
                    AND (
                        %(data_maxima_acerto)s IS NULL
                        OR ped.data_acerto <= %(data_maxima_acerto)s
                    )
                )
            );
    """
    # Passa os parâmetros para a consulta
    data = frappe.db.sql(query, {"modelos": modelos, "pedido_state": pedido_state, "data_maxima_acerto": data_maxima_acerto}, as_dict=True)
    
    return data
