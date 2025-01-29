# Copyright (c) 2024, Felipe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Contatos(Document):
    def on_change(self):
        nome = self.nome
        sobrenome = self.sobrenome

        # Verifica se os campos obrigatórios estão preenchidos
        if not nome or not sobrenome:
            frappe.throw("Os campos Nome, Sobrenome e Cidade são obrigatórios para salvar.")

        novo_nome = f"{nome} {sobrenome} - {self.cod_identificador}"

        # Atualiza o nome apenas se ele for diferente do nome atual
        if novo_nome != self.name:
            if self.is_new():
                self.name = novo_nome
            else:
                frappe.rename_doc(self.doctype, self.name, novo_nome, force=True)

  
            frappe.msgprint(f"Documento renomeado de {self.name} para {novo_nome}.")