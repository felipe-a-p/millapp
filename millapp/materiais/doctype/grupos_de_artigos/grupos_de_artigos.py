# Copyright (c) 2024, Felipe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class GruposdeArtigos(Document):
	pass


@frappe.whitelist()
def get_nodes(doctype, parent=None, is_root=False, **filters):
    if is_root or not parent:
        nodes = frappe.get_all(
            'Grupos de Artigos', 
            fields=[
                'name as value', 
                'name as title', 
                "'true' as expandable"
            ]
        )
    else:
        subgrupos = frappe.get_all(
            'Subgrupos de Artigos', 
            filters={'parent': parent},
            fields=[
                'name as value', 
                'name as title', 
                "'true' as expandable"
            ]
        )
        
        if subgrupos:
            nodes = subgrupos
        else:
            nodes = frappe.get_all(
                'Artigos', 
                filters={'subgrupo': parent},  
                fields=[
                    'name as value', 
                    'name as title',                ]
            )
            for node in nodes:
                node['route'] = f'/app/artigos/{node["value"]}'

    return nodes


@frappe.whitelist()
def add_node():
    args = frappe.local.form_dict
    doc = frappe.new_doc(args.doctype)
    doc.update(args)
    doc.insert()
    return doc.name