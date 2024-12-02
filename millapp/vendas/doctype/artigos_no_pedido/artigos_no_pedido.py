# Copyright (c) 2024, Frappe Technologies and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class ArtigosnoPedido(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		artigo: DF.Link | None
		modelo: DF.Literal[None]
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		pedido: DF.Link | None
		preco_etiqueta: DF.Currency
		quantidade_devolvida: DF.Int
		quantidade_entregue: DF.Int
		quantidade_vendida: DF.Int
		tamanho: DF.Literal[None]
	# end: auto-generated types
	pass
