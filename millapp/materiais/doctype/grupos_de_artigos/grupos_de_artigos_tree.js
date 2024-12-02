frappe.treeview_settings['Grupos de Artigos'] = {
    title: 'Grupos e Subgrupos ----',
    Breadcrumbs: "Artigos",
    get_tree_nodes: 'millapp.materiais.doctype.grupos_de_artigos.grupos_de_artigos.get_nodes',
    add_tree_node: 'millapp.materiais.doctype.grupos_de_artigos.grupos_de_artigos.add_node',
    ignore_fields: ["parent_grupo"],

    onrender: function (node) {
        // Verifica se o nó possui a rota (para artigos)
        if (node.data.route) {
            // Adiciona um evento de clique para redirecionar quando o artigo for clicado
            $(node.$tree_link).on('click', function () {
                window.location.href = node.data.route;
            });
        }
    }
}