import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Wallet, Users, MapPin, Pizza, BarChart, Settings, Check, Folder, Search, X, CheckSquare, BookOpen, Plus, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react';
import './index.css';

// ─── OVERLAY DE CARREGAMENTO ──────────────────────────────
const LoadingOverlay = ({ title = 'Processando...', subtitle = 'Por favor aguarde.' }) => (
  <div className="loading-overlay">
    <div className="loading-card">
      <div className="loading-spinner" />
      <div className="loading-title">{title}</div>
      <div className="loading-subtitle">{subtitle}</div>
    </div>
  </div>
);

const BRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const inputStyle = {
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  fontSize: '0.875rem',
  color: 'var(--text-dark)',
  background: 'var(--white)',
  outline: 'none',
  width: '100%'
};

function App() {
  const [data, setData] = useState({ transactions: [], resumo: {}, files_summary: [] });
  const [loading, setLoading] = useState(true);
  const [currentMenu, setCurrentMenu] = useState('Dashboard');
  const [uploading, setUploading] = useState(false);
  const [uploadMessages, setUploadMessages] = useState([]);

  // Regras do Extrato
  const [regras, setRegras] = useState([]);
  const emptyRegra = { nome_regra: '', contem_historico: '', contem_detalhes: '', tipo_movimento: '', valores_exatos: '', departamento_destino: '', prioridade: 0 };
  const [novaRegra, setNovaRegra] = useState(emptyRegra);
  const [editandoRegra, setEditandoRegra] = useState(null);
  const [salvandoRegra, setSalvandoRegra] = useState(false);

  // Filtros - Arquivos
  const emptyFiltros = { nome: '', conta: '', mes_ano: '', status: '', data_de: '', data_ate: '' };
  const [filtros, setFiltros] = useState(emptyFiltros);
  const [filtrosAtivos, setFiltrosAtivos] = useState(emptyFiltros);

  // Filtros - Lançamentos
  const emptyFiltrosLanc = { historico: '', tipo: '', status: '', arquivo: '', data_de: '', data_ate: '' };
  const [filtrosLanc, setFiltrosLanc] = useState(emptyFiltrosLanc);
  const [filtrosLancAtivos, setFiltrosLancAtivos] = useState(emptyFiltrosLanc);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/transactions');
      setData(response.data);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setUploadMessages([]);
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }
    try {
      const response = await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessages(response.data.results || []);
      e.target.value = null;
      await fetchData();
    } catch (error) {
      console.error("Erro no upload:", error);
      setUploadMessages([{ status: 'error', filename: 'Falha', message: 'Erro na conexão com servidor' }]);
    } finally {
      setUploading(false);
    }
  };

  const [searching, setSearching] = useState(false);

  const handleFiltrar = () => {
    setSearching(true);
    setTimeout(() => {
      setFiltrosAtivos({ ...filtros });
      setSearching(false);
    }, 600);
  };
  const handleLimpar = () => { setFiltros(emptyFiltros); setFiltrosAtivos(emptyFiltros); };

  const handleFiltrarLanc = () => {
    setSearching(true);
    setTimeout(() => {
      setFiltrosLancAtivos({ ...filtrosLanc });
      setSearching(false);
    }, 600);
  };
  const handleLimparLanc = () => { setFiltrosLanc(emptyFiltrosLanc); setFiltrosLancAtivos(emptyFiltrosLanc); };

  const menuItems = [
    { icon: <Wallet size={18} />, label: "Dashboard" },
    { icon: <Folder size={18} />, label: "Arquivos" },
    { icon: <Pizza size={18} />, label: "Lançamentos" },
    { icon: <CheckSquare size={18} />, label: "Conciliação" },
    { icon: <BookOpen size={18} />, label: "Regras do Extrato" },
    { icon: <Users size={18} />, label: "Departamento" },
    { icon: <BarChart size={18} />, label: "Relatórios" },
    { icon: <Settings size={18} />, label: "Configurações" }
  ];

  if (loading) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>Carregando...</div>;
  }

  const { resumo, transactions, files_summary } = data;
  const currentValStr = BRL(resumo.saldo_geral);
  const receitasStr = BRL(resumo.total_receitas);

  // ─── DASHBOARD ──────────────────────────────────────────
  const renderDashboard = () => (
    <>
      <div className="metrics-grid">
        <div className="metric-card blue">
          <div className="metric-card-header">
            <span className="metric-title">Arquivos Lidos</span>
            <div className="metric-icon blue"><Folder size={16} /></div>
          </div>
          <div className="metric-value">{resumo.arquivos_lidos || 0}</div>
          <div className="metric-sub">PDFs consolidados</div>
        </div>
        <div className="metric-card green">
          <div className="metric-card-header">
            <span className="metric-title">Transações (Total)</span>
            <div className="metric-icon green"><MapPin size={16} /></div>
          </div>
          <div className="metric-value">{resumo.qtd_transacoes || 0}</div>
          <div className="metric-sub">Registradas no período</div>
        </div>
        <div className="metric-card orange">
          <div className="metric-card-header">
            <span className="metric-title">Lançamentos / Dia</span>
            <div className="metric-icon orange"><Pizza size={16} /></div>
          </div>
          <div className="metric-value">{((resumo.qtd_transacoes || 0) / 30).toFixed(0)}</div>
          <div className="metric-sub">Média diária</div>
        </div>
        <div className="metric-card blue2">
          <div className="metric-card-header">
            <span className="metric-title">Arrecadado (Mês)</span>
            <div className="metric-icon blue2"><Wallet size={16} /></div>
          </div>
          <div className="metric-value">{receitasStr}</div>
          <div className="metric-sub">Valores brutos recebidos</div>
        </div>
      </div>
      <div className="content-grid">
        <div className="panel">
          <div className="panel-header panel-header-orange">
            <Folder size={16} /> Arquivos Analisados
          </div>
          {files_summary?.slice(0, 5).map((file, idx) => (
            <div className="list-item" key={idx}>
              <div className="list-item-badge">{idx + 1}</div>
              <div className="list-item-content">
                <div className="list-item-title">{file.arquivo}</div>
                <div className="list-item-sub">Conta: {file.conta}</div>
              </div>
              <div className="list-item-right">
                <div className="list-item-value-green" style={{ color: 'var(--text-dark)' }}>{file.mes_ano}</div>
                <div className="list-item-status">período</div>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header panel-header-green">
            <LineChart size={16} /> Últimas Transações
          </div>
          {transactions.slice(0, 8).map((t, idx) => (
            <div className="list-item" key={idx}>
              <div className="list-item-content">
                <div className="list-item-title" style={{ textTransform: 'uppercase' }}>{t.historico.substring(0, 35)}</div>
                <div className="list-item-sub">{t.data} • {t.tipo_movimento === 'Receita' ? 'Entrada' : 'Saída'}</div>
              </div>
              <div className="list-item-right">
                <div className={t.tipo_movimento === 'Receita' ? 'list-item-value-green' : 'list-item-value-red'}>
                  {BRL(t.valor)}
                </div>
                <div className="list-item-status"><Check size={10} /> Consolidado</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // ─── ARQUIVOS ──────────────────────────────────────────
  const renderArquivos = () => {
    const arquivosFiltrados = (files_summary || []).filter(file => {
      const okNome = !filtrosAtivos.nome || file.arquivo.toLowerCase().includes(filtrosAtivos.nome.toLowerCase());
      const okConta = !filtrosAtivos.conta || file.conta.toLowerCase().includes(filtrosAtivos.conta.toLowerCase());
      const okMes = !filtrosAtivos.mes_ano || file.mes_ano.includes(filtrosAtivos.mes_ano);
      const okStatus = !filtrosAtivos.status || file.status === filtrosAtivos.status;
      const okDe = !filtrosAtivos.data_de || (file.data_inicial && file.data_inicial >= filtrosAtivos.data_de);
      const okAte = !filtrosAtivos.data_ate || (file.data_final && file.data_final <= filtrosAtivos.data_ate);
      return okNome && okConta && okMes && okStatus && okDe && okAte;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Painel de Filtros */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Search size={16} /> Filtros de Pesquisa
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Nome do Arquivo</label>
              <input style={inputStyle} placeholder="Ex: 2050-8.01..." value={filtros.nome}
                onChange={e => setFiltros(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Conta</label>
              <input style={inputStyle} placeholder="Ex: CENTRO ESPIRITA..." value={filtros.conta}
                onChange={e => setFiltros(f => ({ ...f, conta: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Mês/Ano</label>
              <input style={inputStyle} placeholder="Ex: 01/2024" value={filtros.mes_ano}
                onChange={e => setFiltros(f => ({ ...f, mes_ano: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Status</label>
              <select style={inputStyle} value={filtros.status}
                onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="C">✔ Completo</option>
                <option value="P">⏳ Pendente</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Inicial (a partir de)</label>
              <input type="date" style={inputStyle} value={filtros.data_de}
                onChange={e => setFiltros(f => ({ ...f, data_de: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Final (até)</label>
              <input type="date" style={inputStyle} value={filtros.data_ate}
                onChange={e => setFiltros(f => ({ ...f, data_ate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={handleLimpar} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
              borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <X size={14} /> Limpar
            </button>
            <button onClick={handleFiltrar} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: 'var(--primary)', color: 'white',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Search size={14} /> Pesquisar
            </button>
          </div>
        </div>

        {/* Painel da Grid */}
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-orange" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Folder size={16} /> Arquivos Importados
              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {arquivosFiltrados.length}
              </span>
            </div>
            <label style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              backgroundColor: uploading ? '#e5e7eb' : 'var(--primary)',
              color: uploading ? '#9ca3af' : 'white',
              padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.875rem'
            }}>
              {uploading ? 'Processando...' : '+ Importar PDF(s)'}
              <input type="file" multiple accept=".pdf" style={{ display: 'none' }}
                onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          {uploadMessages.length > 0 && (
            <div style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Resultados da Importação:</h4>
              <ul style={{ fontSize: '0.8rem', listStylePosition: 'inside' }}>
                {uploadMessages.map((msg, i) => (
                  <li key={i} style={{ color: msg.status === 'error' ? 'var(--red)' : 'var(--green)' }}>
                    <strong>{msg.filename}</strong>: {msg.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Nome do Arquivo</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Conta</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Mês/Ano</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Data Inicial</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Data Final</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Saldo Inicial</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Débitos</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Créditos</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {arquivosFiltrados.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum arquivo encontrado.</td></tr>
              ) : arquivosFiltrados.map((file, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{file.arquivo}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{file.conta}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{file.mes_ano}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {file.data_inicial || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.78rem', background: file.data_final ? 'var(--green-bg)' : '#f3f4f6', color: file.data_final ? 'var(--green)' : 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                      {file.data_final || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px',
                      background: file.status === 'C' ? 'var(--green-bg)' : 'var(--accent-light)',
                      color: file.status === 'C' ? 'var(--green)' : 'var(--accent)'
                    }}>
                      {file.status === 'C' ? '✔ Completo' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{BRL(file.saldo_inicial)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{BRL(file.total_debitos)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{BRL(file.total_creditos)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{BRL(file.saldo_final)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── LANÇAMENTOS ──────────────────────────────────────────
  const renderLancamentos = () => {
    const lancFiltrados = (transactions || []).filter(t => {
      const okHist = !filtrosLancAtivos.historico || t.historico.toLowerCase().includes(filtrosLancAtivos.historico.toLowerCase());
      const okTipo = !filtrosLancAtivos.tipo || t.tipo_movimento === filtrosLancAtivos.tipo;
      const okStatus = !filtrosLancAtivos.status || t.status === filtrosLancAtivos.status;
      const okArq = !filtrosLancAtivos.arquivo || t.arquivo.toLowerCase().includes(filtrosLancAtivos.arquivo.toLowerCase());
      // Datas vêm como DD/MM/YYYY, converter para comparação
      const dataISO = t.data ? t.data.split('/').reverse().join('-') : '';
      const okDe = !filtrosLancAtivos.data_de || dataISO >= filtrosLancAtivos.data_de;
      const okAte = !filtrosLancAtivos.data_ate || dataISO <= filtrosLancAtivos.data_ate;
      return okHist && okTipo && okStatus && okArq && okDe && okAte;
    }).sort((a, b) => {
      const dA = a.data ? a.data.split('/').reverse().join('-') : '';
      const dB = b.data ? b.data.split('/').reverse().join('-') : '';
      return dB.localeCompare(dA);
    });

    const totalRecFilt = lancFiltrados.filter(t => t.tipo_movimento === 'Receita').reduce((s, t) => s + t.valor, 0);
    const totalDespFilt = lancFiltrados.filter(t => t.tipo_movimento === 'Despesa').reduce((s, t) => s + t.valor, 0);
    const saldoFilt = totalRecFilt + totalDespFilt;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Painel de Filtros */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Search size={16} /> Filtros de Lançamentos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Histórico</label>
              <input style={inputStyle} placeholder="Ex: PIX, TED, boleto..." value={filtrosLanc.historico}
                onChange={e => setFiltrosLanc(f => ({ ...f, historico: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo</label>
              <select style={inputStyle} value={filtrosLanc.tipo}
                onChange={e => setFiltrosLanc(f => ({ ...f, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Status</label>
              <select style={inputStyle} value={filtrosLanc.status}
                onChange={e => setFiltrosLanc(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="conciliado">Conciliado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Arquivo Origem</label>
              <input style={inputStyle} placeholder="Ex: 2050-8.01..." value={filtrosLanc.arquivo}
                onChange={e => setFiltrosLanc(f => ({ ...f, arquivo: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data De</label>
              <input type="date" style={inputStyle} value={filtrosLanc.data_de}
                onChange={e => setFiltrosLanc(f => ({ ...f, data_de: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Data Até</label>
              <input type="date" style={inputStyle} value={filtrosLanc.data_ate}
                onChange={e => setFiltrosLanc(f => ({ ...f, data_ate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={handleLimparLanc} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
              borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <X size={14} /> Limpar
            </button>
            <button onClick={handleFiltrarLanc} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: 'var(--primary)', color: 'white',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Search size={14} /> Pesquisar
            </button>
          </div>
        </div>

        {/* Resumo rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="metric-card blue" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Registros</div>
            <div className="metric-value" style={{ fontSize: '1.3rem' }}>{lancFiltrados.length}</div>
          </div>
          <div className="metric-card green" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Total Receitas</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--green)' }}>{BRL(totalRecFilt)}</div>
          </div>
          <div className="metric-card orange" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Total Despesas</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--red)' }}>{BRL(totalDespFilt)}</div>
          </div>
          <div className="metric-card blue2" style={{ padding: '1rem 1.25rem' }}>
            <div className="metric-title" style={{ fontSize: '0.78rem' }}>Saldo Líquido</div>
            <div className="metric-value" style={{ fontSize: '1.1rem', color: saldoFilt >= 0 ? 'var(--green)' : 'var(--red)' }}>{BRL(saldoFilt)}</div>
          </div>
        </div>

        {/* Grid de Lançamentos */}
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pizza size={16} /> Lançamentos
              <span style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {lancFiltrados.length}
              </span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '55px' }}>#</th>
                <th style={{ padding: '0.6rem 0.5rem', width: '90px' }}>Data</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Histórico</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Detalhes</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '80px' }}>Tipo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '120px' }}>Valor</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '100px' }}>Status</th>
                <th style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }}>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {lancFiltrados.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum lançamento encontrado.</td></tr>
              ) : lancFiltrados.map((t, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.id_codigo}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.data}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 500, textTransform: 'uppercase', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.historico}</td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.detalhes || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: t.tipo_movimento === 'Receita' ? 'var(--green-bg)' : 'var(--accent-light)',
                      color: t.tipo_movimento === 'Receita' ? 'var(--green)' : 'var(--red)'
                    }}>
                      {t.tipo_movimento === 'Receita' ? '↑ Entrada' : '↓ Saída'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: t.valor >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {BRL(t.valor)}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: t.status === 'finalizado' ? 'var(--green-bg)' : t.status === 'conciliado' ? 'var(--blue-bg)' : '#fef3c7',
                      color: t.status === 'finalizado' ? 'var(--green)' : t.status === 'conciliado' ? 'var(--blue)' : '#b45309'
                    }}>
                      {t.status === 'finalizado' ? '✔ Finalizado' : t.status === 'conciliado' ? '◉ Conciliado' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.arquivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── REGRAS DO EXTRATO ────────────────────────────────────
  const fetchRegras = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/regras');
      setRegras(resp.data || []);
    } catch (e) {
      console.error('Erro ao buscar regras', e);
    }
  };

  const handleSalvarRegra = async () => {
    setSalvandoRegra(true);
    try {
      if (editandoRegra) {
        await axios.put(`http://localhost:8000/api/regras/${editandoRegra}`, novaRegra);
      } else {
        await axios.post('http://localhost:8000/api/regras', novaRegra);
      }
      setNovaRegra(emptyRegra);
      setEditandoRegra(null);
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao salvar regra', e);
    } finally {
      setSalvandoRegra(false);
    }
  };

  const handleDeleteRegra = async (id) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/regras/${id}`);
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao excluir regra', e);
    }
  };

  const handleToggleRegra = async (regra) => {
    try {
      await axios.put(`http://localhost:8000/api/regras/${regra.id_codigo}`, { ativo: !regra.ativo });
      await fetchRegras();
    } catch (e) {
      console.error('Erro ao alterar regra', e);
    }
  };

  const handleEditRegra = (regra) => {
    setEditandoRegra(regra.id_codigo);
    setNovaRegra({
      nome_regra: regra.nome_regra || '',
      contem_historico: regra.contem_historico || '',
      contem_detalhes: regra.contem_detalhes || '',
      tipo_movimento: regra.tipo_movimento || '',
      valores_exatos: regra.valores_exatos || '',
      departamento_destino: regra.departamento_destino || '',
      prioridade: regra.prioridade || 0
    });
  };

  const renderRegras = () => {
    // Carrega regras quando abre a tela
    if (regras.length === 0 && currentMenu === 'Regras do Extrato') {
      fetchRegras();
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Formulário de criação/edição */}
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Plus size={16} /> {editandoRegra ? 'Editar Regra' : 'Nova Regra'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Nome da Regra *</label>
              <input style={inputStyle} placeholder="Ex: Pagamento Emivaldo" value={novaRegra.nome_regra}
                onChange={e => setNovaRegra(r => ({ ...r, nome_regra: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Departamento Destino *</label>
              <input style={inputStyle} placeholder="Ex: CONSTRUÇÃO - Mão de obra" value={novaRegra.departamento_destino}
                onChange={e => setNovaRegra(r => ({ ...r, departamento_destino: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Prioridade</label>
              <input type="number" style={inputStyle} placeholder="0" value={novaRegra.prioridade}
                onChange={e => setNovaRegra(r => ({ ...r, prioridade: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Condições (preencha uma ou mais)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Contém no Histórico</label>
              <input style={inputStyle} placeholder="Ex: PIX EMIT" value={novaRegra.contem_historico}
                onChange={e => setNovaRegra(r => ({ ...r, contem_historico: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Contém nos Detalhes</label>
              <input style={inputStyle} placeholder="Ex: Emivaldo Júnior" value={novaRegra.contem_detalhes}
                onChange={e => setNovaRegra(r => ({ ...r, contem_detalhes: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Tipo Movimento</label>
              <select style={inputStyle} value={novaRegra.tipo_movimento}
                onChange={e => setNovaRegra(r => ({ ...r, tipo_movimento: e.target.value }))}>
                <option value="">Qualquer</option>
                <option value="Receita">Receita</option>
                <option value="Despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Valores Exatos (separar por vírgula)</label>
              <input style={inputStyle} placeholder="Ex: 50.00, 60.00" value={novaRegra.valores_exatos}
                onChange={e => setNovaRegra(r => ({ ...r, valores_exatos: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {editandoRegra && (
              <button onClick={() => { setEditandoRegra(null); setNovaRegra(emptyRegra); }} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.25rem', border: '1px solid var(--border-color)',
                borderRadius: '6px', background: 'var(--white)', color: 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
              }}>
                <X size={14} /> Cancelar
              </button>
            )}
            <button onClick={handleSalvarRegra} disabled={!novaRegra.nome_regra || !novaRegra.departamento_destino || salvandoRegra} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1.5rem', border: 'none',
              borderRadius: '6px', background: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? '#e5e7eb' : 'var(--primary)',
              color: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? '#9ca3af' : 'white',
              cursor: (!novaRegra.nome_regra || !novaRegra.departamento_destino) ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.875rem'
            }}>
              <Check size={14} /> {editandoRegra ? 'Atualizar Regra' : 'Salvar Regra'}
            </button>
          </div>
        </div>

        {/* Grid de Regras */}
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div className="panel-header panel-header-green" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={16} /> Regras Cadastradas
              <span style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                {regras.length}
              </span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}>#</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Nome da Regra</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Histórico contém</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Detalhes contém</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Tipo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Valores</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Departamento</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '60px' }}>Ativo</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '100px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma regra cadastrada.</td></tr>
              ) : regras.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', opacity: r.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.prioridade}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{r.nome_regra}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }}>{r.contem_historico || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.78rem' }}>{r.contem_detalhes || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{r.tipo_movimento || 'Qualquer'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{r.valores_exatos || '—'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: 'var(--primary)' }}>{r.departamento_destino}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleToggleRegra(r)}>
                    {r.ativo ? <ToggleRight size={20} color="var(--green)" /> : <ToggleLeft size={20} color="var(--text-muted)" />}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => handleEditRegra(r)} style={{ background: 'var(--blue-bg)', color: 'var(--blue)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        Editar
                      </button>
                      <button onClick={() => handleDeleteRegra(r.id_codigo)} style={{ background: 'var(--accent-light)', color: 'var(--red)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── LAYOUT PRINCIPAL ──────────────────────────────────────────
  return (
    <>
      {uploading && <LoadingOverlay title="Importando arquivo..." subtitle="Estamos lendo o PDF e gravando os lançamentos no banco de dados." />}
      {searching && <LoadingOverlay title="Pesquisando..." subtitle="Filtrando os arquivos conforme os critérios informados." />}
      <div className="app-container">
        <aside className="sidebar">
          <div className="logo-container">
            <div className="logo-icon"><LineChart size={20} /></div>
            <div className="logo-text">
              <h1>Centro Espírita União</h1>
              <div className="logo-sub">Controle Financeiro</div>
            </div>
          </div>
          <ul className="nav-links">
            {menuItems.map((item, idx) => (
              <li className="nav-item" key={idx} onClick={() => setCurrentMenu(item.label)} style={{ cursor: 'pointer' }}>
                <a className={`nav-link ${currentMenu === item.label ? 'active' : ''}`}>
                  {item.icon}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          <header className="header">
            <div>
              <div className="header-title">
                <h2>{currentMenu === 'Dashboard' ? 'Dashboard Financeiro CEU' : currentMenu}</h2>
              </div>
              <div className="header-subtitle">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div className="header-badge">
              <Wallet size={16} /> Valor atual: <span>{currentValStr}</span>
            </div>
          </header>

          {currentMenu === 'Dashboard' && renderDashboard()}
          {currentMenu === 'Arquivos' && renderArquivos()}
          {currentMenu === 'Lançamentos' && renderLancamentos()}
          {currentMenu === 'Regras do Extrato' && renderRegras()}
          {!['Dashboard', 'Arquivos', 'Lançamentos', 'Regras do Extrato'].includes(currentMenu) && (
            <div className="panel">
              <div className="panel-header panel-header-orange">Em construção</div>
              <p style={{ color: 'var(--text-muted)' }}>A tela de {currentMenu} será implementada em breve.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
