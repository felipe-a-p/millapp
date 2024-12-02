# Copyright (c) 2024, Felipe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Contatos(Document):
    def before_save(self):
        nome = self.nome
        sobrenome = self.sobrenome
        cidade = self.cidade
        if not self.cod_identificador:
            cod_existentes = frappe.db.sql_list("""
                SELECT cod_identificador FROM `tabContatos` 
                WHERE cod_identificador IS NOT NULL
            """)
            cod_existentes = [int(cod) for cod in cod_existentes if cod.isdigit()]
            cod_existentes.sort()
            menor_disponivel = 1
            for cod in cod_existentes:
                if cod == menor_disponivel:
                    menor_disponivel += 1
                else:
                    break
            self.cod_identificador = str(menor_disponivel)
        
        self.name = f"{nome} {sobrenome} - {cidade} - {self.cod_identificador}"
