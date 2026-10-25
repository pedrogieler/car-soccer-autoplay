# Desenvolvimento

- `index.html`: estrutura da arena e desenhos em SVG.
- `styles/base.css`: estilos gerais da página.
- `styles/arena.css`: aparência da arena e do placar.
- `scripts/game.js`: física, bots e desenho da partida.
- `tests/`: comparação da simulação com registros da versão anterior à reorganização.

Para abrir o jogo localmente, execute na raiz e acesse `http://localhost:8000/`:

```bash
python -m http.server 8000
```

Para verificar a simulação, use o Node.js indicado em `.node-version`:

```bash
node --test
```

Os registros de regressão usam três sementes fixas e acompanham 180 segundos de cada partida. A partida exibida no navegador continua usando uma semente aleatória a cada execução.

O teste compara estados numéricos completos. A versão do Node.js é fixada para usar o mesmo motor JavaScript dos registros e evitar diferenças de arredondamento entre versões.
