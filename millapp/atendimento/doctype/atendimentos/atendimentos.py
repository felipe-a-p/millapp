import frappe
from frappe.model.document import Document

class Atendimentos(Document):
    def get_autoname(self):
        # Gerar o nome com base nos campos cliente e responsável
        nome = self.cliente
        resp_padrao = self.resp_padrao if self.resp_padrao else "Sem responsável"  # Valor padrão

        # Garantir que os campos obrigatórios estão preenchidos
        if not nome:
            frappe.throw("O campo Cliente é obrigatório.")
        
        novo_nome = f"{nome} - {resp_padrao}"
        return novo_nome

    def on_update(self):
        # Quando o documento é atualizado, garantir que o nome é atualizado também
        resp_padrao = self.resp_padrao if self.resp_padrao else "Sem responsável"  # Valor padrão
        novo_nome = f"{self.cliente} - {resp_padrao}"
        
        if self.name != novo_nome:
            # Atualiza o nome do documento, se necessário
            frappe.rename_doc(self.doctype, self.name, novo_nome, force=True)

            # Configurar o redirecionamento após a mudança do nome
            frappe.local.flags.redirect_to = f"/app/{self.doctype}/{novo_nome}"

        # Forçar redirecionamento após salvar a mudança
        if 'redirect_to' in frappe.local.flags:
            frappe.local.response['location'] = frappe.local.flags.redirect_to
