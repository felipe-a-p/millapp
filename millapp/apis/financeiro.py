import frappe
import json

@frappe.whitelist()
def gerar_faturamento(doc):
    doc_dict = json.loads(doc)
    faturamento = frappe.get_doc({
        "doctype": "Faturamento",
        "pedido": doc_dict.get('pedido'),
        "cliente": doc_dict.get('cliente'),
        "data_de_faturamento": doc_dict.get('data_de_faturamento'),
        "data_de_vencimento": doc_dict.get('data_de_vencimento'),
        "valor_total": doc_dict.get('valor_total'),
        "valor_restante": doc_dict.get('valor_total'),
        "status": "Em aberto"
    })
    faturamento.insert()
    frappe.db.commit()
    return faturamento.name