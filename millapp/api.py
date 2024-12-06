import frappe
import json

@frappe.whitelist()
def atualizar_campos(doctype, name, campos_json):
    campos = json.loads(campos_json)
    doc = frappe.get_doc(doctype, name)
    
    for campo, valor in campos.items():
        setattr(doc, campo, valor)
    
    doc.save()
    
    return doc.name

@frappe.whitelist()
def criar_registro(doctype, campos_valores):
    print('velho_api, refatore-me')
    campos_valores = json.loads(campos_valores)  # Desserializa o JSON em um dicionário
    novo_registro = frappe.get_doc({
        'doctype': doctype,
        **campos_valores
    })
    print(novo_registro)
    novo_registro.insert(ignore_permissions=True)
    return novo_registro.name


@frappe.whitelist()
def get_user_permlevel(user, doctype):
    permlevel = frappe.get_all('DocPerm', filters={'parent': doctype, 'role': ['in', frappe.get_roles(user)]}, fields=['*'])
    return permlevel

@frappe.whitelist()
def get_preco_do_artigo(artigo, tabela):
    preco = frappe.db.get_value('Preco do Artigo', {'parent': artigo, 'ligacao_tabela_de_preco': tabela}, 'preco')
    if preco:
        return preco
    return None

@frappe.whitelist()
def get_artigo_codigo_de_barras(codigo):
    artigo = frappe.db.get_all('Modelos de Artigos', filters={'codigo_de_barras_numeros': codigo})
    if artigo:
        return artigo
    else:
        return None

@frappe.whitelist()
def get_dados_dos_artigos(tabela_de_precos):
    dados = {
        'artigos':  frappe.get_all('Artigos', ['name', 'referencia']),
        'modelos': frappe.get_all('Modelos de Artigos', ['name', 'codigo_de_barras_numeros', 'parent', 'tamanho', 'modelo', 'modelo_padrao']),      
        'precos':  frappe.get_all('Preco do Artigo', ['parent', 'preco'], filters={'ligacao_tabela_de_preco': tabela_de_precos}),
        }
    
    return dados

@frappe.whitelist()
def verificar_codigo_de_barras_unico(codigo):
    artigo = frappe.db.get_all('Modelos de Artigos', filters={'codigo_de_barras_numeros': codigo})
    if artigo:
        return {'unico': False}
    else:
        return {'unico': True}
    
@frappe.whitelist()
def get_descontos(tipo):
    return frappe.get_all('Regras de Descontos', filters={'tipo': tipo}, fields=['de', 'ate', 'pc_desconto'])

@frappe.whitelist()
def criar_notificacao(usuario_receptor, mensagem, doctype, nome_documento, assunto = "Nova Notificação", enviado_de = "Sistema"):
    # Cria uma notificação que aparecerá no sino
    frappe.get_doc({
        "doctype": "Notification Log",
        "for_user": usuario_receptor,
        "from_user": enviado_de,
        "subject": assunto,
        "email_content": mensagem,
        "document_type": doctype,
        "document_name": nome_documento  
    }).insert(ignore_permissions=True)
    
@frappe.whitelist()
def get_user_groups(user):
    user_groups = frappe.get_all('User Group Member', fields='*')
    return user_groups
