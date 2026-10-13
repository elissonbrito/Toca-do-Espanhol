"""
Popula o cardápio.

- ITENS_EXEMPLO: itens de demonstração já classificados fiscalmente.
- CARDAPIO: o cardápio real do restaurante. Campos fiscais NCM, CFOP e CSOSN
  ficam EM BRANCO de propósito — o contador preenche depois. A conferência
  fiscal (GET /api/menu/items/fiscal_report/) aponta essas pendências.

Idempotente: usa get_or_create por SKU, então rodar de novo não duplica nem
sobrescreve o que já foi ajustado (inclusive os dados fiscais do contador).

Uso: python manage.py seed_menu
     python manage.py seed_menu --if-empty   # produção: só popula cardápio vazio
                                             # (não ressuscita itens apagados)
"""
from django.core.management.base import BaseCommand

from apps.menu.models import MenuCategory, MenuItem

CATEGORIAS = [
    ('Entradas', 5),
    ('Na Brasa', 12),
    ('Guarnições', 20),
    ('Parrilla', 10),
    ('Bebidas sem álcool', 30), ('Cervejas', 40), ('Vinhos', 50), ('Cafés e Doces', 60),
]

# Itens de demonstração — (categoria, nome, setor, preço, sku, gtin, ncm, cest, cfop, csosn, un)
ITENS_EXEMPLO = [
    ('Parrilla', 'Bife de Chorizo 350g', 'PARRILLA', '89.90', 'PAR-CHORIZO-350', '', '02013000', '', '5101', '102', 'UN'),
    ('Parrilla', 'Ancho 400g', 'PARRILLA', '99.90', 'PAR-ANCHO-400', '', '02013000', '', '5101', '102', 'UN'),
    ('Parrilla', 'Costela no rolo (kg)', 'PARRILLA', '129.90', 'PAR-COSTELA-KG', '', '02013000', '', '5101', '102', 'KG'),
    ('Parrilla', 'Linguiça artesanal', 'PARRILLA', '39.90', 'PAR-LINGUICA', '', '16010000', '', '5101', '102', 'PT'),
    ('Guarnições', 'Batatas rústicas', 'COZINHA', '24.90', 'GUA-BATATA-RUST', '', '20052000', '', '5101', '102', 'PT'),
    ('Guarnições', 'Arroz biro-biro', 'COZINHA', '22.90', 'GUA-ARROZ-BIRO', '', '19022000', '', '5101', '102', 'PT'),
    ('Guarnições', 'Farofa da casa', 'COZINHA', '16.90', 'GUA-FAROFA', '', '19019090', '', '5101', '102', 'PT'),
    ('Entradas', 'Provoleta na chapa', 'PARRILLA', '44.90', 'ENT-PROVOLETA', '', '04061090', '', '5101', '102', 'UN'),
    ('Entradas', 'Chimichurri (pote 100g)', 'COZINHA', '9.90', 'ENT-CHIMI-100', '', '21039021', '', '5102', '102', 'UN'),
    ('Bebidas sem álcool', 'Água mineral 500ml', 'BAR', '6.00', 'BEB-AGUA-500', '7891910000147', '22011000', '0300700', '5405', '500', 'UN'),
    ('Bebidas sem álcool', 'Refrigerante lata 350ml', 'BAR', '8.00', 'BEB-REFRI-350', '7894900011517', '22021000', '0300800', '5405', '500', 'UN'),
    ('Bebidas sem álcool', 'Suco natural laranja 300ml', 'BAR', '12.00', 'BEB-SUCO-LAR-300', '', '20091200', '', '5102', '102', 'UN'),
    ('Cervejas', 'Chopp Pilsen 500ml', 'BAR', '16.00', 'CER-CHOPP-500', '', '22030000', '0301100', '5405', '500', 'UN'),
    ('Cervejas', 'Cerveja long neck 355ml', 'BAR', '14.00', 'CER-LN-355', '7891149102037', '22030000', '0301100', '5405', '500', 'UN'),
    ('Vinhos', 'Malbec taça 150ml', 'BAR', '29.00', 'VIN-MALBEC-TACA', '', '22042100', '0302200', '5405', '500', 'UN'),
    ('Vinhos', 'Malbec garrafa 750ml', 'BAR', '169.00', 'VIN-MALBEC-750', '', '22042100', '0302200', '5405', '500', 'GF'),
    ('Cafés e Doces', 'Café espresso', 'BAR', '7.00', 'CAF-ESPRESSO', '', '21011110', '', '5102', '102', 'UN'),
    ('Cafés e Doces', 'Pudim de leite', 'COZINHA', '18.00', 'DOC-PUDIM', '', '19053100', '', '5101', '102', 'UN'),
]

# Cardápio real — (categoria, nome, setor, preço, sku, descrição/porção, unidade).
# Destino de impressão pelo SETOR: PARRILLA -> impressora da parrilla + painel
# da cozinha; COZINHA -> impressora + painel da cozinha; BAR -> só impressora.
# NCM / CFOP / CSOSN entram VAZIOS (pendentes para o contador).
CARDAPIO = [
    # Entradas -> impressora + cozinha
    ('Entradas', 'Pastel (8 unid)', 'COZINHA', '50.00', 'ENT-01', '8 unid', 'UN'),
    ('Entradas', 'Batata Frita', 'COZINHA', '35.00', 'ENT-02', 'porção', 'PT'),
    ('Entradas', 'Pão de Alho c/ Linguiça', 'COZINHA', '45.00', 'ENT-03', '2 pães + 4 linguiças', 'UN'),
    ('Entradas', 'Pão de Alho (unid)', 'COZINHA', '7.00', 'ENT-04', 'unid', 'UN'),
    ('Entradas', 'Linguiça Aperitivo (4 unid)', 'COZINHA', '42.00', 'ENT-05', '4 unid', 'UN'),
    ('Entradas', 'Salada de Palmito', 'COZINHA', '60.00', 'ENT-06', 'porção', 'PT'),

    # Pratos principais "Na Brasa" -> parrilla + painel da cozinha
    ('Na Brasa', 'Picanha 2kg', 'PARRILLA', '430.00', 'BRA-01', '2kg - 4 pessoas', 'UN'),
    ('Na Brasa', 'Picanha 1kg', 'PARRILLA', '265.00', 'BRA-02', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Churrasco Misto - Picanha', 'PARRILLA', '290.00', 'BRA-03', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Churrasco Misto - Chorizo', 'PARRILLA', '275.00', 'BRA-04', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Parrilla do Assador (picanha, ancho e chorizo)', 'PARRILLA', '360.00', 'BRA-05', '1.4kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Bife de Chorizo', 'PARRILLA', '250.00', 'BRA-06', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Filé Mignon', 'PARRILLA', '270.00', 'BRA-07', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Bife de Chorizo c/ Crosta de Alho', 'PARRILLA', '265.00', 'BRA-08', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Bife Ancho', 'PARRILLA', '260.00', 'BRA-09', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Bife Ancho c/ Crosta de Gorgonzola', 'PARRILLA', '280.00', 'BRA-10', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', "T'Bone", 'PARRILLA', '260.00', 'BRA-11', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Short Rib', 'PARRILLA', '240.00', 'BRA-12', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Filé de Coxa do Assador', 'PARRILLA', '180.00', 'BRA-13', '1kg - 2 pessoas', 'UN'),
    ('Na Brasa', 'Salmão na Brasa c/ Molho de Alcaparras', 'PARRILLA', '250.00', 'BRA-14', '1kg - 2 pessoas', 'UN'),

    # Guarnições / acompanhamentos -> impressora + cozinha
    ('Guarnições', 'Batata Frita', 'COZINHA', '35.00', 'GUA-01', 'porção', 'PT'),
    ('Guarnições', 'Batata Noisette', 'COZINHA', '35.00', 'GUA-02', 'porção', 'PT'),
    ('Guarnições', 'Farofa de Ovo', 'COZINHA', '28.00', 'GUA-03', 'porção', 'PT'),
    ('Guarnições', 'Farofa Tradicional', 'COZINHA', '12.00', 'GUA-04', 'porção', 'PT'),
    ('Guarnições', 'Arroz', 'COZINHA', '22.00', 'GUA-05', 'porção', 'PT'),
    ('Guarnições', 'Arroz à Piamontese', 'COZINHA', '32.00', 'GUA-06', 'porção', 'PT'),
    ('Guarnições', 'Feijão', 'COZINHA', '12.00', 'GUA-07', 'porção', 'PT'),
    ('Guarnições', 'Maionese', 'COZINHA', '18.00', 'GUA-08', 'porção', 'PT'),
    ('Guarnições', 'Molho à Campanha', 'COZINHA', '12.00', 'GUA-09', 'porção', 'PT'),
    ('Guarnições', 'Ovo Frito (02 unid)', 'COZINHA', '12.00', 'GUA-10', '2 unid', 'UN'),
    ('Guarnições', 'Banana Frita', 'COZINHA', '12.00', 'GUA-11', 'porção', 'PT'),
    ('Guarnições', 'Farofa de Bacon Crocante c/ Panko', 'COZINHA', '20.00', 'GUA-12', 'porção', 'PT'),
]


class Command(BaseCommand):
    help = 'Popula o cardápio (exemplos + cardápio real). Idempotente.'

    def add_arguments(self, parser):
        parser.add_argument('--if-empty', action='store_true',
                            help='Só popula se ainda não houver nenhum item no cardápio.')

    def handle(self, *args, **options):
        if options['if_empty'] and MenuItem.objects.exists():
            self.stdout.write('ℹ️  Cardápio já existe — nada a fazer (--if-empty).')
            return
        cats = {}
        for nome, ordem in CATEGORIAS:
            cat, _ = MenuCategory.objects.get_or_create(name=nome, defaults={'display_order': ordem})
            cats[nome] = cat
        self.stdout.write(self.style.SUCCESS(f'{len(cats)} categorias.'))

        criados = 0
        for (cat, nome, setor, preco, sku, gtin, ncm, cest, cfop, csosn, un) in ITENS_EXEMPLO:
            _, created = MenuItem.objects.get_or_create(sku=sku, defaults=dict(
                category=cats[cat], name=nome, sector=setor, price=preco,
                barcode_gtin=gtin, ncm=ncm, cest=cest, cfop=cfop, csosn=csosn,
                unit_commercial=un, unit_taxable=un, origem='0',
                pis_cst='49', cofins_cst='49',
            ))
            criados += int(created)

        pendentes = 0
        for (cat, nome, setor, preco, sku, descricao, un) in CARDAPIO:
            obj, created = MenuItem.objects.get_or_create(sku=sku, defaults=dict(
                category=cats[cat], name=nome, sector=setor, price=preco,
                description=descricao,
                # Fiscais obrigatórios, porém em branco — o contador preenche.
                ncm='', cest='', cfop='', csosn='',
                unit_commercial=un, unit_taxable=un, origem='0',
                pis_cst='49', cofins_cst='49',
            ))
            criados += int(created)
            if not (obj.ncm and obj.cfop and obj.csosn):
                pendentes += 1

        self.stdout.write(self.style.SUCCESS(
            f'{criados} itens novos ({MenuItem.objects.count()} no total).'))
        if pendentes:
            self.stdout.write(self.style.WARNING(
                f'{pendentes} itens do cardápio real com NCM/CFOP/CSOSN pendentes — '
                f'rode a conferência: GET /api/menu/items/fiscal_report/'))
