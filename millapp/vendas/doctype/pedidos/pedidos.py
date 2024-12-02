# Copyright (c) 2024, Frappe Technologies and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Pedidos(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from frappe.vendas.doctype.artigos_no_pedido.artigos_no_pedido import ArtigosnoPedido

		artigos_do_pedido: DF.Table[ArtigosnoPedido]
		atendimento: DF.Link | None
		cliente: DF.Link | None
		data_acerto: DF.Date | None
		data_criacao: DF.Date | None
		data_fechamento: DF.Date | None
		endereço: DF.ReadOnly | None
		nome_cliente: DF.ReadOnly | None
		nome_cliente_2: DF.ReadOnly | None
		telefone_cliente: DF.ReadOnly | None
		workflow_state: DF.Literal[None]
	# end: auto-generated types
	pass
