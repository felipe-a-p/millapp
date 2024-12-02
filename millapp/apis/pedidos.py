import frappe
import json

@frappe.whitelist()
def get_pedidos_cliente(cliente):
    pedidos = frappe.get_all(
        'Pedidos',
        filters={
            'cliente': cliente
        },
        fields=['pedido_numero'],
        ignore_permissions=True
    )
    return pedidos

@frappe.whitelist()
def criar_complemento(doc):
    doc_dict = json.loads(doc)
    complemento_existente = frappe.db.exists("Pedidos", {"pedido_complemento": doc_dict.get('name')})
    if complemento_existente:
        return complemento_existente
    
    complemento_doc = frappe.get_doc({
        "doctype": "Pedidos",
        "pedido_state": "Criado",
        "tipo_pedido": "Complemento",
        "data_criacao": frappe.utils.now(),
        "atendimento": doc_dict.get('atendimento'),
        "cliente": doc_dict.get('cliente'),
        "config_tabela_precos": doc_dict.get('config_tabela_precos'),
        "data_acerto": doc_dict.get('data_acerto'),
        "pedido_complemento": doc_dict.get('name')
    })
    name =  f"Complemento - {doc_dict.get('name')}"
    complemento_doc.insert()
    frappe.rename_doc("Pedidos", complemento_doc.name, name)
    frappe.db.commit()
    return name

@frappe.whitelist()
def entregar_complemento(doc):
    doc_dict = json.loads(doc)
    artigos_pedido = frappe.get_all("Artigos no Pedido", filters={"parent": doc_dict.get('pedido_complemento')}, fields=["*"])
    artigos_complemento = doc_dict.get("artigos_do_pedido")
    print(doc_dict)
    for artigo_complemento in artigos_complemento:
        artigo_complemento['encontrado'] = False
        for artigo_pedido in artigos_pedido:
            if artigo_pedido['artigo'] == artigo_complemento['artigo']:
                artigo_complemento['encontrado'] = True
                artigo_complemento['registro_pedido'] = artigo_pedido['name']
                artigo_complemento['nova_quantidade'] = artigo_pedido['quantidade_entregue'] + artigo_complemento['quantidade_entregue']
                artigo_complemento['novo_valor'] = artigo_pedido['preco_etiqueta'] * artigo_complemento['nova_quantidade']
                break
            
        if artigo_complemento['encontrado']:
            registro_existente = frappe.get_doc("Artigos no Pedido", artigo_complemento['registro_pedido'])
            registro_existente.quantidade_entregue = artigo_complemento['nova_quantidade'] 
            registro_existente.valor_total_entregue = artigo_complemento['novo_valor']
            registro_existente.save()
            frappe.db.commit() 
        else:
            parent_reg = doc_dict['pedido_complemento']
            novo_registro = frappe.get_doc({
                "doctype": "Artigos no Pedido",
                "parent": parent_reg,
                "parenttype": "Pedidos",
                "parentfield": "artigos_do_pedido",
                "artigo": artigo_complemento['artigo'],
                "quantidade_entregue": artigo_complemento['quantidade_entregue'],
                "valor_total_entregue": artigo_complemento['valor_total_entregue']
            })
            novo_registro.insert()
            frappe.db.commit()
            
    modelos_pedido = frappe.get_all("Modelos do Artigo no Pedido", filters={"parent": doc_dict.get('pedido_complemento')}, fields=["*"])
    modelos_complemento = doc_dict.get("tabela_de_modelos")
    
    for modelo_complemento in modelos_complemento:
            modelo_complemento['encontrado'] = False
            for modelo_pedido in modelos_pedido:
                if modelo_pedido['modelo'] == modelo_complemento['modelo']:
                    modelo_complemento['encontrado'] = True
                    modelo_complemento['registro_pedido'] = modelo_pedido['name']
                    modelo_complemento['nova_quantidade'] = modelo_pedido['quantidade_entregue'] + modelo_complemento['quantidade_entregue']
                    break
                
            if modelo_complemento['encontrado']:
                registro_existente = frappe.get_doc("Modelos do Artigo no Pedido", modelo_complemento['registro_pedido'])
                registro_existente.quantidade_entregue = modelo_complemento['nova_quantidade'] 
                registro_existente.save()
                frappe.db.commit() 
            else:
                parent_reg = doc_dict['pedido_complemento']
                novo_registro = frappe.get_doc({
                    "doctype": "Modelos do Artigo no Pedido",
                    "parent": parent_reg,
                    "parenttype": "Pedidos",
                    "parentfield": "tabela_de_modelos",
                    "artigo": modelo_complemento['artigo'],
                    "modelo": modelo_complemento['modelo'],
                    "quantidade_entregue": modelo_complemento['quantidade_entregue'],
                })
                novo_registro.insert()
                frappe.db.commit()        
    atualizar_totais(doc_dict.get('pedido_complemento'))
    frappe.delete_doc("Pedidos", doc_dict.get('name'))
    frappe.db.commit()
    return doc_dict.get('pedido_complemento')
    # TODO Verificar : Indice está sendo atualizado errado, isso afeta algo ? 

@frappe.whitelist()
def atualizar_totais(doc_name):
    doc = frappe.get_doc("Pedidos", doc_name)
    # lista de 
    artigos_no_pedido = frappe.get_all("Artigos no Pedido", filters={"parent": doc_name}, fields=["*"])
    print(artigos_no_pedido)
    print(type(artigos_no_pedido))
    quantidade_entregue = 0
    valor_total_entregue = 0
    quantidade_vendida = 0
    total_vendido = 0
    
    for artigo in artigos_no_pedido:
        quantidade_entregue += artigo['quantidade_entregue']
        valor_total_entregue += artigo['valor_total_entregue']
        quantidade_vendida += artigo['quantidade_vendida']
        total_vendido += artigo['total_vendido']
        print(quantidade_entregue, valor_total_entregue, total_vendido, quantidade_vendida), 
    
    registro_atual = doc
    registro_atual.total_entregue_qtd = quantidade_entregue
    registro_atual.total_entregue_vlr = valor_total_entregue
    registro_atual.total_vendido_qtd = quantidade_vendida
    registro_atual.total_vendido_vlr = total_vendido
    
    registro_atual.save()
    frappe.db.commit() 
