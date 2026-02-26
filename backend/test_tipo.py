try:
    from main import app
    from fastapi.testclient import TestClient
    client = TestClient(app)
    tipos = ['Entrada', 'Saida', 'Saída', 'SAÍDA', 'ENTRADA', 'receita', 'despesa', 'RECEITA', 'DESPESA', 'Receita', 'Despesa', 'Fixa', 'Variavel', 'Variável', 'Fixo', 'Ambos', 'Qualquer', '', 'geral', 'Geral', 'GERAL', 'Administrativo', 'Operacional', 'Custo']
    success = []
    for t in tipos:
        try:
            resp = client.post('/api/departamentos', json={'nome': 'Teste ' + t, 'tipo': t})
            if resp.status_code == 200:
                success.append(t)
        except Exception as e:
            pass
    print("Tipos válidos:", success)
except Exception as e:
    print(e)
