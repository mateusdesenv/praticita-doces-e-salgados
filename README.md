# Praticità — Site inspirado no protótipo

Site estático em HTML, CSS e JavaScript.

## Arquivos
- index.html
- styles.css
- script.js
- assets/

## Como usar
Abra o `index.html` no navegador ou suba a pasta inteira em uma hospedagem estática.

## Observações
- Imagens geradas em estilo coerente com a identidade visual da Praticità.
- CTAs apontam para WhatsApp com mensagens pré-preenchidas.
- Tipografia:
  - Poppins para interface.
  - Playfair Display para títulos editoriais.
  - Great Vibes para detalhe manuscrito.


## Tipografia da marca
- Textos/interface: Poppins, conforme manual da marca.
- Logotipo: Wilmina preservada na própria imagem da logo.
- Observação: o pacote de identidade não trouxe o arquivo de fonte Wilmina, então ela não foi incorporada como fonte web.


## Atualização visual
- Imagens dos cards de produto escurecidas propositalmente.
- Marca d'água "Em breve" aplicada sobre os cards de produto.


## Atualização de conteúdo
- Seção 'Nossos produtos' removida.
- Sessões 'Sobre a Dani' e 'Sobre a Cleu' adicionadas com fotos fornecidas pelo cliente.

## Atualização de destaques e cardápio
- Destaques agora usam apenas imagens reais enviadas pelo cliente.
- Página `cardapio.html` criada com todos os itens do JSON, sem imagens.
- Botão "Ver mais" nos destaques redireciona para o cardápio completo.

## Atualização
- Imagens da seção de contato removidas.
- Imagem institucional substituída pela foto das sócias.

## Atualização de contato e footer
- Seção de contato redesenhada.
- Links de WhatsApp padronizados para: https://wa.me/554999916511?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20Praticit%C3%A0%20e%20quero%20fazer%20uma%20encomenda.
- Link de Instagram padronizado para: https://www.instagram.com/praticita_doces_e_salgados/
- Footer revisado com navegação e CTAs funcionais.

## Carrinho de pedidos
- Botões "Adicionar ao carrinho" adicionados nos destaques da home e nos itens de `cardapio.html`.
- Carrinho persistido em `localStorage` na chave `praticita_cart`.
- Botão "Ver carrinho" abre painel lateral à direita.
- Painel permite aumentar/diminuir quantidade, remover itens, limpar carrinho e finalizar pedido.
- Finalização monta mensagem completa e abre WhatsApp com o pedido pronto.

## Correção de cards e variações
- Cards da tela inicial reconstruídos para corrigir quebra de layout.
- Produtos com mais de uma variação agora exibem seletor de tamanho/opção.
- O botão de adicionar ao carrinho exige seleção de variação antes de adicionar.
- A opção selecionada entra no carrinho e na mensagem final do WhatsApp.
