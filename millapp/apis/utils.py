import frappe
import json
import ast


@frappe.whitelist()
def verificar_registro_aberto(doctype, cliente, estado_campo, estados_excluidos):
    filtros = {
        'cliente': cliente
    }
    
    if isinstance(estados_excluidos, str):
        try:
            estados_excluidos = ast.literal_eval(estados_excluidos)
        except (ValueError, SyntaxError):
            estados_excluidos = [estados_excluidos]
    
    filtros[estado_campo] = ['not in', estados_excluidos]
    
    registros = frappe.get_all(
        doctype,
        filters=filtros,
        fields=['name'],
        limit_page_length=1,
        ignore_permissions=True
    )
    
    return bool(registros)

@frappe.whitelist()
def criar_registro(doctype, campos_valores):
    campos_valores = json.loads(campos_valores)  # Desserializa o JSON em um dicionário
    novo_registro = frappe.get_doc({
        'doctype': doctype,
        **campos_valores
    })
    print(novo_registro)
    novo_registro.insert(ignore_permissions=True)
    return novo_registro.name

@frappe.whitelist()
def atualizar_campos(doctype, name, campos_json):
    import json

    print(f"Atualizando {doctype} {name} com {campos_json}")
    campos = json.loads(campos_json)  # Parse o JSON enviado
    doc = frappe.get_doc(doctype, name)  # Obtenha o documento principal

    for campo, valor in campos.items():
        if isinstance(valor, list) and campo in [f.fieldname for f in doc.meta.get_table_fields()]:
            doc.set(campo, [])
            for item in valor:
                doc.append(campo, frappe._dict(item))
        else:
            setattr(doc, campo, valor)

    try:
        doc.save()
        frappe.db.commit()
        return doc.name
    except Exception as e:
        frappe.log_error(message=str(e), title="Erro ao atualizar campos")
        raise frappe.ValidationError(f"Erro ao atualizar campos: {str(e)}")

@frappe.whitelist()
def get_filhos(doctype, parent_name):
    filhos = frappe.get_all(
        doctype,
        filters={'parent': parent_name},
        fields=['name'],
        ignore_permissions=True 
    )
    print(filhos)
    return filhos


