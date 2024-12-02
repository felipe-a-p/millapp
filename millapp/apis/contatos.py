import frappe

@frappe.whitelist()
def verificar_documento(documento, tipo):
	contatos = frappe.db.get_all('Contatos', filters={tipo: documento}, fields=['name'], ignore_permissions=True)
	return contatos

@frappe.whitelist()
def buscar_contato(name):
	contato = frappe.db.get_all('Contatos', filters={'name': name}, fields=['*'], ignore_permissions=True)
	return contato

@frappe.whitelist()
def descobrir_dono(name):
	dono = frappe.db.get_all('Contatos', filters={'name': name}, fields=['owner'], ignore_permissions=True)
	return dono

@frappe.whitelist()
def compartilhar_contatos(user, owner, contato):
    # TODO - sistema@milleniuns.com.br DEVE SER UM USUARIO
    operacao = Compartilhamento(user, owner, contato)
    return operacao.status
 
class Compartilhamento:
    def __init__(self, user, owner, contato):
        self.user = user
        self.owner = owner
        self.contato = contato
        self.usuarioCentral = 'Administrator'
        self.status = ''
        
        if self.owner == self.usuarioCentral:
            self.compartilhar_com_usuario(self.user)
            
        else:
            if (self.get_permissao(self.user) and self.get_permissao(self.owner)):
                if not (self.tem_pedido_aberto() or self.tem_fatura_aberto()):
                    self.transferir_posse()
                    self.compartilhar_com_usuario(self.user)
                    self.compartilhar_com_usuario(self.owner)
                    self.status = 'Compartilhado com sucesso'
                else:
                    self.status = 'Negado por existir pedido ou fatura em aberto'
            else:
                self.status = 'Negado por falta de permissão'
                
    
    def compartilhar_com_usuario(self, usuario):
        try:
            frappe.set_user('Administrator')
            frappe.share.add('Contatos', self.contato, usuario, write=1, share=1)
        finally:
            frappe.set_user(usuario)    
            
    def get_permissao(self, usuario):
        return frappe.db.get_all('Configuracoes de Users', filters={'usuario':usuario},fields=['*'], ignore_permissions=True)

    def transferir_posse(self):
        frappe.db.set_value('Contatos', self.contato, 'owner', self.usuarioCentral)
        
    def tem_pedido_aberto(self): 
        pedidos_abertos = frappe.db.get_all(
            'Pedidos',
            filters={
                'cliente': self.contato,
                'pedido_state': ['!=', 'Faturado']
            },
            fields=['*'],
            ignore_permissions=True
        )
        if pedidos_abertos:
            return True
        else:
            return False
    
    def tem_fatura_aberto(self):
        faturas_abertas = frappe.db.get_all(
            'Faturamentos',
            filters={
                'cliente': self.contato,
                'faturamento_state': ['!=', 'Pago']
            },
            fields=['*'],
            ignore_permissions=True
        )
        if faturas_abertas:
            return True
        else:
            return False