-- =============================================================================
-- 11 — Playbook 2026 (seed / conteúdo-semente)
-- =============================================================================
-- Insere os dados DEFAULT que antes ficavam embutidos no JS do HTML
-- (Playbook_2026_TecnoFink_5.html) nas tabelas criadas em 10_playbook.sql.
--
-- Semeia APENAS o conteúdo de catálogo/estrutura. NÃO semeia tabelas que
-- nascem vazias: logística, custos, leads, portais, marcações de checklist,
-- stands 2027 e workshops.
--
-- RE-EXECUTÁVEL: começa apagando (DELETE) só as tabelas que semeia, na ordem
-- segura de FK (filhos antes dos pais). Não toca em logística/leads/portais/
-- marcações/stands/workshops nem nos editores.
--
-- Todas as FKs são resolvidas por subquery sobre slug/nome/ordem, porque os
-- ids são uuid gerados pelo banco.
--
-- ATENÇÃO: o runner já roda este script dentro de uma transação — não usar
-- begin/commit aqui.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Reset seguro (filhos antes dos pais). Só as tabelas semeadas aqui.
-- ----------------------------------------------------------------------------
delete from playbook_catalogo_consumo;
delete from playbook_itens;
delete from playbook_categorias;
delete from playbook_setores;
delete from playbook_catalogos;
delete from playbook_eventos_catalogo;
delete from playbook_associacao_beneficios;
delete from playbook_associacoes;
delete from playbook_prospeccao_eventos;
delete from playbook_prospeccao_setores;
delete from playbook_brinde_usos;
delete from playbook_brindes;
delete from playbook_eventos;


-- ============================================================================
-- SEÇÃO 01 — Eventos (EVENTOS_DEFAULT: 8 nacionais + 2 internacionais)
-- ordem 1..10 segue o "num" original; status com enum exato (acentuado).
-- ============================================================================
insert into playbook_eventos (slug, nome, local, data, tipo, status, obs, is_custom, ordem) values
  ('fbcc',       'FBCC',            'Rio de Janeiro',   '12 de Maio',           'nacional',      'CONCLUÍDO',     '',                  false, 1),
  ('bahia',      'Bahia Oil & Gas', 'Salvador',         '27 a 29 de Maio',      'nacional',      'CONCLUÍDO',     'Contrato assinado', false, 2),
  ('usipa',      'Expo Usipa',      'Ipatinga — MG',    '8 a 10 de Julho',      'nacional',      'EM ANDAMENTO',  'Contrato assinado', false, 3),
  ('mec',        'MEC Show',        'Espírito Santo',   '4 a 6 de Agosto',      'nacional',      'EM ANDAMENTO',  'Contrato assinado', false, 4),
  ('exposibram', 'Exposibram',      'Belo Horizonte',   '24 a 27 de Agosto',    'nacional',      'EM ANDAMENTO',  'Contrato assinado', false, 5),
  ('rio',        'Rio Oil & Gas',   'Rio de Janeiro',   '21 a 24 de Setembro',  'nacional',      'EM ANDAMENTO',  'Contrato assinado', false, 6),
  ('ccipra',     'CCipra',          'Búzios',           '11 e 12 de Novembro',  'nacional',      'NÃO INICIADO',  '',                  false, 7),
  ('csn',        'CSN Workshop',    'Rio de Janeiro',   'A definir',            'nacional',      'NÃO INICIADO',  '',                  false, 8),
  ('ampp',       'AMPP',            'Houston, EUA',     '15 a 19 de Março',     'internacional', 'CONCLUÍDO',     '',                  false, 9),
  ('otc',        'OTC',             'Houston, EUA',     '4 a 7 de Maio',        'internacional', 'CONCLUÍDO',     '',                  false, 10);


-- ============================================================================
-- SEÇÃO 02 — Catálogos
-- ============================================================================

-- Eventos-coluna do catálogo (EVENTOS_CATALOGO), ordem 0..6
insert into playbook_eventos_catalogo (nome, data, ordem) values
  ('Bahia O&G',  '27-29/05',  0),
  ('Expo Usipa', '08-10/07',  1),
  ('Mec Show',   '04-06/08',  2),
  ('Exposibram', '24-27/08',  3),
  ('Rio O&G',    '21-24/09',  4),
  ('CCIPRA',     '11-12/11',  5),
  ('CSN',        'a definir', 6);

-- Produtos do catálogo (CATALOGOS_DATA: 12 gerais + 8 powerpoxi)
-- estoque = estoque atual; consumo_anual = campo "consumo".
insert into playbook_catalogos (nome, grupo, estoque, consumo_anual, is_custom, ordem) values
  ('Tapeglass',          'gerais',    1333, 2520, false, 0),
  ('Stanc Ball',         'gerais',    267,  1820, false, 1),
  ('Compósito',          'gerais',    1254, 1820, false, 2),
  ('CorroFink',          'gerais',    1037, 1820, false, 3),
  ('TVVA',               'gerais',    406,  1820, false, 4),
  ('Rydlyme',            'gerais',    2312, 1820, false, 5),
  ('Inductosense',       'gerais',    148,  1820, false, 6),
  ('Intercept',          'gerais',    442,  1820, false, 7),
  ('Multimettal',        'gerais',    71,   1820, false, 8),
  ('Weldfit',            'gerais',    75,   1820, false, 9),
  ('Tribosonics',        'gerais',    163,  1820, false, 10),
  ('CorrosionRADAR',     'gerais',    143,  1820, false, 11),
  ('Powerpoxi Geral Novo','powerpoxi',365,  1820, false, 12),
  ('MaxComp',            'powerpoxi', 905,  1770, false, 13),
  ('MaxPrimer',          'powerpoxi', 454,  1770, false, 14),
  ('MaxWrap',            'powerpoxi', 390,  1770, false, 15),
  ('MaxVisco',           'powerpoxi', 453,  1770, false, 16),
  ('MaxCeramic',         'powerpoxi', 140,  1770, false, 17),
  ('MaxMetal',           'powerpoxi', 0,    1770, false, 18),
  ('MaxEwrap',           'powerpoxi', 375,  0,    false, 19);

-- Consumo por evento (consumoEvt[7]) ligado ao evento-coluna pela ordem (0..6).
-- FKs resolvidas por subquery: catálogo por nome, evento-coluna por ordem.
insert into playbook_catalogo_consumo (catalogo_id, evento_catalogo_id, qtd)
select c.id, e.id, v.qtd
from (values
  -- gerais
  ('Tapeglass',      0, 350), ('Tapeglass',      1, 200), ('Tapeglass',      2, 350), ('Tapeglass',      3, 350), ('Tapeglass',      4, 350), ('Tapeglass',      5, 500), ('Tapeglass',      6, 250),
  ('Stanc Ball',     0, 200), ('Stanc Ball',     1, 150), ('Stanc Ball',     2, 200), ('Stanc Ball',     3, 200), ('Stanc Ball',     4, 200), ('Stanc Ball',     5, 500), ('Stanc Ball',     6, 200),
  ('Compósito',      0, 200), ('Compósito',      1, 150), ('Compósito',      2, 200), ('Compósito',      3, 200), ('Compósito',      4, 200), ('Compósito',      5, 500), ('Compósito',      6, 200),
  ('CorroFink',      0, 200), ('CorroFink',      1, 150), ('CorroFink',      2, 200), ('CorroFink',      3, 200), ('CorroFink',      4, 200), ('CorroFink',      5, 500), ('CorroFink',      6, 200),
  ('TVVA',           0, 200), ('TVVA',           1, 150), ('TVVA',           2, 200), ('TVVA',           3, 200), ('TVVA',           4, 200), ('TVVA',           5, 500), ('TVVA',           6, 200),
  ('Rydlyme',        0, 200), ('Rydlyme',        1, 150), ('Rydlyme',        2, 200), ('Rydlyme',        3, 200), ('Rydlyme',        4, 200), ('Rydlyme',        5, 500), ('Rydlyme',        6, 200),
  ('Inductosense',   0, 200), ('Inductosense',   1, 150), ('Inductosense',   2, 200), ('Inductosense',   3, 200), ('Inductosense',   4, 200), ('Inductosense',   5, 500), ('Inductosense',   6, 200),
  ('Intercept',      0, 200), ('Intercept',      1, 150), ('Intercept',      2, 200), ('Intercept',      3, 200), ('Intercept',      4, 200), ('Intercept',      5, 500), ('Intercept',      6, 200),
  ('Multimettal',    0, 200), ('Multimettal',    1, 150), ('Multimettal',    2, 200), ('Multimettal',    3, 200), ('Multimettal',    4, 200), ('Multimettal',    5, 500), ('Multimettal',    6, 200),
  ('Weldfit',        0, 200), ('Weldfit',        1, 150), ('Weldfit',        2, 200), ('Weldfit',        3, 200), ('Weldfit',        4, 200), ('Weldfit',        5, 500), ('Weldfit',        6, 200),
  ('Tribosonics',    0, 200), ('Tribosonics',    1, 150), ('Tribosonics',    2, 200), ('Tribosonics',    3, 200), ('Tribosonics',    4, 200), ('Tribosonics',    5, 500), ('Tribosonics',    6, 200),
  ('CorrosionRADAR', 0, 200), ('CorrosionRADAR', 1, 150), ('CorrosionRADAR', 2, 200), ('CorrosionRADAR', 3, 200), ('CorrosionRADAR', 4, 200), ('CorrosionRADAR', 5, 500), ('CorrosionRADAR', 6, 200),
  -- powerpoxi
  ('Powerpoxi Geral Novo', 0, 200), ('Powerpoxi Geral Novo', 1, 150), ('Powerpoxi Geral Novo', 2, 200), ('Powerpoxi Geral Novo', 3, 200), ('Powerpoxi Geral Novo', 4, 200), ('Powerpoxi Geral Novo', 5, 500), ('Powerpoxi Geral Novo', 6, 200),
  ('MaxComp',        0, 100), ('MaxComp',        1, 200), ('MaxComp',        2, 200), ('MaxComp',        3, 200), ('MaxComp',        4, 200), ('MaxComp',        5, 500), ('MaxComp',        6, 200),
  ('MaxPrimer',      0, 100), ('MaxPrimer',      1, 200), ('MaxPrimer',      2, 200), ('MaxPrimer',      3, 200), ('MaxPrimer',      4, 200), ('MaxPrimer',      5, 500), ('MaxPrimer',      6, 200),
  ('MaxWrap',        0, 100), ('MaxWrap',        1, 200), ('MaxWrap',        2, 200), ('MaxWrap',        3, 200), ('MaxWrap',        4, 200), ('MaxWrap',        5, 500), ('MaxWrap',        6, 200),
  ('MaxVisco',       0, 100), ('MaxVisco',       1, 200), ('MaxVisco',       2, 200), ('MaxVisco',       3, 200), ('MaxVisco',       4, 200), ('MaxVisco',       5, 500), ('MaxVisco',       6, 200),
  ('MaxCeramic',     0, 100), ('MaxCeramic',     1, 200), ('MaxCeramic',     2, 200), ('MaxCeramic',     3, 200), ('MaxCeramic',     4, 200), ('MaxCeramic',     5, 500), ('MaxCeramic',     6, 200),
  ('MaxMetal',       0, 100), ('MaxMetal',       1, 200), ('MaxMetal',       2, 200), ('MaxMetal',       3, 200), ('MaxMetal',       4, 200), ('MaxMetal',       5, 500), ('MaxMetal',       6, 200),
  ('MaxEwrap',       0, 0),   ('MaxEwrap',       1, 0),   ('MaxEwrap',       2, 0),   ('MaxEwrap',       3, 0),   ('MaxEwrap',       4, 0),   ('MaxEwrap',       5, 0),   ('MaxEwrap',       6, 0)
) as v(nome, ord, qtd)
join playbook_catalogos c on c.nome = v.nome
join playbook_eventos_catalogo e on e.ordem = v.ord;


-- ============================================================================
-- SEÇÃO 03 — Checklist / Página da Feira (setores, categorias, itens)
-- ============================================================================

-- Setores (SETORES_PADRAO), ordem 0..6
insert into playbook_setores (nome, ordem) values
  ('Reparos Emergenciais',   0),
  ('Trepanação',             1),
  ('Limpeza Química',        2),
  ('Reparos Contingenciais', 3),
  ('Reparos Normatizados',   4),
  ('Proteção Anticorrosiva', 5),
  ('Monitoramento',          6);

-- Categorias (CATEGORIAS_DEFAULT + CATS_NOVAS_SETOR), na ordem final de
-- ORDEM_CATS. setor_id resolvido por SETOR_DE; "gerais" sem setor -> null.
insert into playbook_categorias (slug, nome, setor_id, ordem)
select v.slug, v.nome, s.id, v.ordem
from (values
  ('cat_stancball',     'Stanc Ball',                  'Reparos Emergenciais',   0),
  ('cat_tapeglass',     'Tapeglass',                   'Reparos Emergenciais',   1),
  ('cat_weldfit',       'Weldfit',                     'Trepanação',             2),
  ('cat_petersen',      'Petersen',                    'Trepanação',             3),
  ('cat_romacon',       'Romacon',                     'Trepanação',             4),
  ('cat_rydlyme',       'RydLyme',                     'Limpeza Química',        5),
  ('cat_tvva',          'TVVA',                        'Reparos Contingenciais', 6),
  ('cat_composito',     'Compósito',                   'Reparos Normatizados',   7),
  ('cat_corrofink',     'CorroFink',                   'Proteção Anticorrosiva', 8),
  ('cat_multimetall',   'Multimetall (MM)',            'Proteção Anticorrosiva', 9),
  ('cat_powerpoxi',     'PowerPoxi',                   'Proteção Anticorrosiva', 10),
  ('cat_intercept',     'Intercept',                   'Proteção Anticorrosiva', 11),
  ('cat_inductosense',  'Inductosense',                'Monitoramento',          12),
  ('cat_tribosonics',   'Tribosonics',                 'Monitoramento',          13),
  ('cat_corrosionradar','CorrosionRADAR',              'Monitoramento',          14),
  ('cat_materiais',     'Materiais em Geral',          null,                     15),
  ('cat_folders',       'Folders / Catálogos impressos',null,                    16),
  ('cat_ferramentas',   'Caixa de Ferramentas',        null,                     17)
) as v(slug, nome, setor_nome, ordem)
left join playbook_setores s on s.nome = v.setor_nome;

-- Itens (CATEGORIAS_DEFAULT.itens), nomes já passados por limparNomeItem()
-- (removidos os sufixos " · ×N" e " · RADAR/FOLDER/F-xxxx").
-- categoria_id resolvido por slug.
insert into playbook_itens (categoria_id, slug, nome, ordem)
select c.id, v.slug, v.nome, v.ordem
from (values
  -- Compósito
  ('cat_composito',     'it_composito_1',     'Suporte metálico — base, 2 pilares, trava superior', 0),
  ('cat_composito',     'it_composito_2',     'Tubos com Compósito aplicados', 1),
  ('cat_composito',     'it_composito_3',     'Tubo alumínio c/ Compósito aplicado em corte', 2),
  ('cat_composito',     'it_composito_4',     'Tubo amostra só Compósito', 3),
  ('cat_composito',     'it_composito_5',     'Placa amostra de Compósito', 4),
  -- Multimetall (MM)
  ('cat_multimetall',   'it_multimetall_1',   'Kits amostra 50g completo', 0),
  -- Tapeglass
  ('cat_tapeglass',     'it_tapeglass_1',     'Bandagens TapeGlass (05150)', 0),
  ('cat_tapeglass',     'it_tapeglass_2',     'Dispositivo bancada completo (tampo, bomba, mangueira, balde, transformador, rolo furador)', 1),
  ('cat_tapeglass',     'it_tapeglass_3',     'Tubos de demonstração c/ 02-03 furos tampados', 2),
  ('cat_tapeglass',     'it_tapeglass_4',     'Kits completos 05150', 3),
  ('cat_tapeglass',     'it_tapeglass_5',     'Kit completo 10450', 4),
  ('cat_tapeglass',     'it_tapeglass_6',     'Puts epóxi de 2,5"', 5),
  ('cat_tapeglass',     'it_tapeglass_7',     'Filmes de Compressão', 6),
  -- Stanc Ball
  ('cat_stancball',     'it_stancball_1',     'Kit completo 2" a 4"', 0),
  ('cat_stancball',     'it_stancball_2',     'Kit completo 4" a 8"', 1),
  ('cat_stancball',     'it_stancball_3',     'Item F-00064 (descrição a preencher)', 2),
  -- TVVA
  ('cat_tvva',          'it_tvva_1',          'Amostra reto', 0),
  ('cat_tvva',          'it_tvva_2',          'Amostra curva', 1),
  -- RydLyme
  ('cat_rydlyme',       'it_rydlyme_1',       'Copo alto vidro', 0),
  ('cat_rydlyme',       'it_rydlyme_2',       'Taça vidro', 1),
  ('cat_rydlyme',       'it_rydlyme_3',       'Garrafa Pet 269 ml (amostras conchas)', 2),
  ('cat_rydlyme',       'it_rydlyme_4',       'Saco tubos de aço e cobre', 3),
  ('cat_rydlyme',       'it_rydlyme_5',       'Amostras RydLyme 250 ml', 4),
  ('cat_rydlyme',       'it_rydlyme_6',       'Aquário de vidro alto redondo grande', 5),
  ('cat_rydlyme',       'it_rydlyme_7',       'Taça baleiro de vidro alto redondo pequeno', 6),
  ('cat_rydlyme',       'it_rydlyme_8',       'Infusor de chá inox para conchas', 7),
  -- CorroFink
  ('cat_corrofink',     'it_corrofink_1',     'Amostras (corrente, parafuso com corrosão)', 0),
  ('cat_corrofink',     'it_corrofink_2',     'Amostras Corrofink 300 — 250 ml', 1),
  ('cat_corrofink',     'it_corrofink_3',     'Amostras Corrofink 500 — 250 ml', 2),
  -- Intercept
  ('cat_intercept',     'it_intercept_1',     'Bags e manta', 0),
  -- Inductosense
  ('cat_inductosense',  'it_inductosense_1',  'Maleta sensor', 0),
  -- Tribosonics
  ('cat_tribosonics',   'it_tribosonics_1',   'Válvula Tribosonics', 0),
  -- CorrosionRADAR
  ('cat_corrosionradar','it_corrosionradar_1','Tubo CorrosionRADAR', 0),
  -- PowerPoxi
  ('cat_powerpoxi',     'it_powerpoxi_1',     'Tanque maquete revestido', 0),
  ('cat_powerpoxi',     'it_powerpoxi_2',     'Chute maquete mineração', 1),
  ('cat_powerpoxi',     'it_powerpoxi_3',     'Kit 5611 — Óleo (dispositivo + óleo lubrificante)', 2),
  ('cat_powerpoxi',     'it_powerpoxi_4',     'Embalagens de produtos (Cerâmico, Óleo, MaxPrime, MaxVisco)', 3),
  ('cat_powerpoxi',     'it_powerpoxi_5',     'Carcaça de bomba revestida', 4),
  ('cat_powerpoxi',     'it_powerpoxi_6',     'Chapa revestida', 5),
  ('cat_powerpoxi',     'it_powerpoxi_7',     'Placa plástica mostruário — polímeros aplicados', 6),
  ('cat_powerpoxi',     'it_powerpoxi_8',     'Tubos revestidos', 7),
  ('cat_powerpoxi',     'it_powerpoxi_9',     'Suportes acrílico', 8),
  -- Materiais em Geral
  ('cat_materiais',     'it_materiais_1',     'Monitores Samsung 24" completos', 0),
  ('cat_materiais',     'it_materiais_2',     'Suporte folder sanfona', 1),
  ('cat_materiais',     'it_materiais_3',     'Extintor de incêndio e suporte', 2),
  ('cat_materiais',     'it_materiais_4',     'Caixa de ferramentas (mochila)', 3),
  ('cat_materiais',     'it_materiais_5',     'Validar vídeos dos PenDrives p/ monitores', 4),
  ('cat_materiais',     'it_materiais_6',     'Canetas brindes TF', 5),
  ('cat_materiais',     'it_materiais_7',     'Cartões de atendimento', 6),
  ('cat_materiais',     'it_materiais_8',     'Suportes p/ cartões de visita', 7),
  ('cat_materiais',     'it_materiais_9',     'Cadernetas brindes', 8),
  ('cat_materiais',     'it_materiais_10',    'Garrafas de cachaça', 9),
  ('cat_materiais',     'it_materiais_11',    'Rolo filme plástico', 10),
  ('cat_materiais',     'it_materiais_12',    'Plástico bolha', 11),
  ('cat_materiais',     'it_materiais_13',    'Suporte de parma (madeira)', 12),
  ('cat_materiais',     'it_materiais_14',    'Faca de parma', 13),
  ('cat_materiais',     'it_materiais_15',    'Frasco de álcool em gel', 14),
  ('cat_materiais',     'it_materiais_16',    'Baleiro acrílico', 15),
  ('cat_materiais',     'it_materiais_17',    'Balas', 16),
  ('cat_materiais',     'it_materiais_18',    'Copos plástico', 17),
  ('cat_materiais',     'it_materiais_19',    'Guardanapos', 18),
  ('cat_materiais',     'it_materiais_20',    'Papel toalha', 19),
  ('cat_materiais',     'it_materiais_21',    'Espetinho para petisco', 20),
  ('cat_materiais',     'it_materiais_22',    'Palito para sanduíche', 21),
  ('cat_materiais',     'it_materiais_23',    'Copinho cachaça cristal 25 ml', 22),
  ('cat_materiais',     'it_materiais_24',    'Prato quadrado cristal', 23),
  ('cat_materiais',     'it_materiais_25',    'Porta guardanapo', 24),
  ('cat_materiais',     'it_materiais_26',    'Frasco de álcool em gel (extra)', 25),
  -- Folders / Catálogos impressos
  ('cat_folders',       'it_folders_1',       'Compósito Verde', 0),
  ('cat_folders',       'it_folders_2',       'Multimetall', 1),
  ('cat_folders',       'it_folders_3',       'Tapeglass', 2),
  ('cat_folders',       'it_folders_4',       'Stancball', 3),
  ('cat_folders',       'it_folders_5',       'TVVA', 4),
  ('cat_folders',       'it_folders_6',       'Rydlyme', 5),
  ('cat_folders',       'it_folders_7',       'Corrofink', 6),
  ('cat_folders',       'it_folders_8',       'Intercept', 7),
  ('cat_folders',       'it_folders_9',       'Inductosense', 8),
  ('cat_folders',       'it_folders_10',      'PowerPoxi — Geral azul', 9),
  ('cat_folders',       'it_folders_11',      'PowerPoxi — MaxVisco', 10),
  ('cat_folders',       'it_folders_12',      'PowerPoxi — MaxPrimer', 11),
  ('cat_folders',       'it_folders_13',      'PowerPoxi — 5611', 12),
  -- Caixa de Ferramentas
  ('cat_ferramentas',   'it_ferramentas_1',   'Chaves de fenda', 0),
  ('cat_ferramentas',   'it_ferramentas_2',   'Chave inglesa 12"', 1),
  ('cat_ferramentas',   'it_ferramentas_3',   'Chave grifo 14"', 2),
  ('cat_ferramentas',   'it_ferramentas_4',   'Chave combinada 19mm', 3),
  ('cat_ferramentas',   'it_ferramentas_5',   'Chave de boca 18-19 mm', 4),
  ('cat_ferramentas',   'it_ferramentas_6',   'Chave Phillips', 5),
  ('cat_ferramentas',   'it_ferramentas_7',   'Martelo', 6),
  ('cat_ferramentas',   'it_ferramentas_8',   'Estilete', 7),
  ('cat_ferramentas',   'it_ferramentas_9',   'Fitas isolante', 8),
  ('cat_ferramentas',   'it_ferramentas_10',  'Filtro de linha', 9),
  ('cat_ferramentas',   'it_ferramentas_11',  'Abraçadeiras metálicas 13-19 mm', 10),
  ('cat_ferramentas',   'it_ferramentas_12',  'Par de luvas de vaqueta', 11),
  ('cat_ferramentas',   'it_ferramentas_13',  'Tomada "T"', 12),
  ('cat_ferramentas',   'it_ferramentas_14',  'Alicate universal', 13),
  ('cat_ferramentas',   'it_ferramentas_15',  'Tesoura', 14),
  ('cat_ferramentas',   'it_ferramentas_16',  'Grampeador', 15),
  ('cat_ferramentas',   'it_ferramentas_17',  'Pilha AAA', 16)
) as v(cat_slug, slug, nome, ordem)
join playbook_categorias c on c.slug = v.cat_slug;


-- ============================================================================
-- SEÇÃO 04 — Associações (ASSOC_DEFAULT). desconto null; benefícios vazios.
-- ============================================================================
insert into playbook_associacoes (slug, nome, desconto, ordem) values
  ('assoc_ibram',   'IBRAM',   null, 0),
  ('assoc_abracco', 'ABRACCO', null, 1);


-- ============================================================================
-- SEÇÃO 05 — Prospecção (PROSPECCAO_DEFAULT). Setores sem eventos (vazios).
-- ============================================================================
insert into playbook_prospeccao_setores (slug, nome, ordem) values
  ('ind_mineracao',    'Mineração',    0),
  ('ind_oilgas',       'Oil & Gás',    1),
  ('ind_siderurgia',   'Siderurgia',   2),
  ('ind_energia',      'Energia',      3),
  ('ind_petroquimico', 'Petroquímico', 4);
-- (playbook_prospeccao_eventos começa vazio — não há eventos sugeridos no default.)


-- ============================================================================
-- SEÇÃO 06 — Brindes (BRINDES_DEFAULT). PINs PowerPoxi já vem com estoque 14
-- (migs.pinsPP no HTML insere o mesmo item/quantidade caso ausente).
-- ============================================================================
insert into playbook_brindes (slug, nome, estoque_inicial, ordem) values
  ('br_cadernetas', 'Cadernetas',         500,  0),
  ('br_canetas_tf', 'Canetas TecnoFink',  3000, 1),
  ('br_copos_tf',   'Copos TecnoFink',    null, 2),
  ('br_copos_pp',   'Copos PowerPoxi',    null, 3),
  ('br_canetas_pp', 'Canetas PowerPoxi',  null, 4),
  ('br_pins_pp',    'PINs PowerPoxi',     14,   5);


-- =============================================================================
-- Fim do 11_playbook_seed.sql
-- =============================================================================
